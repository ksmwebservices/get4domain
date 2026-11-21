import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { AdminThemeSwitchController, MeThemeSwitchController } from '../src/v3-theme-switch/api/theme-switch.controllers';
import { ThemeSwitchService } from '../src/v3-theme-switch/theme-switch.service';
import { THEME_FEE_TOTAL, themeWorld, ThemeWorld } from './support/theme-switch-world';

/** Slice 5.16d over HTTP with the real guards, pipe, filter and interceptor; the service is the real one over the in-memory twins and the fake site pipeline. */
jest.setTimeout(180_000);

describe('theme switch API', () => {
  let app: INestApplication; let w: ThemeWorld; let n = 0;
  const as = (role: string) => ({ 'x-test-principal': role });
  const get = (url: string, role?: string) => { const r = request(app.getHttpServer()).get(url); return role ? r.set(as(role)) : r; };
  const send = (url: string, role: string | null, body: object = {}) => { const r = request(app.getHttpServer()).post(url); return (role ? r.set(as(role)) : r).send(body); };
  const key = () => `http-key-${++n}-abcdefgh`;

  beforeEach(async () => {
    w = themeWorld(); await w.seed(); await w.ensureFee();
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [MeThemeSwitchController, AdminThemeSwitchController],
      providers: [throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, { provide: ThemeSwitchService, useValue: w.themes }],
    }).compile();
    app = mod.createNestApplication({ rawBody: true });
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner') req.user = { sub: 'v1', email: 'o@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-2') req.user = { sub: 'v2', email: 'o2@x.invalid', role: 'VENDOR' };
      else if (p === 'member') req.user = { sub: 'v1', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', modules: ['website', 'accounts', 'wallet'] };
      else if (p) req.user = { sub: 'staff-1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init(); await w.vendor('v1', 500_000); await w.vendor('v2', 500_000);
  });
  afterEach(async () => { await app.close(); });

  describe('vendor routes (/v3/me/site/theme), owner only', () => {
    it('preview draws the theme and says what it would cost, and stores nothing', async () => {
      const before = JSON.stringify([w.themeStore.rows, w.store.ledger]);
      const r = await send('/v3/me/site/theme/preview', 'owner', { themeId: 'pro-b' });
      expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ themeId: 'pro-b', fee: { kind: 'FREE_INCLUDED', free: true }, html: expect.stringContaining('pro-b'), previewRef: expect.stringContaining('.') });
      expect(JSON.stringify([w.themeStore.rows, w.store.ledger])).toBe(before);
    });
    it('the first switch is included; the second is charged; the history shows both; the same key is the same switch', async () => {
      const a = await send('/v3/me/site/theme/switch', 'owner', { themeId: 'pro-b', idempotencyKey: key() }); expect(a.status).toBe(200); expect(a.body.data).toMatchObject({ kind: 'FREE_INCLUDED', status: 'APPLIED' });
      const k = key(); const b = await send('/v3/me/site/theme/switch', 'owner', { themeId: 'pro-c', idempotencyKey: k }); expect(b.body.data).toMatchObject({ kind: 'PAID', amountPaise: THEME_FEE_TOTAL, replay: false });
      expect((await send('/v3/me/site/theme/switch', 'owner', { themeId: 'pro-c', idempotencyKey: k })).body.data).toMatchObject({ id: b.body.data.id, replay: true });
      const h = await get('/v3/me/site/theme/history', 'owner'); expect(h.body.data.total).toBe(2); expect(JSON.stringify(h.body)).not.toMatch(/performedById|ledgerEntryId|idempotency|vendorId/);
    });
    it('a team member and an anonymous caller are refused on every route and nothing is changed or charged', async () => {
      for (const [m, url] of [['post', '/v3/me/site/theme/preview'], ['post', '/v3/me/site/theme/switch'], ['get', '/v3/me/site/theme/history']] as const) {
        const r = m === 'get' ? await get(url, 'member') : await send(url, 'member', { themeId: 'pro-b', idempotencyKey: key() }); expect([url, r.status]).toEqual([url, 403]);
        const a = m === 'get' ? await get(url) : await send(url, null, { themeId: 'pro-b', idempotencyKey: key() }); expect([url, a.status]).toEqual([url, 401]);
      }
      expect(w.themeStore.rows).toHaveLength(0); expect(w.pipe.calls.apply).toBe(0);
    });
    it('DTO: a missing theme, a short key and any extra field (vendorId, kind, amountPaise, funding) are 400', async () => {
      for (const bad of [{ themeId: undefined }, { idempotencyKey: 'short' }, { vendorId: 'v2' }, { kind: 'FREE_INCLUDED' }, { amountPaise: 1 }, { funding: 'COMPLIMENTARY' }, { themeId: '' }]) {
        expect([JSON.stringify(bad), (await send('/v3/me/site/theme/switch', 'owner', { themeId: 'pro-b', idempotencyKey: key(), ...bad })).status]).toEqual([JSON.stringify(bad), 400]);
      }
      expect(w.themeStore.rows).toHaveLength(0);
    });
    it('the refusals carry stable codes: the current theme, an unknown theme, a lapsed plan, a short wallet with the shortfall', async () => {
      await send('/v3/me/site/theme/switch', 'owner', { themeId: 'pro-b', idempotencyKey: key() });
      expect((await send('/v3/me/site/theme/switch', 'owner', { themeId: 'pro-b', idempotencyKey: key() })).body.code).toBe('THEME_ALREADY_ACTIVE');
      expect((await send('/v3/me/site/theme/switch', 'owner', { themeId: 'nope-x', idempotencyKey: key() })).body.code).toBe('THEME_NOT_ALLOWED');
      w.plan.level = 'FREE'; w.plan.subscriptionStatus = 'EXPIRED'; expect((await send('/v3/me/site/theme/switch', 'owner', { themeId: 'pro-c', idempotencyKey: key() })).body.code).toBe('THEME_SWITCH_PLAN_STATE'); w.plan.level = 'PRO'; w.plan.subscriptionStatus = 'ACTIVE';
      await w.svc.adjust('v1', { amountPaise: -(500_000 - 10_000), reason: 'test trim of the wallet', idempotencyKey: 'trim-theme-0001' }, { type: 'STAFF', id: 's', ip: null });
      const short = await send('/v3/me/site/theme/switch', 'owner', { themeId: 'pro-c', idempotencyKey: key() }); expect([short.status, short.body.code]).toEqual([409, 'INSUFFICIENT_WALLET']); expect(short.body).toMatchObject({ shortfallPaise: THEME_FEE_TOTAL - 10_000, requiredPaise: THEME_FEE_TOTAL });
    });
    it('vendor 2 sees nothing of vendor 1\'s switches', async () => {
      await send('/v3/me/site/theme/switch', 'owner', { themeId: 'pro-b', idempotencyKey: key() }); expect((await get('/v3/me/site/theme/history', 'owner-2')).body.data.total).toBe(0);
    });
  });

  describe('staff routes', () => {
    const body = (over: object = {}) => ({ themeId: 'pro-b', idempotencyKey: key(), funding: 'COMPLIMENTARY', reason: 'The vendor asked us on a call.', ...over });
    it('MARKETING, a vendor and a team member are refused on every staff route', async () => {
      for (const role of ['MARKETING', 'owner', 'member']) {
        expect([role, (await send('/v3/admin/vendors/v1/site/theme/switch', role, body())).status]).toEqual([role, 403]); expect([role, (await get('/v3/admin/vendors/v1/site/theme/history', role)).status]).toEqual([role, 403]);
        expect([role, (await send('/v3/admin/theme-switches/recover', role, { olderThanMinutes: 30 })).status]).toEqual([role, 403]);
      }
      expect(w.themeStore.rows).toHaveLength(0);
    });
    it('OPERATIONS switches a vendor\'s theme as a gift with a reason; the vendor sees it as done by our team; staff see the detail', async () => {
      const r = await send('/v3/admin/vendors/v1/site/theme/switch', 'OPERATIONS', body()); expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ kind: 'COMPLIMENTARY_STAFF', by: 'OUR_TEAM', reason: 'The vendor asked us on a call.' });
      expect((await get('/v3/me/site/theme/history', 'owner')).body.data.items[0]).toMatchObject({ by: 'OUR_TEAM', kind: 'COMPLIMENTARY_STAFF' });
      expect((await get('/v3/admin/vendors/v1/site/theme/history', 'SUPER_ADMIN')).body.data.items[0]).toMatchObject({ performedById: 'staff-1', reasonRaw: 'The vendor asked us on a call.' });
    });
    it('DTO: a reason is always required, the funding is one of three, and a switch cannot name its own kind or amount', async () => {
      for (const bad of [{ reason: 'no' }, { reason: undefined }, { funding: 'FREE' }, { kind: 'PAID' }, { amountPaise: 1 }]) expect([JSON.stringify(bad), (await send('/v3/admin/vendors/v1/site/theme/switch', 'OPERATIONS', body(bad))).status]).toEqual([JSON.stringify(bad), 400]);
      expect(w.themeStore.rows).toHaveLength(0);
    });
    it('charging the wallet follows the vendor\'s rule; recovery is safe to call when nothing is stuck', async () => {
      await send('/v3/admin/vendors/v1/site/theme/switch', 'OPERATIONS', body({ funding: 'WALLET' })); const b = await send('/v3/admin/vendors/v1/site/theme/switch', 'SUPER_ADMIN', body({ themeId: 'pro-c', funding: 'WALLET' }));
      expect(b.body.data).toMatchObject({ kind: 'PAID', amountPaise: THEME_FEE_TOTAL });
      expect((await send('/v3/admin/theme-switches/recover', 'OPERATIONS', { olderThanMinutes: 30 })).body.data).toEqual({ applied: 0, reversed: 0 }); expect((await send('/v3/admin/theme-switches/recover', 'OPERATIONS', { olderThanMinutes: 0 })).status).toBe(400);
    });
  });
});
