// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { forTenant, TenantScopeError } from '../src/common/tenant';
import { buildTestApp } from './support/test-app';
import { SeededTenant, cleanupTenants, counts, newPrisma, seedTenant, snapshot } from './support/fixtures';

type Method = 'get' | 'put' | 'post' | 'delete';
interface Attack {
  name: string;
  method: Method;
  path: (t: SeededTenant) => string;
  body?: Record<string, unknown>;
  /** false = attack only (the owner-side success path would call an external provider or is not worth the cleanup). */
  control?: boolean;
}

/** Object-level routes: another tenant's id in the URL. Each must answer 403 or 404, change nothing, create nothing. */
const ATTACKS: Attack[] = [
  { name: 'CRM: read a lead', method: 'get', path: (t) => `/crm/leads/${t.ids.lead}` },
  { name: 'CRM: update a lead', method: 'put', path: (t) => `/crm/leads/${t.ids.lead}`, body: { notes: 'tampered' } },
  { name: 'CRM: convert a lead to a customer', method: 'post', path: (t) => `/crm/leads/${t.ids.lead}/convert` },
  { name: 'CRM: log a call on a lead', method: 'post', path: (t) => `/crm/leads/${t.ids.lead}/call`, body: { outcome: 'tampered', duration: 1 } },
  { name: 'Contacts: read', method: 'get', path: (t) => `/domainapp/contacts/${t.ids.contact}` },
  { name: 'Contacts: update', method: 'put', path: (t) => `/domainapp/contacts/${t.ids.contact}`, body: { name: 'tampered' } },
  { name: 'Catalog: read', method: 'get', path: (t) => `/domainapp/catalog/${t.ids.catalogItem}` },
  { name: 'Catalog: update', method: 'put', path: (t) => `/domainapp/catalog/${t.ids.catalogItem}`, body: { name: 'tampered' } },
  { name: 'Records: read', method: 'get', path: (t) => `/domainapp/records/${t.ids.record}` },
  { name: 'Records: update', method: 'put', path: (t) => `/domainapp/records/${t.ids.record}`, body: { notes: 'tampered' } },
  { name: 'Records: change status', method: 'put', path: (t) => `/domainapp/records/${t.ids.record}/status`, body: { status: 'tampered' } },
  { name: 'Invoices: read', method: 'get', path: (t) => `/domainapp/invoices/${t.ids.invoice}` },
  { name: 'Invoices: render PDF/HTML', method: 'get', path: (t) => `/domainapp/invoices/${t.ids.invoice}/pdf` },
  { name: 'Invoices: mark paid', method: 'put', path: (t) => `/domainapp/invoices/${t.ids.invoice}/mark-paid`, control: false },
  { name: 'Invoices: send payment link', method: 'post', path: (t) => `/domainapp/invoices/${t.ids.invoice}/send-link`, control: false },
  { name: 'Stock: adjust a product', method: 'post', path: (t) => `/stock/products/${t.ids.product}/adjust`, body: { mode: 'set', quantity: 3, reason: 'RECOUNT' } },
  { name: 'Stock: read a product history', method: 'get', path: (t) => `/stock/products/${t.ids.product}/history` },
  // Destructive: listed last so owner-side controls delete only after every other control has run.
  { name: 'Contacts: delete', method: 'delete', path: (t) => `/domainapp/contacts/${t.ids.disposableContact}` },
  { name: 'Catalog: delete', method: 'delete', path: (t) => `/domainapp/catalog/${t.ids.catalogItem}` },
  { name: 'Records: delete', method: 'delete', path: (t) => `/domainapp/records/${t.ids.record}` },
];

/** List/aggregate routes: the caller's own scope; they must never include another tenant's rows. */
const LISTS = ['/crm/leads', '/domainapp/contacts', '/domainapp/catalog', '/domainapp/records', '/domainapp/invoices', '/domainapp/summary', '/notifications', '/crm/telecrm/queue', '/crm/telecrm/recent-calls', '/stock/low'];

describe('cross-tenant isolation (staging database, synthetic tenants only)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let A: SeededTenant;
  let B: SeededTenant;
  let snapA: Record<string, string>;
  let countsA: Record<string, number>;
  let countsB: Record<string, number>;

  const call = (token: string | undefined, method: Method, path: string, body?: Record<string, unknown>) => {
    let r = request(app.getHttpServer())[method](path);
    if (token) r = r.set('Authorization', `Bearer ${token}`);
    return body ? r.send(body) : r;
  };
  const isDenied = (status: number) => status === 403 || status === 404;

  beforeAll(async () => {
    prisma = newPrisma();
    app = await buildTestApp();
    A = await seedTenant(prisma, 'a', RUN_ID);
    B = await seedTenant(prisma, 'b', RUN_ID);
    snapA = await snapshot(prisma, A);
    countsA = await counts(prisma, A.vendorId);
    countsB = await counts(prisma, B.vendorId);
  }, 120000);

  afterAll(async () => {
    try {
      await cleanupTenants(prisma, RUN_ID);
    } finally {
      await app?.close();
      await prisma?.$disconnect();
    }
  }, 120000);

  describe('attacks by tenant B (owner token and team-member token) on tenant A', () => {
    for (const who of ['owner', 'team member'] as const) {
      it.each(ATTACKS.map((a) => [a.name, a] as const))(`${who} of B cannot: %s`, async (_name, a) => {
        const token = who === 'owner' ? B.token : B.memberToken;
        const res = await call(token, a.method, a.path(A), a.body);
        if (!isDenied(res.status)) {
          throw new Error(`${a.method.toUpperCase()} ${a.path(A)} as ${who} of another tenant answered ${res.status}, expected 403 or 404`);
        }
        expect(JSON.stringify(res.body)).not.toContain(A.marker);
      });
    }

    it("tenant A's rows are byte-for-byte unchanged and nothing was created under either tenant", async () => {
      expect(await snapshot(prisma, A)).toEqual(snapA);
      expect(await counts(prisma, A.vendorId)).toEqual(countsA);
      expect(await counts(prisma, B.vendorId)).toEqual(countsB);
    });

    it("B marking A's notification as read answers 200 with count 0 and leaves it unread", async () => {
      const res = await call(B.token, 'put', `/notifications/${A.ids.notification}/read`);
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).toMatch(/"count":0/);
      expect((await prisma.notification.findUnique({ where: { id: A.ids.notification } }))?.read).toBe(false);
    });
  });

  describe('list and aggregate routes never mix tenants', () => {
    it.each(LISTS.map((p) => [p] as const))('GET %s as B contains none of A\'s data', async (path) => {
      const res = await call(B.token, 'get', path);
      expect([200, 403]).toContain(res.status);   // 403 only where the route is admin-only for this principal
      const text = JSON.stringify(res.body);
      for (const needle of [A.marker, ...Object.values(A.ids)]) expect(text).not.toContain(needle);
    });

    it("B's summary counts only B's rows", async () => {
      const res = await call(B.token, 'get', '/domainapp/summary');
      expect(res.status).toBe(200);
      const c = (res.body.data ?? res.body).counts;
      expect(c).toMatchObject({ contacts: countsB.contacts, catalogItems: countsB.catalogItems, records: countsB.records, invoices: countsB.invoices });
    });
  });

  describe("cannot attach another tenant's rows to your own (cross-reference writes)", () => {
    const rejected = (s: number) => s === 400 || s === 403 || s === 404;
    it("creating a record that points at A's contact or catalog item is refused", async () => {
      for (const body of [{ date: new Date().toISOString(), contactId: A.ids.contact }, { date: new Date().toISOString(), catalogItemId: A.ids.catalogItem }]) {
        const res = await call(B.token, 'post', '/domainapp/records', body);
        if (!rejected(res.status)) throw new Error(`cross-reference record create answered ${res.status}`);
      }
    });
    it("creating an invoice for A's contact or A's record is refused", async () => {
      for (const body of [{ contactId: A.ids.contact, items: [{ description: 'x', quantity: 1, rate: 1 }] }, { contactId: B.ids.contact, recordId: A.ids.record, items: [{ description: 'x', quantity: 1, rate: 1 }] }]) {
        const res = await call(B.token, 'post', '/domainapp/invoices', body);
        if (!rejected(res.status)) throw new Error(`cross-reference invoice create answered ${res.status}`);
      }
    });
    it('none of those attempts created anything', async () => {
      expect(await counts(prisma, B.vendorId)).toEqual(countsB);
      expect(await counts(prisma, A.vendorId)).toEqual(countsA);
    });
  });

  describe('authentication is required', () => {
    it.each(ATTACKS.slice(0, 6).map((a) => [a.name, a] as const).concat([['list', { name: 'list', method: 'get', path: () => '/domainapp/contacts' }] as const]))(
      'no token => 401: %s', async (_n, a) => {
        const res = await call(undefined, a.method, a.path(A), a.body);
        expect(res.status).toBe(401);
      });
    it('a token for a vendor that does not exist => 401', async () => {
      const { JwtService } = await import('@nestjs/jwt');
      const ghost = new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: 'does-not-exist', email: 'x@v3test.invalid', role: 'VENDOR' });
      expect((await call(ghost, 'get', '/domainapp/contacts')).status).toBe(401);
    });
  });

  describe('positive controls: the same requests succeed for the rightful owner (so the denials above are real)', () => {
    const controls = ATTACKS.filter((a) => a.control !== false);
    it.each(controls.map((a) => [a.name, a] as const))('owner of A can: %s', async (_n, a) => {
      const res = await call(A.token, a.method, a.path(A), a.body);
      if (res.status < 200 || res.status >= 300) throw new Error(`${a.method.toUpperCase()} ${a.path(A)} as the OWNER answered ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`);
    });
    it("a team member of A can read A's data (modules telecrm/website/accounts)", async () => {
      const res = await call(A.memberToken, 'get', '/domainapp/summary');
      expect(res.status).toBe(200);
    });
  });

  describe('forTenant(): the Prisma-level guard against the real database', () => {
    it('lists only the tenant\'s rows', async () => {
      const db = forTenant(prisma, B.vendorId);
      const rows = await db.contact.findMany();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.vendorId === B.vendorId)).toBe(true);
    });
    it("cannot read, update or delete another tenant's row by id", async () => {
      const db = forTenant(prisma, B.vendorId);
      expect(await db.catalogItem.findUnique({ where: { id: A.ids.catalogItem } })).toBeNull();
      await expect(db.catalogItem.update({ where: { id: A.ids.catalogItem }, data: { name: 'tampered' } })).rejects.toThrow();
      await expect(db.catalogItem.delete({ where: { id: A.ids.catalogItem } })).rejects.toThrow();
      expect((await db.catalogItem.updateMany({ where: { id: A.ids.catalogItem }, data: { name: 'tampered' } })).count).toBe(0);
    });
    it('refuses writes that name another tenant, and models with no tenant key', async () => {
      const db = forTenant(prisma, B.vendorId);
      await expect(db.contact.create({ data: { vendorId: A.vendorId, name: 'x', phone: '1' } })).rejects.toThrow(TenantScopeError);
      await expect(db.contact.update({ where: { id: B.ids.contact }, data: { vendorId: A.vendorId } })).rejects.toThrow(TenantScopeError);
      // Vendor has no vendorId column, so it is not reachable through a tenant client (checked at run time, not by the type system).
      await expect(db.vendor.findMany()).rejects.toThrow(TenantScopeError);
    });
    it('creates rows stamped with the tenant', async () => {
      const db = forTenant(prisma, B.vendorId);
      const c = await db.contact.create({ data: { name: 'created via forTenant', phone: '9000000009' } as never });
      expect(c.vendorId).toBe(B.vendorId);
    });
  });

  it('cleanup removes every synthetic row of this run', async () => {
    const removed = await cleanupTenants(prisma, RUN_ID);
    expect(removed.vendors).toBe(2);
    expect(await prisma.vendor.count({ where: { email: { contains: RUN_ID } } })).toBe(0);
  }, 120000);
});
