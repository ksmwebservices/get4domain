import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DirectoryAdminController } from '../src/directory/api/directory-admin.controller';
import { DirectoryPublicController } from '../src/directory/api/directory-public.controller';
import { MeDirectoryController } from '../src/directory/api/me-directory.controller';
import { DirectoryAdminService } from '../src/directory/directory-admin.service';
import { DirectoryReadService } from '../src/directory/directory-read.service';
import { DirectoryVisitService } from '../src/directory/directory-visit.service';
import { DirectoryRemovalService } from '../src/directory/directory-removal.service';
import { MeDirectoryService } from '../src/directory/me-directory.service';
import { DirectorySettingsService } from '../src/directory/settings/directory-settings.service';
import { DEFAULT_DIRECTORY_SETTINGS } from '../src/directory/settings/directory-settings';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { ClaimOtpController } from '../src/provisioning/claims/claim-otp.controller';
import { ClaimOtpService } from '../src/provisioning/claims/claim-otp.service';
import { directoryWorld, DirectoryWorld, PHONE } from './support/directory-world';

/** Slice 5.7 over HTTP with the real guards, pipe, filter and interceptor; the services are the real ones over the in-memory repository. */
jest.setTimeout(180_000);
const TOKEN = 'T'.repeat(43);

describe('directory API', () => {
  let app: INestApplication; let w: DirectoryWorld;
  const as = (role: string) => ({ 'x-test-principal': role });
  const get = (url: string, role?: string) => { const r = request(app.getHttpServer()).get(url); return role ? r.set(as(role)) : r; };
  const send = (m: 'post' | 'put', url: string, role: string | null, body: object = {}) => { const r = request(app.getHttpServer())[m](url); return (role ? r.set(as(role)) : r).send(body); };

  beforeEach(async () => {
    w = await directoryWorld();
    const settings = { get: async () => ({ ...DEFAULT_DIRECTORY_SETTINGS, ...w.settings.over }) };
    const mod = await Test.createTestingModule({
      imports: [throttlerImport],
      controllers: [DirectoryPublicController, MeDirectoryController, DirectoryAdminController, ClaimOtpController],
      providers: [
        throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard },
        { provide: DirectoryReadService, useValue: w.read }, { provide: DirectoryVisitService, useValue: w.visits }, { provide: DirectoryRemovalService, useValue: w.removal }, { provide: DirectorySettingsService, useValue: settings },
        { provide: MeDirectoryService, useValue: w.me }, { provide: DirectoryAdminService, useValue: w.admin }, { provide: ClaimOtpService, useValue: w.otp },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner-a') req.user = { sub: 'va', email: 'a@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-b') req.user = { sub: 'vb', email: 'b@x.invalid', role: 'VENDOR' };
      else if (p === 'member-a') req.user = { sub: 'va', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', modules: ['website', 'telecrm'] };
      else if (p) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    w.repo.vendors.set('va', { id: 'va', name: 'A Plumbing', phone: PHONE, email: 'a@x.invalid' }); w.repo.vendors.set('vb', { id: 'vb', name: 'B Plumbing', phone: PHONE, email: 'b@x.invalid' });
  });
  afterEach(async () => { await app.close(); });

  describe('public read', () => {
    it('trees, with an ETag and cache headers, and a 304 when the caller already has them; no login needed', async () => {
      const a = await get('/v3/directory/locations'); expect(a.status).toBe(200); expect(a.body.data[0].slug).toBe('tamil-nadu');
      expect(a.headers.etag).toMatch(/^"[0-9a-f]{32}"$/); expect(a.headers['cache-control']).toMatch(/public, max-age=300/);
      const b = await request(app.getHttpServer()).get('/v3/directory/locations').set('If-None-Match', a.headers.etag); expect(b.status).toBe(304); expect(b.text).toBe('');
      expect((await get('/v3/directory/categories')).body.data[0].children).toHaveLength(2);
    });
    it('the list is filtered, capped and paged; a bad number is a 400, never a crash', async () => {
      for (let i = 1; i <= 5; i++) await w.biz({ name: `Plumber ${i}` });
      const r = await get('/v3/directory/businesses?category=plumber&location=tamil-nadu&pageSize=1000&q=plumber');
      expect(r.status).toBe(200); expect(r.body.data.pageSize).toBe(50); expect(r.body.data.total).toBe(5);
      expect((await get('/v3/directory/businesses?page=abc')).status).toBe(400); expect((await get('/v3/directory/businesses?pageSize=0')).status).toBe(400);
      expect((await get('/v3/directory/businesses?location=atlantis')).body.data.items).toEqual([]);
    });
    it('one business: 200 / 404 / 410; an unclaimed one hides its private details; nothing internal leaks', async () => {
      await w.biz({ name: 'Live Co', vendorId: 'va' }); await w.biz({ name: 'Unclaimed Co', status: 'UNCLAIMED' }); await w.biz({ name: 'Gone Co', status: 'REMOVED' }); await w.biz({ name: 'Susp Co', status: 'SUSPENDED' });
      const live = await get('/v3/directory/businesses/live-co'); expect(live.status).toBe(200); expect(live.body.data).toMatchObject({ name: 'Live Co', phone: PHONE, claimed: true });
      const un = await get('/v3/directory/businesses/unclaimed-co'); expect(un.body.data).toMatchObject({ phone: null, address: { city: 'Chennai' }, hours: {} });
      const gone = await get('/v3/directory/businesses/gone-co'); expect(gone.status).toBe(410); expect(gone.body.code).toBe('DIRECTORY_GONE');
      const unknown = await get('/v3/directory/businesses/nobody'); const susp = await get('/v3/directory/businesses/susp-co');
      expect(unknown.status).toBe(404); expect(susp.status).toBe(200); expect(susp.body.data).toMatchObject({ name: 'Susp Co' });   // owner rule 6: a suspended listing stays listed
      expect(JSON.stringify([live.body, un.body])).not.toMatch(/"vendorId"|"id"|"email"|"status"|"source"|\bva\b/);
    });
    it('sitemap data: indexable, public businesses only', async () => {
      await w.biz({ name: 'Index Co' }); await w.biz({ name: 'Unclaimed Co', status: 'UNCLAIMED' });
      const r = await get('/v3/directory/sitemap-data'); expect(r.status).toBe(200); expect(r.body.data.items.map((i: { slug: string }) => i.slug)).toEqual(['index-co']);
    });
    it('removal request: the SAME 202 answer for a known business, an unknown one and a removed one; the 6th in a minute is 429; the link endpoints are uniform 404s', async () => {
      await w.biz({ name: 'Live Co' }); await w.biz({ name: 'Gone Co', status: 'REMOVED' });
      const a = await send('post', '/v3/directory/removal-requests', null, { businessSlug: 'live-co' });
      const b = await send('post', '/v3/directory/removal-requests', null, { businessSlug: 'nobody' });
      const c = await send('post', '/v3/directory/removal-requests', null, { businessSlug: 'gone-co' });
      expect([a.status, b.status, c.status]).toEqual([202, 202, 202]); expect(b.body.data).toEqual(a.body.data); expect(c.body.data).toEqual(a.body.data);
      expect(w.repo.removals.size).toBe(1);
      expect((await send('post', '/v3/directory/removal-requests', null, { businessSlug: 5 })).status).toBe(400);
      expect((await get('/v3/directory/removal-requests/' + 'A'.repeat(43))).status).toBe(404);
      const token = /removal\/([A-Za-z0-9_-]{43})/.exec(w.sms.sent[0].body)![1];
      expect((await get('/v3/directory/removal-requests/' + token)).body.data).toMatchObject({ valid: true, confirmed: false });
      expect((await send('post', `/v3/directory/removal-requests/${token}/confirm`, null)).body.data).toEqual({ confirmed: true });
      const last = await send('post', '/v3/directory/removal-requests', null, { businessSlug: 'live-co' }); const more = await send('post', '/v3/directory/removal-requests', null, { businessSlug: 'live-co' });
      expect([last.status, more.status].includes(429)).toBe(true);
    });
  });

  describe('visits (slice 5.7b): the directory has one action, Visit site', () => {
    const visit = (slug: string, body: object = {}, ip = '203.0.113.9') => request(app.getHttpServer()).post(`/v3/directory/businesses/${slug}/visit`).set('X-Forwarded-For', ip).send(body);
    it('POST visit: 200 with a reference and the link, no cookie, nothing cached; an unknown business is the plain 404', async () => {
      const a = await w.biz({ name: 'Visit Co', vendorId: 'va' }); w.repo.sites.set('va', { subdomain: 'visitco', proActive: false });
      const r = await visit(a.slug, { fromSearch: true });
      expect(r.status).toBe(200); expect(Object.keys(r.body.data).sort()).toEqual(['expiresAt', 'ref', 'url']); expect(r.body.data.url).toBe(`https://visitco.get4domain.com?src=dir&ref=${r.body.data.ref}`);
      expect(r.headers['set-cookie']).toBeUndefined(); expect(r.headers['cache-control']).toBe('no-store');
      const missing = await visit('nobody'); expect(missing.status).toBe(404);
      expect((await visit('visit-co', { fromSearch: 'yes' })).status).toBe(400);   // the body is validated: only fromSearch, only a boolean
      expect([...w.repo.visits.values()][0]).toMatchObject({ count: 1, searchCount: 1 });
    });
    it('POST visit is rate limited per IP (the 61st in a minute is 429)', async () => {
      const a = await w.biz({ name: 'Visit Co', vendorId: 'va' }); w.repo.sites.set('va', { subdomain: 'visitco', proActive: false });
      const codes: number[] = [];
      for (let i = 0; i < 62; i++) codes.push((await visit(a.slug, {}, '198.51.100.77')).status);
      expect(codes.slice(0, 60).every((c) => c === 200)).toBe(true); expect(codes.slice(60)).toContain(429);
    });
    it('GET /v3/me/directory/stats: the owner sees only their own counts; a team member is refused; no login is 401', async () => {
      const a = await w.biz({ name: 'A Co', vendorId: 'va' }); const b = await w.biz({ name: 'B Co', vendorId: 'vb' });
      w.repo.sites.set('va', { subdomain: 'aco', proActive: false }); w.repo.sites.set('vb', { subdomain: 'bco', proActive: true });
      await visit(a.slug, {}, '10.0.0.1'); await visit(b.slug, {}, '10.0.0.2'); await visit(b.slug, {}, '10.0.0.3');
      const mine = await get('/v3/me/directory/stats?days=7', 'owner-a'); expect(mine.status).toBe(200); expect(mine.body.data).toMatchObject({ total: 1, hasProfile: true });
      expect((await get('/v3/me/directory/stats', 'owner-b')).body.data.total).toBe(2);
      expect((await get('/v3/me/directory/stats', 'member-a')).status).toBe(403);
      expect((await get('/v3/me/directory/stats')).status).toBe(401);
      expect((await get('/v3/me/directory/stats?days=500', 'owner-a')).status).toBe(400);
    });
    it('GET /v3/admin/directory/visits: OPERATIONS and SUPER_ADMIN see the report; MARKETING is refused', async () => {
      const a = await w.biz({ name: 'A Co', vendorId: 'va' }); w.repo.sites.set('va', { subdomain: 'aco', proActive: false }); await visit(a.slug);
      for (const role of ['OPERATIONS', 'SUPER_ADMIN']) { const r = await get('/v3/admin/directory/visits', role); expect(r.status).toBe(200); expect(r.body.data.items[0]).toMatchObject({ slug: 'a-co', count: 1 }); }
      expect((await get('/v3/admin/directory/visits', 'MARKETING')).status).toBe(403);
      expect((await get('/v3/admin/directory/visits?from=2027-02-30x', 'OPERATIONS')).status).toBe(400);
    });
  });

  describe('claim by phone OTP', () => {
    const setup = async () => { await w.biz({ name: 'Unclaimed Co', status: 'UNCLAIMED', vendorId: 'va' }); w.claims.add(TOKEN, 'va', 'Unclaimed Co'); };
    it('request is always 200 with the same body; verify is the same 400 for every failure; success returns the setup grant', async () => {
      await setup();
      const ok = await send('post', `/v3/claim/${TOKEN}/otp/request`, null); const unknown = await send('post', `/v3/claim/${'U'.repeat(43)}/otp/request`, null);
      expect([ok.status, unknown.status]).toEqual([200, 200]); expect(unknown.body.data).toEqual(ok.body.data);
      const bad = await send('post', `/v3/claim/${TOKEN}/otp/verify`, null, { code: '000000' }); const unk = await send('post', `/v3/claim/${'U'.repeat(43)}/otp/verify`, null, { code: '123456' });
      expect([bad.status, unk.status]).toEqual([400, 400]); expect(unk.body).toMatchObject({ code: 'OTP_INVALID' }); expect(bad.body.message).toBe(unk.body.message);
      expect((await send('post', `/v3/claim/${TOKEN}/otp/verify`, null, { code: 'abc' })).status).toBe(400);
      expect((await send('post', `/v3/claim/${TOKEN}/otp/verify`, null, {})).status).toBe(400);
      const good = await send('post', `/v3/claim/${TOKEN}/otp/verify`, null, { code: '123456' });
      expect(good.status).toBe(200); expect(good.body.data).toMatchObject({ claimed: true, vendorId: 'va' }); expect(good.body.data.setupToken).toHaveLength(43);
      expect((await send('post', `/v3/claim/${TOKEN}/otp/verify`, null, { code: '123456' })).status).toBe(400);   // replay
    });
    it('rate limited per IP: the 4th request in a minute is 429', async () => {
      await setup(); const codes: number[] = [];
      for (let i = 0; i < 4; i++) codes.push((await send('post', `/v3/claim/${TOKEN}/otp/request`, null)).status);
      expect(codes).toEqual([200, 200, 200, 429]);
    });
  });

  describe('the owner\'s profile (/v3/me/directory)', () => {
    it('owner only: a team member is refused; the owner sees only their own profile; the body cannot set the slug, status, indexing or vendor', async () => {
      await w.biz({ name: 'A Co', vendorId: 'va', slug: 'a-co' }); await w.biz({ name: 'B Co', vendorId: 'vb', slug: 'b-co' });
      expect((await get('/v3/me/directory', 'member-a')).status).toBe(403); expect((await send('put', '/v3/me/directory', 'member-a', { description: 'x' })).status).toBe(403);
      const a = await get('/v3/me/directory', 'owner-a'); expect(a.body.data.profile).toMatchObject({ slug: 'a-co', name: 'A Co' });
      const b = await get('/v3/me/directory', 'owner-b'); expect(b.body.data.profile.slug).toBe('b-co');
      for (const extra of [{ slug: 'hijack' }, { status: 'CLAIMED' }, { indexable: true }, { vendorId: 'vb' }, { id: 'x' }]) expect((await send('put', '/v3/me/directory', 'owner-a', { description: 'A description that is long enough to be indexed.', ...extra })).status).toBe(400);
      const upd = await send('put', '/v3/me/directory', 'owner-a', { description: 'A description that is long enough to be indexed, and more.' });
      expect(upd.status).toBe(200); expect(upd.body.data.profile.description).toMatch(/^A description/);
      expect((await w.repo.getBusinessByVendor('vb'))!.descriptionText).not.toMatch(/^A description/);   // B untouched
    });
  });

  describe('staff routes (/v3/admin/directory)', () => {
    it('MARKETING reads businesses WITHOUT the personal fields, and is refused every write, the override and the removal requests', async () => {
      const b = await w.biz({ name: 'Live Co', vendorId: 'va' }); await w.repo.updateBusiness(b.id, { emailMasked: 'o•••@example.com' });
      const m = await get(`/v3/admin/directory/businesses/${b.id}`, 'MARKETING'); expect(m.status).toBe(200);
      for (const k of ['phone', 'emailMasked', 'address', 'hours', 'geo']) expect(m.body.data).not.toHaveProperty(k);
      expect(JSON.stringify((await get('/v3/admin/directory/businesses', 'MARKETING')).body)).not.toMatch(/9876543210|example\.com|12 Test Road/);
      const o = await get(`/v3/admin/directory/businesses/${b.id}`, 'OPERATIONS'); expect(o.body.data).toMatchObject({ phone: PHONE, emailMasked: 'o•••@example.com' });
      for (const [method, url, body] of [
        ['post', '/v3/admin/directory/locations', { kind: 'STATE', name: 'X' }], ['put', `/v3/admin/directory/locations/${w.ids.tn}`, { name: 'X' }], ['post', '/v3/admin/directory/categories', { name: 'X' }], ['put', `/v3/admin/directory/categories/${w.ids.plumber}`, { name: 'X' }],
        ['post', '/v3/admin/directory/businesses', { name: 'X', categoryId: w.ids.plumber }], ['put', `/v3/admin/directory/businesses/${b.id}`, { name: 'X' }], ['post', `/v3/admin/directory/businesses/${b.id}/moderate`, { action: 'SUSPEND', reason: 'abc' }],
        ['post', `/v3/admin/directory/businesses/${b.id}/placements`, { startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z', label: 'Sponsored' }], ['post', '/v3/admin/directory/placements/x/revoke', {}],
        ['post', `/v3/admin/directory/businesses/${b.id}/claim-phone-override`, { phone: '9000000001', reason: 'abc' }], ['post', '/v3/admin/directory/removal-requests/x/approve', {}], ['post', '/v3/admin/directory/removal-requests/x/reject', { reason: 'abc' }], ['post', '/v3/admin/directory/removal-requests/x/execute', {}],
      ] as Array<['post' | 'put', string, object]>) expect([method, url, (await send(method, url, 'MARKETING', body)).status]).toEqual([method, url, 403]);
      expect((await get('/v3/admin/directory/removal-requests', 'MARKETING')).status).toBe(403);
      for (const url of ['/v3/admin/directory/businesses', '/v3/admin/directory/locations', '/v3/admin/directory/removal-requests']) expect((await get(url, 'owner-a')).status).toBe(403);   // a vendor is not staff
    });
    it('OPERATIONS and SUPER_ADMIN: create, edit, moderate, place a labelled sponsor, override the claim phone, handle a removal; validation errors are 400', async () => {
      const created = await send('post', '/v3/admin/directory/businesses', 'OPERATIONS', { name: 'Sri Ganesh Plumbing', categoryId: w.ids.plumber, locationId: w.ids.chennaiCity, phone: '98765 43210', description: 'Fast and tidy plumbing work across the city, with clear prices.' });
      expect(created.status).toBe(200); const id = created.body.data.id as string; expect(created.body.data).toMatchObject({ status: 'UNCLAIMED', slug: 'sri-ganesh-plumbing-chennai' });
      expect((await send('post', '/v3/admin/directory/businesses', 'OPERATIONS', { name: 'X', categoryId: w.ids.plumber, vendorId: 'va' })).status).toBe(400);   // no vendor from the body
      expect((await send('post', `/v3/admin/directory/businesses/${id}/moderate`, 'SUPER_ADMIN', { action: 'SUSPEND', reason: 'a' })).status).toBe(400);
      expect((await send('post', `/v3/admin/directory/businesses/${id}/moderate`, 'SUPER_ADMIN', { action: 'SUSPEND', reason: 'reported' })).status).toBe(200);
      expect((await send('post', `/v3/admin/directory/businesses/${id}/moderate`, 'SUPER_ADMIN', { action: 'RESTORE', reason: 'reviewed' })).status).toBe(200);
      const noLabel = await send('post', `/v3/admin/directory/businesses/${id}/placements`, 'OPERATIONS', { startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z', label: '' }); expect(noLabel.status).toBe(400);
      const pl = await send('post', `/v3/admin/directory/businesses/${id}/placements`, 'OPERATIONS', { startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-12-01T00:00:00Z', label: 'Sponsored' }); expect(pl.status).toBe(200);
      expect((await get(`/v3/admin/directory/businesses/${id}/placements`, 'MARKETING')).body.data).toHaveLength(1);
      expect((await send('post', `/v3/admin/directory/businesses/${id}/claim-phone-override`, 'OPERATIONS', { phone: '9000000001', reason: 'owner changed number' })).status).toBe(200);
      const loc = await send('post', '/v3/admin/directory/locations', 'OPERATIONS', { kind: 'DISTRICT', parentId: w.ids.tn, name: 'Salem' }); expect(loc.status).toBe(200);
      expect((await send('post', '/v3/admin/directory/locations', 'OPERATIONS', { kind: 'DISTRICT', parentId: w.ids.tn, name: 'Salem' })).status).toBe(409);
      expect((await send('put', `/v3/admin/directory/locations/${loc.body.data.id}`, 'OPERATIONS', { active: false })).status).toBe(200);
      const list = await get('/v3/admin/directory/businesses?status=UNCLAIMED&pageSize=5', 'SUPER_ADMIN'); expect(list.body.data.total).toBe(1);
      expect((await get('/v3/admin/directory/businesses?status=NOPE', 'OPERATIONS')).status).toBe(400);
    });
    it('the removal queue shows the contact masked and the confirmed flag; approve needs a confirmed request', async () => {
      await w.biz({ name: 'Live Co' }); await send('post', '/v3/directory/removal-requests', null, { businessSlug: 'live-co' });
      const q = await get('/v3/admin/directory/removal-requests', 'OPERATIONS'); expect(q.body.data.items[0]).toMatchObject({ status: 'REQUESTED', contact: '+91•••••••210', confirmed: false });
      expect(JSON.stringify(q.body)).not.toMatch(/9876543210|tokenHash/);
      const id = q.body.data.items[0].id as string;
      expect((await send('post', `/v3/admin/directory/removal-requests/${id}/approve`, 'OPERATIONS')).status).toBe(409);
      expect((await send('post', `/v3/admin/directory/removal-requests/${id}/reject`, 'OPERATIONS', { reason: 'no' })).status).toBe(400);
      expect((await send('post', `/v3/admin/directory/removal-requests/${id}/reject`, 'OPERATIONS', { reason: 'not the owner' })).status).toBe(200);
    });
  });
});
