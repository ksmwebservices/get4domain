import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { AuthService } from '../src/auth/auth.service';
import { InMemoryGateway } from '../src/plan-billing/gateway/in-memory.gateway';
import { paiseToDecimal } from '../src/plan-billing/gateway/gateway-core';
import { PaymentSettlementService } from '../src/plan-billing/settlement.service';
import { canonicalOrigin, directoryBase } from '../src/seo-directory/core/url-scheme';
import { V3WalletService } from '../src/v3-wallet/wallet.service';
import { scanRoutes } from './support/route-scan';
import { MemoryBillingRepo } from './support/memory-billing-repo';
import { GST18, V1, walletWorld } from './support/wallet-world';
import { secret, TestGate } from './support/wave3-world';

/** Wave 3 Part J: /auth/me for every principal, the directory host, and the wallet top-up through the payment port. */
const code = (e: unknown): string => ((e as { getResponse?: () => { code?: string } })?.getResponse?.() ?? (e as { response?: { code?: string } })?.response)?.code ?? '';
const err = async (p: Promise<unknown>): Promise<unknown> => { try { await p; } catch (e) { return e; } throw new Error('expected a refusal'); };

describe('GET /auth/me: name and role for every kind of principal', () => {
  const make = () => {
    const prisma = {
      vendor: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === 'v1' ? { id: 'v1', name: 'Asha Kumar', email: 'asha@example.com', industry: 'clinic', isSandbox: false, role: 'VENDOR' } : where.id === 'boot' ? { id: 'boot', name: 'Root', email: 'root@example.com', industry: null, isSandbox: false, role: 'SUPER_ADMIN' } : null) },
      adminTeamMember: { findUnique: async ({ where }: { where: { id: string } }) => ({ m1: { id: 'm1', name: 'Sam Staff', email: 'sam@x.invalid', role: 'MARKETING' }, p1: { id: 'p1', name: 'Pat Partner', email: 'pat@x.invalid', role: 'REFERRAL_PARTNER' } } as Record<string, unknown>)[where.id] ?? null },
      teamMember: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === 't1' ? { name: 'Tia Team' } : null) },
    };
    return new AuthService(prisma as never, {} as never, {} as never);
  };
  it('a vendor gets what it always got, plus its name', async () => {
    expect(await make().meFor({ sub: 'v1', email: 'asha@example.com', role: 'VENDOR' })).toEqual({ id: 'v1', email: 'asha@example.com', name: 'Asha Kumar', industry: 'clinic', isSandbox: false, role: 'VENDOR' });
  });
  it('a vendor team member sees the business but its own name', async () => {
    const r = await make().meFor({ sub: 'v1', email: 't@x.invalid', role: 'VENDOR', kind: 'team_member', memberId: 't1' });
    expect(r).toMatchObject({ id: 'v1', name: 'Tia Team', role: 'VENDOR' });
  });
  it('the seeded admin row keeps working and says its role', async () => {
    expect(await make().meFor({ sub: 'boot', email: 'root@example.com', role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' })).toMatchObject({ name: 'Root', role: 'SUPER_ADMIN', adminRole: 'SUPER_ADMIN' });
  });
  it('a staff member (an admin-team row, not a vendor) gets its name, role and staff role; a label shows beside SALES', async () => {
    expect(await make().meFor({ sub: 'm1', email: 'sam@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: 'MARKETING', staffLabel: 'TELECALLER' })).toEqual({ id: 'm1', email: 'sam@x.invalid', name: 'Sam Staff', industry: null, isSandbox: false, role: 'ADMIN', adminRole: 'MARKETING', staffLabel: 'TELECALLER' });
  });
  it('a referral partner gets role PARTNER and no staff role', async () => {
    const r = await make().meFor({ sub: 'p1', email: 'pat@x.invalid', role: 'PARTNER', kind: 'referral_partner' });
    expect(r).toEqual({ id: 'p1', email: 'pat@x.invalid', name: 'Pat Partner', industry: null, isSandbox: false, role: 'PARTNER' });
    expect(Object.keys(r)).not.toContain('adminRole');
  });
  it('a removed account is a plain 401, never data about another account', async () => {
    const svc = make();
    await expect(svc.meFor({ sub: 'gone', email: 'x', role: 'ADMIN', kind: 'admin_member' })).rejects.toThrow('Account not found');
    await expect(svc.meFor({ sub: 'gone', email: 'x', role: 'VENDOR' })).rejects.toThrow('Account not found');
  });
});

describe('directoryBase: the directory host (pure)', () => {
  const app = 'https://get4domain.com';
  it('is the public app origin and a /directory home while DIRECTORY_PUBLIC_BASE_URL is unset or not a web address (the old behaviour)', () => {
    for (const v of [undefined, '', '   ', 'garbage', 'ftp://directory.example.com', '//directory.example.com', 'directory.example.com']) expect(directoryBase({ DIRECTORY_PUBLIC_BASE_URL: v }, app)).toEqual({ origin: app, homePath: '/directory', dedicated: false });
    expect(directoryBase({}, app)).toEqual({ origin: app, homePath: '/directory', dedicated: false });
  });
  it('is the directory host and a root home when it is set: only the origin of the value is used', () => {
    for (const v of ['https://directory.get4domain.com', 'https://directory.get4domain.com/', 'https://www.directory.get4domain.com/directory?x=1', ' https://directory.get4domain.com ']) expect(directoryBase({ DIRECTORY_PUBLIC_BASE_URL: v }, app)).toEqual({ origin: 'https://directory.get4domain.com', homePath: '/', dedicated: true });
    expect(directoryBase({ DIRECTORY_PUBLIC_BASE_URL: 'http://localhost:3000/x' }, app).origin).toBe(canonicalOrigin('http://localhost:3000'));
  });
});

describe('the wallet top-up through the payment port', () => {
  function world(chosen: 'razorpay' | 'cashfree') {
    const w = walletWorld(); w.store.taxes = GST18; w.bsettings.over = { paymentsMode: 'test', paymentGateway: chosen };
    const gate = new TestGate(w.billingService as never);
    const gws = { razorpay: new InMemoryGateway('razorpay', { signing: secret(), webhook: secret() }), cashfree: new InMemoryGateway('cashfree', { signing: secret(), webhook: secret() }) };
    gate.gws.set('razorpay', gws.razorpay); gate.gws.set('cashfree', gws.cashfree);
    const svc = new V3WalletService(w.store, w.settingsService, w.billingService, gate, w.bus); svc.clock = () => new Date(w.now.t);
    const settlement = new PaymentSettlementService(new MemoryBillingRepo(), w.billingService as never, gate, { invalidate: () => undefined }, svc); settlement.clock = () => new Date(w.now.t);
    let k = 0;
    const topup = async (amountPaise = 50_000) => svc.createTopup('v1', { amountPaise, idempotencyKey: `wave3-topup-${++k}-abcdef` }, V1);
    return { w, svc, gws, gw: gws[chosen], settlement, topup, balance: async () => (await w.store.wallet('v1'))!.balancePaise };
  }
  const hookBody = (gateway: 'razorpay' | 'cashfree', providerOrderId: string, paymentId: string, amountMinor: number) => gateway === 'cashfree'
    ? JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: providerOrderId }, payment: { cf_payment_id: paymentId, payment_status: 'SUCCESS', payment_amount: paiseToDecimal(amountMinor), payment_currency: 'INR' } } })
    : JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: paymentId, order_id: providerOrderId, amount: amountMinor, currency: 'INR', status: 'captured' } } } });

  describe.each(['razorpay', 'cashfree'] as const)('on %s', (name) => {
    it('makes the refill on the chosen gateway for the credit plus GST, and remembers the gateway', async () => {
      const f = world(name); await f.w.open('v1');
      const t = await f.topup();
      expect(t).toMatchObject({ gateway: name, status: 'PENDING', amountPaise: 50_000, creditPaise: 50_000 });
      expect(t.payablePaise).toBe(50_000 + t.taxPaise); expect(t.payablePaise).toBeGreaterThan(50_000);
      expect(t.clientToken).toBe(name === 'cashfree' ? `session_${t.id}` : null); expect(t.keyId).toBe(name === 'razorpay' ? 'rzp_test_inmemory' : null);
      expect(f.gw.orders.get(t.providerOrderId!)!.amountMinor).toBe(t.payablePaise);
      expect(await f.balance()).toBe(0);   // nothing is credited until a payment is confirmed
    });

    it('credits once when the browser confirms and the gateway says the payment succeeded; a second confirm credits nothing', async () => {
      const f = world(name); await f.w.open('v1'); const t = await f.topup();
      const paymentId = name === 'razorpay' ? 'pay_wallet1' : '910001';
      f.gw.addPayment({ paymentId, providerOrderId: t.providerOrderId!, amountMinor: t.payablePaise, currency: 'INR', status: 'SUCCESS' });
      const input = name === 'razorpay' ? { paymentId, signature: f.gw.returnSignature(t.providerOrderId!, paymentId) } : {};
      expect((await f.svc.confirmTopup('v1', t.id, input, V1)).status).toBe('PAID');
      await f.svc.confirmTopup('v1', t.id, input, V1);
      expect(await f.balance()).toBe(50_000);
    });

    it('is still in progress while nothing has been paid (Cashfree), and refuses a missing or wrong Razorpay signature before asking the gateway', async () => {
      const f = world(name); await f.w.open('v1'); const t = await f.topup();
      if (name === 'cashfree') expect(await f.svc.confirmTopup('v1', t.id, {}, V1)).toMatchObject({ pending: true, status: 'PENDING' });
      else for (const input of [{}, { paymentId: 'pay_x1' }, { paymentId: 'pay_x1', signature: secret() + secret() }]) expect(code(await err(f.svc.confirmTopup('v1', t.id, input, V1)))).toBe('PAYMENT_SIGNATURE_INVALID');
      expect(await f.balance()).toBe(0);
    });

    it('a signed webhook credits the refill, a replay credits nothing, and the browser confirm after it credits nothing', async () => {
      const f = world(name); await f.w.open('v1'); const t = await f.topup();
      const paymentId = name === 'razorpay' ? 'pay_hook_w1' : '910002'; const raw = hookBody(name, t.providerOrderId!, paymentId, t.payablePaise);
      const headers = f.gw.signedHeaders(raw, f.w.now.t, 'evt_wallet_001');
      expect(await f.settlement.handleGatewayWebhook(name, raw, headers)).toMatchObject({ status: 'OK', result: 'TOPUP_CREDITED' });
      expect(await f.settlement.handleGatewayWebhook(name, raw, headers)).toMatchObject({ status: 'OK', duplicate: true });
      expect(await f.balance()).toBe(50_000);
      f.gw.addPayment({ paymentId, providerOrderId: t.providerOrderId!, amountMinor: t.payablePaise, currency: 'INR', status: 'SUCCESS' });
      await f.svc.confirmTopup('v1', t.id, name === 'razorpay' ? { paymentId, signature: f.gw.returnSignature(t.providerOrderId!, paymentId) } : {}, V1);
      expect(await f.balance()).toBe(50_000);
    });

    it('a webhook with a bad signature credits nothing; a wrong amount credits nothing', async () => {
      const f = world(name); await f.w.open('v1'); const t = await f.topup();
      const raw = hookBody(name, t.providerOrderId!, name === 'razorpay' ? 'pay_bad_w1' : '910003', t.payablePaise);
      expect(await f.settlement.handleGatewayWebhook(name, raw, f.gw.signedHeaders(raw + ' x', f.w.now.t))).toEqual({ status: 'BAD_SIGNATURE' });
      const small = hookBody(name, t.providerOrderId!, name === 'razorpay' ? 'pay_bad_w2' : '910004', 100);
      const r = await f.settlement.handleGatewayWebhook(name, small, f.gw.signedHeaders(small, f.w.now.t, 'evt_wallet_002'));
      expect(r.status).toBe('OK'); expect(r.result).not.toBe('TOPUP_CREDITED');
      expect(await f.balance()).toBe(0);
    });
  });

  it('a payment reported by the OTHER gateway credits nothing', async () => {
    const f = world('cashfree'); await f.w.open('v1'); const t = await f.topup();
    const raw = hookBody('razorpay', t.providerOrderId!, 'pay_cross_w1', t.payablePaise);
    const r = await f.settlement.handleGatewayWebhook('razorpay', raw, f.gws.razorpay.signedHeaders(raw, f.w.now.t, 'evt_wallet_003'));
    expect(r.result).toBe('TOPUP_GATEWAY_MISMATCH'); expect(await f.balance()).toBe(0);
  });

  it('switching the gateway never moves a refill that is in flight', async () => {
    const f = world('razorpay'); await f.w.open('v1'); const t = await f.topup();
    f.w.bsettings.over = { ...f.w.bsettings.over, paymentGateway: 'cashfree' };
    const paymentId = 'pay_inflight_w'; f.gws.razorpay.addPayment({ paymentId, providerOrderId: t.providerOrderId!, amountMinor: t.payablePaise, currency: 'INR', status: 'SUCCESS' });
    expect((await f.svc.confirmTopup('v1', t.id, { paymentId, signature: f.gws.razorpay.returnSignature(t.providerOrderId!, paymentId) }, V1)).status).toBe('PAID');
    expect((await f.topup()).gateway).toBe('cashfree');
  });

  it('with payments off a refill is refused before any row exists', async () => {
    const f = world('cashfree'); await f.w.open('v1'); f.w.bsettings.over = { ...f.w.bsettings.over, paymentsMode: 'off' };
    expect(code(await err(f.topup()))).toBe('PAYMENTS_DISABLED'); expect(f.w.store.topups.size).toBe(0);
  });

  it('there is no refund and no cash-out anywhere on the wallet routes', () => {
    const routes = scanRoutes(path.resolve(__dirname, '../src')).filter((r) => /^\S+ \/v3\/(me\/wallet|admin\/wallets|me\/plan\/renew-with-wallet)/.test(r.route));
    expect(routes.length).toBeGreaterThanOrEqual(15);
    expect(routes.filter((r) => /refund|withdraw|payout|cash-?out|transfer|redeem/i.test(r.route)).map((r) => r.route)).toEqual([]);
    const text = fs.readFileSync(path.resolve(__dirname, '../src/v3-wallet/wallet.service.ts'), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    expect(text).not.toMatch(/\b(refund|withdraw|cashOut|payoutTo)\w*\s*\(/i);
  });
});
