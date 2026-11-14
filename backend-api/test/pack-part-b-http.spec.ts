import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { SiteDomainsService } from '../src/site-domains/site-domains.service';
import { MeDomainsController } from '../src/site-domains/api/me-domains.controller';
import { AdminPackController, MePackController } from '../src/v3-packs/api/pack.controllers';
import { AppShellService } from '../src/v3-packs/app-shell.service';
import { PackEngineService } from '../src/v3-packs/pack-engine.service';
import { TabGuard } from '../src/v3-packs/requires-tab';
import { MeServicesController } from '../src/v3-services/api/services.controllers';
import { ServicesCatalogService } from '../src/v3-services/services.service';
import { FakeEntitlements, makeEngine } from './support/pack-fakes';

/**
 * Part B (B9 to B13) over HTTP with the real guards, pipe, filter and interceptor, and the real pack engine over the in-memory stores: the navigation contract, the add-on list, the refusal of the domain
 * screen on a Free trial, the pause and its staff routes, and the read-only shell a team member may call. Vendor A and vendor B are different tenants throughout.
 */
jest.setTimeout(180_000);

describe('pack engine, Part B, over HTTP', () => {
  let app: INestApplication; let plans: FakeEntitlements; let svc: PackEngineService;
  let badge = { waiting: 3, unread: 1 };
  const as = (p: string) => ({ 'x-test-principal': p });
  const get = (url: string, p?: string) => { const r = request(app.getHttpServer()).get(url); return p ? r.set(as(p)) : r; };
  const send = (m: 'post' | 'put', url: string, p: string, body: object = {}) => request(app.getHttpServer())[m](url).set(as(p)).send(body);
  const owner = (v: string) => ({ type: 'VENDOR' as const, id: v });

  beforeEach(async () => {
    const e = await makeEngine(); plans = e.plans; svc = e.svc; badge = { waiting: 3, unread: 1 };
    plans.states.set('a', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' }); plans.states.set('b', { mode: 'V3', level: 'FREE', track: 'PROFESSIONAL' });
    await svc.register('a', { categoryKey: 'plumber' }, owner('a')); await svc.register('b', { categoryKey: 'plumber' }, owner('b'));
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [MePackController, AdminPackController, MeServicesController, MeDomainsController],
      providers: [
        throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, TabGuard,
        { provide: PackEngineService, useValue: svc }, { provide: AppShellService, useValue: new AppShellService(svc, { badge: async () => badge } as never) },
        { provide: ServicesCatalogService, useValue: { vendorPacks: async () => ({ items: [], purchases: [] }), purchasePack: jest.fn(async () => ({ id: 'p1' })) } },
        { provide: SiteDomainsService, useValue: { overview: async (v: string) => ({ vendor: v }) } },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner-a') req.user = { sub: 'a', email: 'a@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-b') req.user = { sub: 'b', email: 'b@x.invalid', role: 'VENDOR' };
      else if (p === 'member-a') req.user = { sub: 'a', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', memberId: 'm1', modules: ['website'] };
      else if (p === 'member-a-msg') req.user = { sub: 'a', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', memberId: 'm1', modules: ['communication'] };
      else if (p) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  describe('GET /v3/me/navigation (B9)', () => {
    it('returns the contract: key, label, route, group, state and upsell text, in the order common, pack, capability, add-on', async () => {
      const r = await get('/v3/me/navigation', 'owner-b');
      expect(r.status).toBe(200);
      const tabs = r.body.data.tabs as Array<Record<string, unknown>>;
      for (const t of tabs) expect(Object.keys(t)).toEqual(expect.arrayContaining(['key', 'label', 'route', 'group', 'state', 'upsellText']));
      expect(['COMMON', 'PACK', 'CAPABILITY', 'ADDON']).toEqual(expect.arrayContaining([...new Set(tabs.map((t) => t.group))]));
      const crm = tabs.find((t) => t.key === 'crm')!; expect([crm.state, crm.reason]).toEqual(['LOCKED_PREVIEW', 'FREE_TRIAL']); expect(typeof crm.upsellText).toBe('string');
      expect(tabs.find((t) => t.key === 'website')!.state).toBe('ACTIVE');
    });
    it('is open to a team member too (the tab list is read only) and always the caller\'s own vendor', async () => {
      expect((await get('/v3/me/navigation', 'member-a')).status).toBe(200);
      expect((await get('/v3/me/navigation', 'owner-a')).body.data.tier).toBe('PROFESSIONAL');
    });
    it('a signed-out caller and a staff member are refused', async () => {
      expect((await get('/v3/me/navigation')).status).toBe(401);
      expect((await get('/v3/me/navigation', 'OPERATIONS')).status).toBe(403);
    });
  });

  describe('GET /v3/me/app-shell (B12)', () => {
    it('the owner gets every section; the counts are numbers only', async () => {
      const r = await get('/v3/me/app-shell', 'owner-a');
      expect(r.status).toBe(200); expect(r.body.data.actor).toBe('OWNER'); expect(r.body.data.sections.sort()).toEqual(['inbox', 'navigation', 'packs', 'plan']);
      expect(r.body.data.inbox).toEqual({ waiting: 3, unread: 1 });
    });
    it('a team member without a message area gets the menu and no count; with one, the count only', async () => {
      const a = await get('/v3/me/app-shell', 'member-a');
      expect(a.status).toBe(200); expect(a.body.data.actor).toBe('TEAM_MEMBER'); expect(a.body.data.inbox).toBeNull();
      const tabKeys = (a.body.data.navigation.tabs as Array<{ key: string }>).map((t) => t.key);
      for (const k of ['billing', 'plan', 'domain', 'migration']) expect(tabKeys).not.toContain(k);
      const b = await get('/v3/me/app-shell', 'member-a-msg');
      expect(b.body.data.inbox).toEqual({ waiting: 3, unread: 1 });
      expect(JSON.stringify(b.body)).not.toMatch(/paise|invoice|endsAt|startsAt|termMonths|priceStatus/);
    });
    it('a member still cannot reach the owner-only routes the shell stands in for', async () => {
      for (const u of ['/v3/me/pack/register']) expect((await send('post', u, 'member-a', { categoryKey: 'plumber' })).status).toBe(403);
    });
    it('staff and signed-out callers are refused', async () => {
      expect((await get('/v3/me/app-shell')).status).toBe(401);
      expect((await get('/v3/me/app-shell', 'SUPER_ADMIN')).status).toBe(403);
    });
  });

  describe('GET /v3/me/packs and POST /v3/me/packs/:key/purchase (B10)', () => {
    it('returns the four add-on packs with the price PENDING and no number, next to the wallet packs', async () => {
      const r = await get('/v3/me/packs', 'owner-a');
      expect(r.status).toBe(200); expect(r.body.data.items).toEqual([]);
      const keys = (r.body.data.addonPacks as Array<{ key: string; priceStatus: string; price: unknown }>);
      expect(keys.map((k) => k.key).sort()).toEqual(['HOME_SAMPLE_COLLECTION', 'ONLINE_ORDERING_DELIVERY', 'PHARMACY_COUNTER', 'SHOP']);
      for (const k of keys) expect([k.priceStatus, k.price]).toEqual(['PENDING', null]);
    });
    it('buying SHOP answers 409 ADDON_PRICE_PENDING and the wallet is never asked; an add-on the category does not offer is 404; a wallet pack key still goes to the wallet', async () => {
      const shop = await send('post', '/v3/me/packs/SHOP/purchase', 'owner-a', { idempotencyKey: 'key-abcdefgh-1' });
      expect([shop.status, shop.body.code ?? shop.body.error?.code ?? shop.body.data?.code]).toEqual([409, 'ADDON_PRICE_PENDING']);
      const lab = await send('post', '/v3/me/packs/PHARMACY_COUNTER/purchase', 'owner-a', { idempotencyKey: 'key-abcdefgh-2' });
      expect(lab.status).toBe(404);
      const wallet = await send('post', '/v3/me/packs/poster_pack/purchase', 'owner-a', { idempotencyKey: 'key-abcdefgh-3' });
      expect(wallet.status).toBe(200);
    });
    it('a team member cannot list or buy (owner only)', async () => {
      expect((await get('/v3/me/packs', 'member-a')).status).toBe(403);
      expect((await send('post', '/v3/me/packs/SHOP/purchase', 'member-a', { idempotencyKey: 'key-abcdefgh-4' })).status).toBe(403);
    });
  });

  describe('the domain screen on a Free trial (B11)', () => {
    it('a Free trial vendor is refused with TAB_LOCKED; a paid vendor is served; vendor B\'s answer never carries vendor A\'s data', async () => {
      const free = await get('/v3/me/domains', 'owner-b');
      expect(free.status).toBe(403); expect(JSON.stringify(free.body)).toContain('TAB_LOCKED');
      const paid = await get('/v3/me/domains', 'owner-a');
      expect(paid.status).toBe(200); expect(paid.body.data).toEqual({ vendor: 'a' });
    });
    it('every route of the screen is refused on a Free trial, not only the list', async () => {
      for (const [m, u] of [['put', '/v3/me/domains/subdomain'], ['post', '/v3/me/domains/custom'], ['post', '/v3/me/domains/x/verify'], ['post', '/v3/me/domains/x/primary']] as const) {
        const r = await send(m, u, 'owner-b', { subdomain: 'abc', host: 'abc.example.com' });
        expect([u, r.status, JSON.stringify(r.body).includes('TAB_LOCKED')]).toEqual([u, 403, true]);
      }
    });
    it('a paused plan closes the screen with the reason PLAN_PAUSED, and resuming opens it again', async () => {
      await send('post', '/v3/admin/pack-engine/vendors/a/plan-pause', 'OPERATIONS', { reason: 'owner asked' });
      plans.states.set('a', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL', paused: true });
      const paused = await get('/v3/me/domains', 'owner-a');
      expect(paused.status).toBe(403); expect(JSON.stringify(paused.body)).toContain('TAB_LOCKED');   // the wire carries the code; the reason PLAN_PAUSED is in the navigation answer (next test) and in the guard's own answer (pack-part-b.spec.ts)
      await send('post', '/v3/admin/pack-engine/vendors/a/plan-resume', 'OPERATIONS');
      plans.states.set('a', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
      expect((await get('/v3/me/domains', 'owner-a')).status).toBe(200);
    });
  });

  describe('pause and resume routes (B13)', () => {
    it('OPERATIONS, ADMIN and SUPER_ADMIN may; MARKETING (SALES) and SUPPORT may not; a vendor is not staff', async () => {
      for (const role of ['MARKETING', 'SUPPORT']) expect([role, (await send('post', '/v3/admin/pack-engine/vendors/a/plan-pause', role, { reason: 'x yz' })).status]).toEqual([role, 403]);
      expect((await send('post', '/v3/admin/pack-engine/vendors/a/plan-pause', 'owner-a', { reason: 'x yz' })).status).toBe(403);
      const ok = await send('post', '/v3/admin/pack-engine/vendors/a/plan-pause', 'ADMIN', { reason: 'owner asked' });
      expect([ok.status, ok.body.data.paused]).toEqual([200, true]);
    });
    it('a missing or short reason is 400; a second pause is 409 PLAN_ALREADY_PAUSED; resume with no pause is 409 PLAN_NOT_PAUSED', async () => {
      expect((await send('post', '/v3/admin/pack-engine/vendors/a/plan-pause', 'OPERATIONS', {})).status).toBe(400);
      expect((await send('post', '/v3/admin/pack-engine/vendors/a/plan-pause', 'OPERATIONS', { reason: 'ab' })).status).toBe(400);
      expect((await send('post', '/v3/admin/pack-engine/vendors/a/plan-pause', 'OPERATIONS', { reason: 'owner asked', extra: 1 })).status).toBe(400);   // a field that is not declared is refused
      await send('post', '/v3/admin/pack-engine/vendors/a/plan-pause', 'OPERATIONS', { reason: 'owner asked' });
      plans.states.set('a', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL', paused: true });
      expect(JSON.stringify((await send('post', '/v3/admin/pack-engine/vendors/a/plan-pause', 'OPERATIONS', { reason: 'again again' })).body)).toContain('PLAN_ALREADY_PAUSED');
      expect(JSON.stringify((await send('post', '/v3/admin/pack-engine/vendors/b/plan-resume', 'OPERATIONS')).body)).toContain('PLAN_NOT_PAUSED');
    });
    it('the vendor\'s navigation answer carries the paused state', async () => {
      await send('post', '/v3/admin/pack-engine/vendors/a/plan-pause', 'OPERATIONS', { reason: 'owner asked' });
      plans.states.set('a', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL', paused: true });
      const r = await get('/v3/me/navigation', 'owner-a');
      expect([r.body.data.paused, r.body.data.planState]).toEqual([true, 'PAUSED']);
      expect((r.body.data.tabs as Array<{ key: string; reason: string }>).find((t) => t.key === 'crm')!.reason).toBe('PLAN_PAUSED');
    });
  });
});
