import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { AdminTrustController, MeTrustController, PublicReportController } from '../src/v3-trust/api/trust.controllers';
import { BlocklistService, ProofsService, ReportsService, TakedownService, TermsService } from '../src/v3-trust/trust.service';
import { trustWorld, TrustWorld } from './support/memory-trust-store';

/** Slice 5.21 over HTTP with the real guards, pipe, filter and interceptor; the services are the real ones over the in-memory store. */
jest.setTimeout(180_000);

describe('trust and safety API', () => {
  let app: INestApplication; let w: TrustWorld;
  const call = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, role: string | null, body?: object) => { const r = request(app.getHttpServer())[method](url); return (role ? r.set({ 'x-test-principal': role }) : r).send(body ?? {}); };
  // every staff route of the slice with the staff roles that may call it (MARKETING never)
  const OPS_AND_SUPER: Array<['get' | 'post' | 'patch' | 'delete', string]> = [['get', '/v3/admin/business-reports'], ['patch', '/v3/admin/business-reports/x'], ['get', '/v3/admin/trust-blocklist'], ['post', '/v3/admin/trust-blocklist'], ['delete', '/v3/admin/trust-blocklist/x'], ['get', '/v3/admin/business-proofs'], ['patch', '/v3/admin/business-proofs/x'], ['get', '/v3/admin/takedowns']];
  const SUPER_ONLY: Array<['get' | 'post' | 'put' | 'delete', string]> = [['get', '/v3/admin/prohibited-terms'], ['post', '/v3/admin/prohibited-terms'], ['put', '/v3/admin/prohibited-terms/x'], ['delete', '/v3/admin/prohibited-terms/x'], ['post', '/v3/admin/takedowns'], ['post', '/v3/admin/takedowns/x/reverse']];

  beforeEach(async () => {
    w = trustWorld();
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [PublicReportController, MeTrustController, AdminTrustController],
      providers: [throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, { provide: ProofsService, useValue: w.proofs }, { provide: BlocklistService, useValue: w.blocks }, { provide: ReportsService, useValue: w.reports }, { provide: TermsService, useValue: w.terms }, { provide: TakedownService, useValue: w.takedowns }],
    }).compile();
    app = mod.createNestApplication({ rawBody: true });
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner') req.user = { sub: 'v1', email: 'o@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-2') req.user = { sub: 'v2', email: 'o2@x.invalid', role: 'VENDOR' };
      else if (p === 'member') req.user = { sub: 'v1', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', modules: ['website', 'accounts'] };
      else if (p) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  describe('POST /v3/public/report-business', () => {
    const body = { subjectType: 'SITE', subject: 'a.example.in', reason: 'looks like a copy of another shop' };
    it('needs no sign-in and no personal data, and answers 202 with the same body every time', async () => {
      const a = await call('post', '/v3/public/report-business', null, body); expect(a.status).toBe(202); expect(a.body).toMatchObject({ success: true, data: { received: true } });
      const b = await call('post', '/v3/public/report-business', null, { subjectType: 'LISTING', subject: 'no-such-business-anywhere', reason: 'a made up thing here' });
      expect(b.status).toBe(202); expect(b.body.data).toEqual(a.body.data);   // whether the thing exists changes nothing in the answer
      expect(w.trust.reports).toHaveLength(2);
    });
    it('a report that is too short is dropped the same way the validator would reject a malformed one (400 only for a malformed body)', async () => {
      expect((await call('post', '/v3/public/report-business', null, { subjectType: 'NOPE', subject: 'x', reason: 'abcdef' })).status).toBe(400);
      expect((await call('post', '/v3/public/report-business', null, { subjectType: 'SITE', subject: 'x'.repeat(300), reason: 'abcdef' })).status).toBe(400);
      expect((await call('post', '/v3/public/report-business', null, { subjectType: 'SITE', subject: 'x', reason: 'abcdef', extra: 1 })).status).toBe(400);
    });
    it('is rate limited per address: the sixth report in a minute is refused (429)', async () => {
      const codes: number[] = []; for (let i = 0; i < 7; i++) codes.push((await call('post', '/v3/public/report-business', null, body)).status);
      expect(codes.slice(0, 5)).toEqual([202, 202, 202, 202, 202]); expect(codes.slice(5)).toEqual([429, 429]); expect(w.trust.reports).toHaveLength(5);
    });
  });

  describe('owner routes', () => {
    it('the owner offers a proof and reads only their own; another vendor sees nothing of it', async () => {
      const r = await call('post', '/v3/me/business-proof', 'owner', { kind: 'GST', number: '33AAAAA0000A1Z5' }); expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ kind: 'GST', status: 'SUBMITTED', vendorId: 'v1' });
      expect((await call('get', '/v3/me/business-proofs', 'owner')).body.data).toHaveLength(1);
      expect((await call('get', '/v3/me/business-proofs', 'owner-2')).body.data).toEqual([]);
      expect((await call('post', '/v3/me/business-proof', 'owner-2', { kind: 'GST', number: '33BBBBB0000B1Z5', vendorId: 'v1' })).status).toBe(400);   // a vendor id in the body is not part of the contract
      expect(w.trust.proofs.filter((p) => p.vendorId === 'v1')).toHaveLength(1);
    });
    it('proof input is validated', async () => {
      for (const b of [{ kind: 'NOPE', number: '123456' }, { kind: 'GST', number: 'ab' }, { kind: 'GST' }, { kind: 'GST', number: 'x'.repeat(65) }]) expect((await call('post', '/v3/me/business-proof', 'owner', b)).status).toBe(400);
    });
    it('the owner sees their takedown and its reason; another vendor sees none', async () => {
      await w.takedowns.create({ id: 'staff-1', ip: null, role: 'SUPER_ADMIN' }, { vendorId: 'v1', reason: 'the written reason' });
      expect((await call('get', '/v3/me/takedown', 'owner')).body.data).toMatchObject({ active: true, reason: 'the written reason' });
      expect((await call('get', '/v3/me/takedown', 'owner-2')).body.data).toMatchObject({ active: false, reason: null });
    });
    it('a team member is refused (403) and an anonymous caller is refused (401) on all three', async () => {
      for (const [m, u] of [['post', '/v3/me/business-proof'], ['get', '/v3/me/business-proofs'], ['get', '/v3/me/takedown']] as const) { expect([u, (await call(m, u, 'member', { kind: 'GST', number: '123456' })).status]).toEqual([u, 403]); expect([u, (await call(m, u, null)).status]).toEqual([u, 401]); }
    });
  });

  describe('staff routes: role matrix', () => {
    it('MARKETING is refused on every one of them (403)', async () => { for (const [m, u] of [...OPS_AND_SUPER, ...SUPER_ONLY]) expect([m, u, (await call(m, u, 'MARKETING')).status]).toEqual([m, u, 403]); });
    it('a vendor owner is refused on every one of them (403), and an anonymous caller too (the slim app has no JWT guard, so the admin guard answers 403; the real app answers 401 first)', async () => {
      for (const [m, u] of [...OPS_AND_SUPER, ...SUPER_ONLY]) { expect([m, u, (await call(m, u, 'owner')).status]).toEqual([m, u, 403]); expect([m, u, [401, 403].includes((await call(m, u, null)).status)]).toEqual([m, u, true]); }
    });
    it('OPERATIONS is refused on the prohibited phrases and on creating or reversing a takedown (403); SUPER_ADMIN may', async () => {
      for (const [m, u] of SUPER_ONLY) expect([m, u, (await call(m, u, 'OPERATIONS')).status]).toEqual([m, u, 403]);
      expect((await call('get', '/v3/admin/prohibited-terms', 'SUPER_ADMIN')).status).toBe(200);
    });
    it('OPERATIONS and SUPER_ADMIN can read reports, proofs, the block list and the takedown list', async () => {
      for (const role of ['OPERATIONS', 'SUPER_ADMIN']) for (const u of ['/v3/admin/business-reports', '/v3/admin/trust-blocklist', '/v3/admin/business-proofs', '/v3/admin/takedowns']) expect([role, u, (await call('get', u, role)).status]).toEqual([role, u, 200]);
    });
  });

  describe('takedown over HTTP', () => {
    it('SUPER_ADMIN creates one with a written reason and reverses it with another; the listing goes and comes back', async () => {
      expect((await call('post', '/v3/admin/takedowns', 'SUPER_ADMIN', { vendorId: 'v1' })).status).toBe(400);                    // no reason at all
      const blank = await call('post', '/v3/admin/takedowns', 'SUPER_ADMIN', { vendorId: 'v1', reason: '   ' }); expect(blank.status).toBe(400); expect(blank.body.code).toBe('TAKEDOWN_REASON_REQUIRED');
      const made = await call('post', '/v3/admin/takedowns', 'SUPER_ADMIN', { vendorId: 'v1', reason: 'order of the court', documentRef: 'doc-1' }); expect(made.status).toBe(201);
      expect(w.trust.listings.find((l) => l.id === 'l1')!.status).toBe('REMOVED');
      expect((await call('post', '/v3/admin/takedowns', 'SUPER_ADMIN', { vendorId: 'v1', reason: 'again' })).body.code).toBe('TAKEDOWN_ALREADY_ACTIVE');
      expect((await call('post', `/v3/admin/takedowns/${made.body.data.id}/reverse`, 'SUPER_ADMIN', {})).status).toBe(400);
      const rev = await call('post', `/v3/admin/takedowns/${made.body.data.id}/reverse`, 'SUPER_ADMIN', { reason: 'withdrawn' }); expect(rev.status).toBe(200); expect(rev.body.data.status).toBe('REVERSED');
      expect(w.trust.listings.find((l) => l.id === 'l1')!.status).toBe('CLAIMED');
    });
    it('an unknown business is 404', async () => { expect((await call('post', '/v3/admin/takedowns', 'SUPER_ADMIN', { vendorId: 'nobody', reason: 'x' })).body.code).toBe('TAKEDOWN_TARGET_UNKNOWN'); });
  });

  describe('reports, proofs, block list and phrases over HTTP', () => {
    it('reports: listed with the contact masked, moved with the status the reader saw', async () => {
      await w.reports.submit({ subjectType: 'SITE', subject: 'a.example.in', reason: 'a copy of another shop', contact: 'person@example.com' }, '203.0.113.1');
      const l = await call('get', '/v3/admin/business-reports?status=NEW', 'OPERATIONS'); expect(l.body.data.total).toBe(1); expect(JSON.stringify(l.body)).not.toMatch(/person@example|ipHash/);
      const id = l.body.data.items[0].id;
      expect((await call('patch', `/v3/admin/business-reports/${id}`, 'OPERATIONS', { expectedStatus: 'CLOSED', status: 'LOOKING' })).body.code).toBe('TRUST_STALE');
      expect((await call('patch', `/v3/admin/business-reports/${id}`, 'OPERATIONS', { expectedStatus: 'NEW', status: 'LOOKING' })).status).toBe(200);
      expect((await call('get', '/v3/admin/business-reports?status=BOGUS', 'OPERATIONS')).status).toBe(400);
    });
    it('proofs: staff mark one CHECKED (stale refused), the vendor sees the result', async () => {
      const p = (await call('post', '/v3/me/business-proof', 'owner', { kind: 'UDYAM', number: 'UDYAM-XX-00-0000001' })).body.data;
      expect((await call('patch', `/v3/admin/business-proofs/${p.id}`, 'OPERATIONS', { expectedStatus: 'CHECKED', status: 'MISMATCH' })).body.code).toBe('TRUST_STALE');
      expect((await call('patch', `/v3/admin/business-proofs/${p.id}`, 'OPERATIONS', { expectedStatus: 'SUBMITTED', status: 'SUBMITTED' })).status).toBe(400);
      expect((await call('patch', `/v3/admin/business-proofs/${p.id}`, 'OPERATIONS', { expectedStatus: 'SUBMITTED', status: 'CHECKED' })).status).toBe(200);
      expect((await call('get', '/v3/me/business-proofs', 'owner')).body.data[0]).toMatchObject({ status: 'CHECKED' });
      expect((await call('get', '/v3/admin/business-proofs?vendorId=v2', 'OPERATIONS')).body.data.total).toBe(0);
    });
    it('block list: add, duplicate, list without the value, remove', async () => {
      expect((await call('post', '/v3/admin/trust-blocklist', 'OPERATIONS', { kind: 'PHONE', value: '+91 98765 43210', reason: 'fraud report' })).status).toBe(201);
      expect((await call('post', '/v3/admin/trust-blocklist', 'OPERATIONS', { kind: 'PHONE', value: '9876543210', reason: 'again' })).body.code).toBe('BLOCK_EXISTS');
      const l = await call('get', '/v3/admin/trust-blocklist', 'OPERATIONS'); expect(l.body.data.total).toBe(1); expect(JSON.stringify(l.body)).not.toMatch(/98765|valueHash/);
      expect((await call('delete', `/v3/admin/trust-blocklist/${l.body.data.items[0].id}`, 'OPERATIONS')).status).toBe(200);
      expect((await call('post', '/v3/admin/trust-blocklist', 'OPERATIONS', { kind: 'NOPE', value: 'x', reason: 'abc' })).status).toBe(400);
    });
    it('phrases: SUPER_ADMIN adds, edits, lists and removes', async () => {
      const t = await call('post', '/v3/admin/prohibited-terms', 'SUPER_ADMIN', { term: 'Zeta Powder', category: 'TEST_A' }); expect(t.status).toBe(201); expect(t.body.data.term).toBe('zeta powder');
      expect((await call('post', '/v3/admin/prohibited-terms', 'SUPER_ADMIN', { term: 'zeta powder', category: 'TEST_A' })).body.code).toBe('TERM_EXISTS');
      expect((await call('put', `/v3/admin/prohibited-terms/${t.body.data.id}`, 'SUPER_ADMIN', { enabled: false })).body.data.enabled).toBe(false);
      expect((await call('delete', `/v3/admin/prohibited-terms/${t.body.data.id}`, 'SUPER_ADMIN')).status).toBe(200);
      expect((await call('get', '/v3/admin/prohibited-terms', 'SUPER_ADMIN')).body.data).toEqual([]);
    });
  });
});
