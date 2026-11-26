import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { AdminItemsController } from '../src/v3-admin-draft/admin-draft.controller';
import { AdminDraftService } from '../src/v3-admin-draft/admin-draft.service';
import { ProfileFieldsService } from '../src/v3-profile-fields/profile.service';
import { PartnersService } from '../src/v3-partners/partners.service';
import { siteStandingOf } from '../src/v3-telecaller/core/telecaller-core';
import { TelecallerSelfController } from '../src/v3-telecaller/telecaller.controllers';
import { TelecallerService } from '../src/v3-telecaller/telecaller.service';
import { ActOnBehalfService } from '../src/v3-website/act-on-behalf/act-on-behalf.service';
import { ActOnBehalfStore } from '../src/v3-website/act-on-behalf/act-on-behalf.store';
import { WebsiteService } from '../src/v3-website/website.service';
import { AobWorld, aobWorld } from './support/act-on-behalf-world';
import { OWNER_ACTOR, VENDOR_ID, WebsiteWorld, websiteWorld } from './support/website-world';

/** E11b over HTTP: the real admin guard and role matrix, the real telecaller and staff-draft services; the database is a fake that applies the filters it is given. */
jest.setTimeout(180_000);

const PRINCIPALS: Record<string, Record<string, unknown>> = {
  SUPER_ADMIN: { sub: 'super-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'SUPER_ADMIN' },
  ADMIN: { sub: 'admin-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'ADMIN' },
  OPERATIONS: { sub: 'ops-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'OPERATIONS' },
  TELE_A: { sub: 'tele-a', role: 'ADMIN', kind: 'admin_member', adminRole: 'MARKETING', staffLabel: 'TELECALLER' },
  TELE_B: { sub: 'tele-b', role: 'ADMIN', kind: 'admin_member', adminRole: 'MARKETING', staffLabel: 'TELECALLER' },
  TELE_NEW: { sub: 'tele-new', role: 'ADMIN', kind: 'admin_member', adminRole: 'MARKETING', staffLabel: 'TELECALLER' },
  SALES: { sub: 'sales-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'MARKETING' },
  SUPPORT: { sub: 'support-1', role: 'ADMIN', kind: 'admin_member', adminRole: 'SUPPORT' },
  OWNER: { sub: VENDOR_ID, role: 'VENDOR' },
};
/** Logins linked to a commission partner: the telecallers. */
const PARTNERS: Record<string, string> = { 'tele-a': 'partner-a', 'tele-b': 'partner-b', 'tele-new': 'partner-new' };

interface V { id: string; businessName: string; registeredByStaffId: string | null; createdAt: Date; industry?: string; status?: string; subdomain?: string | null; siteProvisionStatus?: string | null; siteProvisionCode?: string | null; removed?: boolean; email: string; phone: string }
const at = (day: number): Date => new Date(Date.UTC(2026, 10, day));
const vendor = (id: string, by: string | null, day: number, extra: Partial<V> = {}): V => ({ id, businessName: `${id} business`, registeredByStaffId: by, createdAt: at(day), industry: 'plumber', status: 'ACTIVE', subdomain: id, email: `${id}@owner.invalid`, phone: '9876500000', ...extra });

/** A fake that refuses a filter it does not understand: a service that forgot its filter, or invented one, fails the test. */
function only(where: Record<string, unknown>, keys: string[]): void {
  const odd = Object.keys(where).filter((k) => !keys.includes(k));
  if (odd.length) throw new Error(`unexpected filter ${odd.join(',')}`);
}

describe('E11b', () => {
  let app: INestApplication; let w: WebsiteWorld; let a: AobWorld;
  let vendors: V[]; let pubs: Array<{ vendorId: string; status: string; publishedAt: Date | null; indexable: boolean }>;
  let products: Array<{ id: string; vendorId: string; name: string; category: string | null; price: string | null; active: boolean; createdAt: Date }>;

  const prisma = {
    vendor: {
      findMany: async ({ where, skip, take, select }: { where: { registeredByStaffId: string }; skip: number; take: number; select: Record<string, unknown> }) => {
        only(where, ['registeredByStaffId']);
        if (typeof where.registeredByStaffId !== 'string' || !where.registeredByStaffId) throw new Error('empty owner filter');
        return vendors.filter((v) => v.registeredByStaffId === where.registeredByStaffId).sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime()).slice(skip, skip + take)
          .map((v) => { const row: Record<string, unknown> = {}; for (const k of Object.keys(select)) row[k] = k === 'v3SiteRemoval' ? (v.removed ? { vendorId: v.id } : null) : ((v as unknown as Record<string, unknown>)[k] ?? null); return row; });
      },
      count: async ({ where }: { where: { registeredByStaffId: string } }) => { only(where, ['registeredByStaffId']); return vendors.filter((v) => v.registeredByStaffId === where.registeredByStaffId).length; },
    },
    v3SitePublication: {
      findMany: async ({ where }: { where: { vendorId: { in: string[] }; status: string } }) => { only(where, ['vendorId', 'status']); return pubs.filter((p) => where.vendorId.in.includes(p.vendorId) && p.status === where.status).map((p) => ({ ...p })); },
    },
    vendorProduct: {
      findMany: async ({ where, skip, take }: { where: { vendorId: string; id?: { in: string[] } }; skip?: number; take?: number }) => {
        only(where, ['vendorId', 'id']); if (!where.vendorId) throw new Error('empty vendor filter');
        const rows = products.filter((p) => p.vendorId === where.vendorId && (!where.id || where.id.in.includes(p.id))).sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
        return rows.slice(skip ?? 0, take === undefined ? undefined : (skip ?? 0) + take).map((p) => ({ ...p }));
      },
      count: async ({ where }: { where: { vendorId: string } }) => products.filter((p) => p.vendorId === where.vendorId).length,
    },
  };

  const get = (url: string, who: string) => request(app.getHttpServer()).get(url).set('x-test-principal', who);

  beforeEach(async () => {
    w = websiteWorld({ level: 'PRO' });
    a = await aobWorld(30); a.store.vendors.add(VENDOR_ID); a.store.createdBy.set(VENDOR_ID, 'tele-a');
    vendors = [
      vendor('live', 'tele-a', 5), vendor('preview', 'tele-a', 4), vendor('failed', 'tele-a', 3, { siteProvisionStatus: 'FAILED', siteProvisionCode: 'PUBLISH_BLOCKED' }),
      vendor('nothing', 'tele-a', 2), vendor('gone', 'tele-a', 1, { removed: true }),
      vendor('other-live', 'tele-b', 6), vendor('office', 'ops-1', 7), vendor('self', null, 8),
    ];
    pubs = [
      { vendorId: 'live', status: 'PUBLISHED', publishedAt: at(9), indexable: false }, { vendorId: 'live', status: 'DRAFT_PREVIEW', publishedAt: null, indexable: true },
      { vendorId: 'preview', status: 'DRAFT_PREVIEW', publishedAt: null, indexable: true }, { vendorId: 'gone', status: 'PUBLISHED', publishedAt: at(9), indexable: true },
      { vendorId: 'other-live', status: 'PUBLISHED', publishedAt: at(9), indexable: true },
    ];
    products = [
      { id: 'i1', vendorId: VENDOR_ID, name: 'Leak repair', category: 'Repairs', price: '₹500', active: true, createdAt: at(1) },
      { id: 'i2', vendorId: VENDOR_ID, name: 'Bathroom fitting', category: null, price: null, active: false, createdAt: at(2) },
      { id: 'i3', vendorId: VENDOR_ID, name: 'Tank cleaning', category: null, price: null, active: true, createdAt: at(3) },
      { id: 'z1', vendorId: 'v-other', name: 'Not yours', category: null, price: null, active: true, createdAt: at(1) },
    ];
    const partners = { forLogin: async (sub: string) => (PARTNERS[sub] ? { id: PARTNERS[sub], name: sub } : null) };
    const telecaller = new TelecallerService({ get: (t: unknown) => (t === PartnersService ? partners : undefined) } as never, prisma as never, {} as never);
    const mod = await Test.createTestingModule({
      controllers: [TelecallerSelfController, AdminItemsController],
      providers: [
        { provide: TelecallerService, useValue: telecaller }, AdminDraftService, { provide: ActOnBehalfService, useValue: a.svc }, { provide: ActOnBehalfStore, useValue: a.store },
        { provide: WebsiteService, useValue: w.web }, { provide: ProfileFieldsService, useValue: {} }, { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => { const p = req.headers['x-test-principal']; if (p) req.user = { email: 's@x.invalid', ...PRINCIPALS[p] }; next(); });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  describe('GET /v3/admin/telecaller/vendors', () => {
    const URL = '/v3/admin/telecaller/vendors';
    const ids = (body: { data: { items: Array<{ vendorId: string }> } }): string[] => body.data.items.map((i) => i.vendorId);

    it('lists the businesses the caller created, newest first, with where each website stands', async () => {
      const r = await get(URL, 'TELE_A');
      expect(r.status).toBe(200);
      expect(ids(r.body)).toEqual(['live', 'preview', 'failed', 'nothing', 'gone']);
      expect(r.body.data.total).toBe(5);
      const site = Object.fromEntries(r.body.data.items.map((i: { vendorId: string; site: unknown }) => [i.vendorId, i.site]));
      expect(site.live).toEqual({ status: 'LIVE', url: 'https://live.get4domain.com', publishedAt: at(9).toISOString(), indexable: false, problemCode: null });
      expect(site.preview).toEqual({ status: 'PREVIEW_ONLY', url: null, publishedAt: null, indexable: null, problemCode: null });
      expect(site.failed).toMatchObject({ status: 'FAILED', problemCode: 'PUBLISH_BLOCKED', url: null });
      expect(site.nothing).toMatchObject({ status: 'NOT_BUILT' });
      expect(site.gone).toMatchObject({ status: 'REMOVED', url: null, publishedAt: null });
      expect(r.body.data.items[0]).toMatchObject({ businessName: 'live business', category: 'plumber', accountStatus: 'ACTIVE', subdomain: 'live' });
    });

    it('never shows another telecaller\'s businesses, the office\'s, or self-registered ones, whatever the request asks', async () => {
      const mine = await get(URL, 'TELE_B');
      expect(ids(mine.body)).toEqual(['other-live']); expect(mine.body.data.total).toBe(1);
      for (const id of ['live', 'preview', 'office', 'self']) expect(JSON.stringify(mine.body)).not.toContain(`"${id}"`);
      for (const q of ['?staffId=tele-a', '?registeredByStaffId=tele-a', '?partnerId=partner-a', '?vendorId=live']) {
        const r = await get(URL + q, 'TELE_B');
        expect([q, r.status]).toEqual([q, 400]);
        expect(JSON.stringify(r.body)).not.toContain('live business');
      }
      expect(ids((await get(`${URL}?entityId=tele-a`, 'TELE_B')).body)).toEqual(['other-live']);   // a shared paging field that this route does not read
      expect((await get(URL, 'TELE_NEW')).body.data).toMatchObject({ items: [], total: 0 });
    });

    it('carries no owner e-mail or phone', async () => {
      const text = JSON.stringify((await get(URL, 'TELE_A')).body);
      expect(text).not.toContain('@owner.invalid'); expect(text).not.toContain('9876500000');
    });

    it('pages with the total; a page size over 100 is refused', async () => {
      const r = await get(`${URL}?page=2&pageSize=2`, 'TELE_A');
      expect(ids(r.body)).toEqual(['failed', 'nothing']); expect(r.body.data).toMatchObject({ page: 2, pageSize: 2, total: 5 });
      expect((await get(`${URL}?pageSize=101`, 'TELE_A')).status).toBe(400);
    });

    it('refuses a staff login that is not a telecaller with a plain code, and refuses support, a vendor and no login', async () => {
      for (const who of ['SALES', 'OPERATIONS', 'SUPER_ADMIN']) {
        const r = await get(URL, who);
        expect([who, r.status, r.body.code]).toEqual([who, 403, 'NOT_A_TELECALLER']);
      }
      for (const who of ['SUPPORT', 'OWNER']) expect((await get(URL, who)).status).toBe(403);
      expect((await request(app.getHttpServer()).get(URL)).status).toBe(403);
    });

    it('the standing rule: removed wins, then live, then preview, then a failed creation', () => {
      expect(siteStandingOf({ removed: true, live: true, preview: true, provisionStatus: 'FAILED' })).toBe('REMOVED');
      expect(siteStandingOf({ removed: false, live: true, preview: true, provisionStatus: 'FAILED' })).toBe('LIVE');
      expect(siteStandingOf({ removed: false, live: false, preview: true, provisionStatus: 'FAILED' })).toBe('PREVIEW_ONLY');
      expect(siteStandingOf({ removed: false, live: false, preview: false, provisionStatus: 'FAILED' })).toBe('FAILED');
      expect(siteStandingOf({ removed: false, live: false, preview: false, provisionStatus: null })).toBe('NOT_BUILT');
    });
  });

  describe('GET /v3/admin/vendors/:id/items', () => {
    const URL = `/v3/admin/vendors/${VENDOR_ID}/items`;
    const writePages = (rows: Array<Record<string, string>>) => w.web.save(VENDOR_ID, OWNER_ACTOR, { kind: 'list', name: 'itemDetails', items: rows });

    it('lists every item, hidden ones too, says which have a page, and lists the written pages with their item', async () => {
      await writePages([{ itemId: 'i2', title: 'New bathrooms', status: 'ongoing' }, { itemId: 'i-deleted', title: 'Old service' }]);
      const r = await get(URL, 'OPERATIONS');
      expect(r.status).toBe(200);
      expect(r.body.data.items).toEqual([
        { itemId: 'i1', name: 'Leak repair', category: 'Repairs', price: '₹500', active: true, hasPage: false },
        { itemId: 'i2', name: 'Bathroom fitting', category: null, price: null, active: false, hasPage: true },
        { itemId: 'i3', name: 'Tank cleaning', category: null, price: null, active: true, hasPage: false },
      ]);
      expect(r.body.data).toMatchObject({ total: 3, page: 1, pageSize: 25 });
      expect(r.body.data.itemPages).toEqual([
        expect.objectContaining({ itemId: 'i2', title: 'New bathrooms', status: 'ongoing', itemName: 'Bathroom fitting', itemActive: false }),
        expect.objectContaining({ itemId: 'i-deleted', title: 'Old service', itemName: null, itemActive: false }),
      ]);
    });

    it('lists every written page whatever page of items is asked for, and never names another business\'s item', async () => {
      await writePages([{ itemId: 'i3', title: 'Tanks' }, { itemId: 'z1', title: 'Borrowed id' }]);
      const r = await get(`${URL}?page=1&pageSize=1`, 'OPERATIONS');
      expect(r.body.data.items.map((i: { itemId: string }) => i.itemId)).toEqual(['i1']);
      expect(r.body.data.itemPages.map((p: { itemId: string; itemName: string | null }) => [p.itemId, p.itemName])).toEqual([['i3', 'Tank cleaning'], ['z1', null]]);
      expect(JSON.stringify(r.body)).not.toContain('Not yours');
      expect((await get(`${URL}?pageSize=101`, 'OPERATIONS')).status).toBe(400);
    });

    it('needs no session to read, and changes nothing', async () => {
      const before = JSON.stringify(await w.web.draft(VENDOR_ID));
      expect((await get(URL, 'OPERATIONS')).status).toBe(200);
      expect(JSON.stringify(await w.web.draft(VENDOR_ID))).toBe(before);
      expect(w.store.drafts.size).toBe(0);
      expect(a.store.rows).toHaveLength(0);
    });

    it('roles: operations, admin, super admin and the telecaller who created the business', async () => {
      for (const who of ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'TELE_A']) expect([who, (await get(URL, who)).status]).toEqual([who, 200]);
    });

    it('another telecaller is told the business does not exist; other sales, support and a vendor are refused; nothing leaks', async () => {
      const other = await get(URL, 'TELE_B');
      expect(other.status).toBe(404); expect(other.body.code).toBe('ACT_ON_BEHALF_VENDOR_NOT_FOUND');
      const sales = await get(URL, 'SALES'); expect(sales.status).toBe(403); expect(sales.body.code).toBe('ACT_ON_BEHALF_ROLE');
      for (const who of ['SUPPORT', 'OWNER']) expect((await get(URL, who)).status).toBe(403);
      expect((await request(app.getHttpServer()).get(URL)).status).toBe(403);
      for (const who of ['TELE_B', 'SALES', 'SUPPORT', 'OWNER']) expect(JSON.stringify((await get(URL, who)).body)).not.toContain('Leak repair');
    });

    it('an unknown business is 404, for staff and for a telecaller alike', async () => {
      for (const who of ['OPERATIONS', 'TELE_A']) {
        const r = await get('/v3/admin/vendors/nope/items', who);
        expect([who, r.status, r.body.code]).toEqual([who, 404, 'ACT_ON_BEHALF_VENDOR_NOT_FOUND']);
      }
    });
  });
});
