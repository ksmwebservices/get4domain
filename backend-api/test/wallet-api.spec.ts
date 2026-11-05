import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { Public } from '../src/common/decorators/public.decorator';
import { WalletRuleError } from '../src/v3-wallet/core/wallet-core';
import { AdminWalletController, MePlanRenewController, MeWalletController } from '../src/v3-wallet/api/wallet.controllers';
import { PlanRenewalService } from '../src/v3-wallet/plan-renewal.service';
import { walletHttpError } from '../src/v3-wallet/wallet.errors';
import { V3WalletService } from '../src/v3-wallet/wallet.service';
import { walletWorld, WalletWorld } from './support/wallet-world';

/** Slices 5.16a / 5.16a-2 over HTTP with the real guards, pipe, filter and interceptor; the service is the real one over the in-memory store and the fake provider. */
jest.setTimeout(180_000);

/** A test-only door that spends too much, to prove the exception filter hands the shortfall to a client. Not part of the product. */
@Controller('test-only')
class ShortfallDoor {
  @Public() @Get('short') short(): never { throw walletHttpError(new WalletRuleError('INSUFFICIENT_WALLET', 'x', { shortfallPaise: 3_000, availablePaise: 7_000, requiredPaise: 10_000 }), { minPaise: 10_000, maxPaise: 1_000_000 }); }
  @Public() @Get('short-unset') shortUnset(): never { throw walletHttpError(new WalletRuleError('INSUFFICIENT_WALLET', 'x', { shortfallPaise: 3_000 })); }
}

describe('wallet API', () => {
  let app: INestApplication; let w: WalletWorld; const renewCalls: Array<{ vendorId: string; input: Record<string, unknown>; actor: Record<string, unknown> }> = [];
  const as = (role: string) => ({ 'x-test-principal': role });
  const get = (url: string, role?: string) => { const r = request(app.getHttpServer()).get(url); return role ? r.set(as(role)) : r; };
  const send = (m: 'post' | 'put', url: string, role: string | null, body: object = {}) => { const r = request(app.getHttpServer())[m](url); return (role ? r.set(as(role)) : r).send(body); };
  const key = (() => { let n = 0; return () => `http-key-${++n}-abcdefgh`; })();

  beforeEach(async () => {
    w = walletWorld();
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [MeWalletController, MePlanRenewController, AdminWalletController, ShortfallDoor],
      providers: [throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, { provide: V3WalletService, useValue: w.svc },
        { provide: PlanRenewalService, useValue: { renew: async (vendorId: string, input: Record<string, unknown>, actor: Record<string, unknown>) => { renewCalls.push({ vendorId, input, actor }); return { orderId: 'o1', status: 'PAID', paidWith: 'WALLET' }; } } }],
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
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  describe('vendor routes (/v3/me/wallet), owner only', () => {
    it('a Free vendor gets a locked preview, not an error', async () => {
      const r = await get('/v3/me/wallet', 'owner');
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ status: 'INACTIVE', locked: true, lockedReason: 'NO_PAID_PRO_TERM', balancePaise: 0, availablePaise: 0, topup: { enabled: false } });
    });
    it('an active wallet shows balance, held, available and the staff limits', async () => {
      await w.open('v1'); await w.fund('v1', 50_000);
      const r = await get('/v3/me/wallet', 'owner');
      expect(r.body.data).toMatchObject({ status: 'ACTIVE', locked: false, balancePaise: 50_000, heldPaise: 0, availablePaise: 50_000, creditValidityDays: 365, topup: { enabled: true, minPaise: 10_000, maxPaise: 1_000_000 } });
    });
    it('create then confirm over HTTP credits once; the ledger and the top-up list show it; a Free vendor cannot create', async () => {
      expect((await send('post', '/v3/me/wallet/topups', 'owner', { amountPaise: 20_000, idempotencyKey: key() })).body.code).toBe('WALLET_NOT_ACTIVE');
      await w.open('v1');
      const c = await send('post', '/v3/me/wallet/topups', 'owner', { amountPaise: 20_000, idempotencyKey: key() });
      expect(c.status).toBe(200); expect(c.body.data).toMatchObject({ status: 'PENDING', amountPaise: 20_000, keyId: 'rzp_test_fakekey' });
      expect(JSON.stringify(c.body)).not.toMatch(/secret|vendorId|idempotency/);
      const p = w.fake.pay(c.body.data.providerOrderId);
      const ok = await send('post', `/v3/me/wallet/topups/${c.body.data.id}/confirm`, 'owner', { paymentId: p.paymentId, signature: p.signature });
      expect(ok.status).toBe(200); expect(ok.body.data.status).toBe('PAID');
      expect((await get('/v3/me/wallet/ledger', 'owner')).body.data.items[0]).toMatchObject({ kind: 'TOPUP', amountPaise: 20_000, balanceAfterPaise: 20_000 });
      expect((await get('/v3/me/wallet/topups', 'owner')).body.data.total).toBe(1);
    });
    it('a team member is refused on every route, even with the accounts and wallet areas', async () => {
      await w.open('v1');
      for (const [m, url, body] of [['get', '/v3/me/wallet'], ['get', '/v3/me/wallet/ledger'], ['get', '/v3/me/wallet/topups'], ['post', '/v3/me/wallet/topups', { amountPaise: 20_000, idempotencyKey: key() }],
        ['post', '/v3/me/wallet/topups/x/confirm', { paymentId: 'pay_x', signature: 'a'.repeat(64) }], ['put', '/v3/me/wallet/billing-profile', { stateCode: '33' }]] as Array<[string, string, object?]>) {
        const r = m === 'get' ? await get(url, 'member') : await send(m as 'post' | 'put', url, 'member', body ?? {});
        expect([m, url, r.status]).toEqual([m, url, 403]);
      }
    });
    it('an anonymous caller is refused', async () => { expect((await get('/v3/me/wallet')).status).toBe(401); });
    it('DTO: a bad amount, a short key, a malformed payment id or signature, and any extra field (vendorId, balance) are 400', async () => {
      await w.open('v1');
      for (const bad of [{ amountPaise: 'ten' }, { amountPaise: 0 }, { amountPaise: -5 }, { amountPaise: 20_000.5 }, { idempotencyKey: 'short' }, { idempotencyKey: 'has spaces in it!!' }, { vendorId: 'v2' }, { balancePaise: 1 }]) {
        expect([JSON.stringify(bad), (await send('post', '/v3/me/wallet/topups', 'owner', { amountPaise: 20_000, idempotencyKey: key(), ...bad })).status]).toEqual([JSON.stringify(bad), 400]);
      }
      for (const bad of [{ paymentId: 'x', signature: 'a'.repeat(64) }, { paymentId: 'pay_x', signature: 'short' }, { paymentId: 'pay_x', signature: 'a'.repeat(64), amount: 1 }, {}]) {
        expect([JSON.stringify(bad), (await send('post', '/v3/me/wallet/topups/anything/confirm', 'owner', bad)).status]).toEqual([JSON.stringify(bad), 400]);
      }
      expect((await send('put', '/v3/me/wallet/billing-profile', 'owner', { stateCode: '33', vendorId: 'v2' })).status).toBe(400);
    });
    it('the amount is judged against the staff limits (400 with the limits) and a missing limit is a plain 409', async () => {
      await w.open('v1');
      const low = await send('post', '/v3/me/wallet/topups', 'owner', { amountPaise: 9_999, idempotencyKey: key() });
      expect(low.status).toBe(400); expect(low.body).toMatchObject({ code: 'WALLET_TOPUP_AMOUNT_INVALID' });
      w.wsettings.over = {};
      const none = await send('post', '/v3/me/wallet/topups', 'owner', { amountPaise: 20_000, idempotencyKey: key() });
      expect(none.status).toBe(409); expect(none.body.code).toBe('WALLET_TOPUP_NOT_CONFIGURED');
    });
    it('vendor 2 cannot confirm vendor 1\'s top-up: the same answer as for one that does not exist', async () => {
      await w.open('v1'); await w.open('v2');
      const c = await send('post', '/v3/me/wallet/topups', 'owner', { amountPaise: 20_000, idempotencyKey: key() });
      const p = w.fake.pay(c.body.data.providerOrderId);
      const cross = await send('post', `/v3/me/wallet/topups/${c.body.data.id}/confirm`, 'owner-2', { paymentId: p.paymentId, signature: p.signature });
      const missing = await send('post', '/v3/me/wallet/topups/nope/confirm', 'owner-2', { paymentId: p.paymentId, signature: p.signature });
      expect([cross.status, cross.body.code, cross.body.message]).toEqual([missing.status, missing.body.code, missing.body.message]);
      expect(cross.status).toBe(404);
    });
  });

  describe('plan renewal from the wallet (/v3/me/plan/renew-with-wallet), owner only', () => {
    const body = (over: object = {}) => ({ planKey: 'handyman_pro', termMonths: 3, idempotencyKey: key(), ...over });
    beforeEach(() => { renewCalls.length = 0; });
    it('the owner is served, and the vendor is the signed-in one, never one named in the body', async () => {
      const r = await send('post', '/v3/me/plan/renew-with-wallet', 'owner', body());
      expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ status: 'PAID', paidWith: 'WALLET' });
      expect(renewCalls).toHaveLength(1); expect(renewCalls[0].vendorId).toBe('v1'); expect(renewCalls[0].actor).toMatchObject({ type: 'VENDOR', id: 'v1' });
      expect((await send('post', '/v3/me/plan/renew-with-wallet', 'owner', body({ vendorId: 'v2' }))).status).toBe(400);
      expect(renewCalls).toHaveLength(1);
    });
    it('a team member and an anonymous caller are refused and nothing is spent', async () => {
      expect((await send('post', '/v3/me/plan/renew-with-wallet', 'member', body())).status).toBe(403);
      expect((await send('post', '/v3/me/plan/renew-with-wallet', null, body())).status).toBe(401);
      expect((await send('post', '/v3/admin/wallets/expiry-run', 'owner')).status).toBe(403);
      expect(renewCalls).toHaveLength(0);
    });
    it('DTO: a bad term, a short key, a bad plan key and any extra field (amount, price) are 400', async () => {
      for (const bad of [{ termMonths: 5 }, { termMonths: 1 }, { termMonths: '3x' }, { idempotencyKey: 'short' }, { idempotencyKey: 'has spaces in it!!' }, { planKey: 'Handyman Pro' }, { amountPaise: 1 }, { amount: 1 }, { price: 1 }]) {
        expect([JSON.stringify(bad), (await send('post', '/v3/me/plan/renew-with-wallet', 'owner', body(bad))).status]).toEqual([JSON.stringify(bad), 400]);
      }
      expect(renewCalls).toHaveLength(0);
    });
  });

  describe('INSUFFICIENT_WALLET reaches the client with the exact numbers', () => {
    it('carries the shortfall, the top-up that covers it and the limits when the staff limits are set', async () => {
      const r = await get('/test-only/short');
      expect(r.status).toBe(409);
      expect(r.body).toMatchObject({ success: false, code: 'INSUFFICIENT_WALLET', shortfallPaise: 3_000, suggestedTopupPaise: 10_000, minTopupPaise: 10_000, maxTopupPaise: 1_000_000, availablePaise: 7_000, requiredPaise: 10_000 });
      expect(r.body.data).toMatchObject({ code: 'INSUFFICIENT_WALLET', shortfallPaise: 3_000 });
    });
    it('carries only the shortfall when the limits are not set (no invented suggestion)', async () => {
      const r = await get('/test-only/short-unset');
      expect(r.body).toMatchObject({ code: 'INSUFFICIENT_WALLET', shortfallPaise: 3_000 });
      expect(Object.keys(r.body)).not.toContain('suggestedTopupPaise');
    });
  });

  describe('staff routes (/v3/admin/wallets)', () => {
    beforeEach(async () => { await w.open('v1'); await w.fund('v1', 100_000); });
    const reads = ['/v3/admin/wallets', '/v3/admin/wallets/reconciliation', '/v3/admin/wallets/v1', '/v3/admin/wallets/v1/ledger', '/v3/admin/wallets/v1/reconcile'];

    it('MARKETING is refused on every route (a wallet is money)', async () => {
      for (const url of reads) expect([url, (await get(url, 'MARKETING')).status]).toEqual([url, 403]);
      expect((await send('post', '/v3/admin/wallets/expiry-run', 'MARKETING')).status).toBe(403);
      expect((await send('post', '/v3/admin/wallets/v1/adjustments', 'MARKETING', { amountPaise: 1_000, reason: 'goodwill credit', idempotencyKey: key() })).status).toBe(403);
      expect((await send('put', '/v3/admin/wallets/v1/frozen', 'MARKETING', { frozen: true, reason: 'chargeback review' })).status).toBe(403);
    });
    it('a vendor and a team member are refused', async () => {
      for (const role of ['owner', 'member']) expect((await get('/v3/admin/wallets', role)).status).toBe(403);
    });
    it('OPERATIONS reads, runs the reconciliation and the expiry, but cannot adjust or freeze', async () => {
      for (const url of reads) expect([url, (await get(url, 'OPERATIONS')).status]).toEqual([url, 200]);
      expect((await send('post', '/v3/admin/wallets/expiry-run', 'OPERATIONS')).status).toBe(200);
      expect((await send('post', '/v3/admin/wallets/v1/adjustments', 'OPERATIONS', { amountPaise: 1_000, reason: 'goodwill credit', idempotencyKey: key() })).status).toBe(403);
      expect((await send('put', '/v3/admin/wallets/v1/frozen', 'OPERATIONS', { frozen: true, reason: 'chargeback review' })).status).toBe(403);
      expect((await w.store.wallet('v1'))!.balancePaise).toBe(100_000);
    });
    it('SUPER_ADMIN adjusts with a reason (audited, idempotent) and freezes; a short reason is a 400', async () => {
      const k = key();
      const a = await send('post', '/v3/admin/wallets/v1/adjustments', 'SUPER_ADMIN', { amountPaise: -25_000, reason: 'duplicate credit removed', idempotencyKey: k });
      expect(a.status).toBe(200); expect(a.body.data).toMatchObject({ replay: false, entry: { kind: 'ADJUSTMENT', amountPaise: -25_000, balanceAfterPaise: 75_000 } });
      expect((await send('post', '/v3/admin/wallets/v1/adjustments', 'SUPER_ADMIN', { amountPaise: -25_000, reason: 'duplicate credit removed', idempotencyKey: k })).body.data.replay).toBe(true);
      expect((await w.store.wallet('v1'))!.balancePaise).toBe(75_000);
      expect((await send('post', '/v3/admin/wallets/v1/adjustments', 'SUPER_ADMIN', { amountPaise: -1_000, reason: 'no', idempotencyKey: key() })).status).toBe(400);
      expect((await send('post', '/v3/admin/wallets/v1/adjustments', 'SUPER_ADMIN', { amountPaise: -9_000_000, reason: 'far too much', idempotencyKey: key() })).status).toBe(409);
      expect((await send('put', '/v3/admin/wallets/v1/frozen', 'SUPER_ADMIN', { frozen: true, reason: 'chargeback review' })).body.data.status).toBe('FROZEN');
      expect((await get('/v3/admin/wallets?status=FROZEN', 'OPERATIONS')).body.data.total).toBe(1);
      expect((await get('/v3/admin/wallets/v1', 'OPERATIONS')).body.data).toMatchObject({ status: 'FROZEN', frozenReason: 'chargeback review', lots: [{ status: 'OPEN' }] });
    });
    it('a wallet that does not exist is a plain 404 and the reconciliation flags a tampered cache', async () => {
      expect((await get('/v3/admin/wallets/nobody', 'OPERATIONS')).status).toBe(404);
      w.store.tamperWallet('v1', { balancePaise: 5 });
      const r = await get('/v3/admin/wallets/reconciliation', 'OPERATIONS');
      expect(r.body.data).toMatchObject({ scanned: 1, mismatches: 1, wallets: [{ vendorId: 'v1' }] });
    });
  });
});
