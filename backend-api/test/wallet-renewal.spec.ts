import { HttpException } from '@nestjs/common';
import { DEFAULT_BILLING_SETTINGS } from '../src/plan-billing/settings/billing-settings';
import { PaymentSettlementService } from '../src/plan-billing/settlement.service';
import { PlanRenewalService } from '../src/v3-wallet/plan-renewal.service';
import { postEntry } from '../src/v3-wallet/wallet-engine';
import { billingWorld, BillingWorld, currentOf, VENDOR } from './support/billing-world';
import { walletWorld, WalletWorld } from './support/wallet-world';

/**
 * Slice 5.16a-2: renewing a plan from the wallet. The charge, the PAID order, the term and the invoice commit together; a term that cannot start gives the money back with a REVERSAL
 * entry; the online (Razorpay) path and its tests are untouched; the amount is exactly the online amount (one shared quote).
 */
let bw: BillingWorld; let ww: WalletWorld; let settlement: PaymentSettlementService; let renewal: PlanRenewalService;
const act = { type: 'SYSTEM' as const, id: null };
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string; body: Record<string, unknown> }> => {
  try { await p; } catch (e) { if (e instanceof HttpException) { const b = e.getResponse() as Record<string, unknown>; return { status: e.getStatus(), code: b.code as string | undefined, body: b }; } throw e; }
  throw new Error('expected a refusal');
};
const input = (over: Record<string, unknown> = {}) => ({ planKey: 'handyman_pro', termMonths: 3, idempotencyKey: `renew-key-${Math.random().toString(36).slice(2, 12)}`, ...over });
const fundWallet = async (amount: number) => { await ww.open('v1'); await ww.store.unit('v1', (tx) => postEntry(tx, { kind: 'TOPUP', amountPaise: amount, idempotencyKey: `seed-${amount}-${Math.random()}`, actor: act, now: ww.clock(), validityDays: 365 })); };

beforeEach(() => {
  bw = billingWorld(); ww = walletWorld({ fake: bw.fake }); ww.now.t = bw.now.t;
  bw.repo.walletTxFor = (v) => Promise.resolve(ww.store.txFor(v)); bw.repo.walletSnapshot = () => ww.store.capture();
  const billingSettings = { get: async () => ({ ...DEFAULT_BILLING_SETTINGS, graceDays: 7, upgradeProration: 'NONE', renewalReminderDays: [14, 7, 1], paymentsMode: 'test' }) } as never;
  settlement = new PaymentSettlementService(bw.repo, billingSettings, bw.gate, { invalidate: (v: string) => { bw.invalidated.push(v); } }, undefined, ww.bus); settlement.clock = () => new Date(bw.now.t);
  renewal = new PlanRenewalService(bw.repo, bw.orders, settlement, ww.svc, ww.settingsService, billingSettings); renewal.clock = () => new Date(bw.now.t);
});

describe('a renewal paid from the wallet', () => {
  it('charges the exact plan price once, marks the order PAID with source WALLET, starts the term and writes the invoice, all together', async () => {
    await fundWallet(500_000);
    const r = await renewal.renew('v1', input(), VENDOR);
    expect(r).toMatchObject({ status: 'PAID', paidWith: 'WALLET', planKey: 'handyman_pro', termMonths: 3, amountPaise: 354_000, replay: false, wallet: { balancePaise: 146_000, availablePaise: 146_000 } });
    expect(await ww.store.wallet('v1')).toMatchObject({ balancePaise: 146_000, heldPaise: 0 });
    const entry = ww.store.ledger.find((e) => e.kind === 'PLAN_RENEWAL')!;
    expect(entry).toMatchObject({ amountPaise: -354_000, refType: 'plan_order', refId: r.orderId });
    const order = bw.repo.orders.get(r.orderId)!;
    expect(order).toMatchObject({ status: 'PAID', source: 'WALLET', paidAmountPaise: 354_000, paymentId: `wallet:${entry.id}` });
    const sub = currentOf(bw); expect(bw.repo.plans.get(sub.planId)!.key).toBe('handyman_pro'); expect(sub).toMatchObject({ source: 'SELF', termMonths: 3 });
    expect(bw.repo.invoices).toHaveLength(1); expect(bw.repo.invoices[0]).toMatchObject({ orderId: r.orderId, invoiceNumber: 'INV/2026-27/000001' });
    expect(bw.repo.invoices[0].snapshot).toMatchObject({ order: { via: 'WALLET' }, amountPaise: 354_000 });
    expect(await ww.svc.reconcileVendor('v1')).toMatchObject({ ok: true });
    expect(bw.invalidated).toContain('v1');
    await new Promise((res) => setImmediate(res));
    expect(ww.events.some((e) => e.type === 'plan.order.paid')).toBe(true);
  });

  it('charges exactly what the online order would have charged (one shared quote)', async () => {
    await fundWallet(1_000_000);   // a 6-month term is 637,200 paise with tax
    const online = await bw.buy({ planKey: 'handyman_pro', termMonths: 6 });
    const wallet = await renewal.renew('v1', input({ termMonths: 6 }), VENDOR);
    expect(wallet.amountPaise).toBe(online.amountPaise);
  });

  it('works while online payments are switched off, and after the plan has run out (the balance is kept)', async () => {
    await fundWallet(500_000);
    bw.settings.over = { paymentsMode: 'off' };
    const s = currentOf(bw); s.planId = bw.ids.pro; s.endsAt = new Date(bw.now.t.getTime() - 40 * 86_400_000); s.graceEndsAt = new Date(bw.now.t.getTime() - 30 * 86_400_000); s.termMonths = 3;
    const r = await renewal.renew('v1', input(), VENDOR);
    expect(r.status).toBe('PAID'); expect(currentOf(bw).endsAt!.getTime()).toBeGreaterThan(bw.now.t.getTime());
  });

  it('spends the oldest lot first', async () => {
    await ww.open('v1');
    await ww.fund('v1', 200_000); ww.now.t = new Date(ww.now.t.getTime() + 86_400_000); bw.now.t = ww.now.t; await ww.fund('v1', 300_000);
    await renewal.renew('v1', input(), VENDOR);
    const lots = (await ww.store.lots('v1')).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    expect(lots.map((l) => l.remainingPaise)).toEqual([0, 146_000]);
  });
});

describe('when the wallet cannot pay', () => {
  it('a short wallet is a 409 INSUFFICIENT_WALLET with the exact shortfall and the top-up that covers it, and NOTHING is left behind', async () => {
    await fundWallet(100_000);
    const r = await codeOf(renewal.renew('v1', input(), VENDOR));
    expect([r.status, r.code]).toEqual([409, 'INSUFFICIENT_WALLET']);
    expect(r.body).toMatchObject({ shortfallPaise: 254_000, availablePaise: 100_000, requiredPaise: 354_000, suggestedTopupPaise: 254_000, minTopupPaise: 10_000, maxTopupPaise: 1_000_000 });
    expect(bw.repo.orders.size).toBe(0); expect(bw.repo.invoices).toHaveLength(0); expect(ww.store.ledger.filter((e) => e.kind === 'PLAN_RENEWAL')).toHaveLength(0);
    expect((await ww.store.wallet('v1'))!.balancePaise).toBe(100_000);
    expect(bw.repo.plans.get(currentOf(bw).planId)!.key).toBe('handyman_free');
  });
  it('after a top-up the same request key works (no order was left to block it)', async () => {
    await fundWallet(100_000); const body = input({ idempotencyKey: 'renew-key-retry-0001' });
    await codeOf(renewal.renew('v1', body, VENDOR));
    await ww.fund('v1', 300_000);
    expect((await renewal.renew('v1', body, VENDOR)).status).toBe('PAID');
  });
  it('held money is not spendable: a wallet whose balance is held is short', async () => {
    await fundWallet(400_000);
    await ww.store.unit('v1', (tx) => postEntry(tx, { kind: 'HOLD', amountPaise: 100_000, idempotencyKey: 'hold-for-renew-1', actor: act, now: ww.clock() }));
    expect((await codeOf(renewal.renew('v1', input(), VENDOR))).body).toMatchObject({ shortfallPaise: 54_000, availablePaise: 300_000 });
  });
  it('a vendor with no active wallet (Free so far) and a frozen wallet are refused with their own codes', async () => {
    expect((await codeOf(renewal.renew('v1', input(), VENDOR))).code).toBe('WALLET_NOT_ACTIVE');
    await fundWallet(500_000); await ww.svc.setFrozen('v1', { frozen: true, reason: 'chargeback review' }, { type: 'STAFF', id: 's', ip: null });
    expect((await codeOf(renewal.renew('v1', input(), VENDOR))).code).toBe('WALLET_FROZEN');
    expect(bw.repo.orders.size).toBe(0);
  });
});

describe('the same rules as buying online', () => {
  it('a plan that cannot be bought, a term that is not offered and a cheaper plan mid-term are refused with the same codes', async () => {
    await fundWallet(5_000_000);
    expect((await codeOf(renewal.renew('v1', input({ planKey: 'nope_pro' }), VENDOR))).code).toBe('PLAN_NOT_PURCHASABLE');
    expect((await codeOf(renewal.renew('v1', input({ termMonths: 5 }), VENDOR))).code).toBe('TERM_NOT_OFFERED');
    expect((await codeOf(renewal.renew('v1', input({ planKey: 'handyman_free' }), VENDOR))).code).toBe('PLAN_NOT_PURCHASABLE');
    await renewal.renew('v1', input({ planKey: 'handyman_plus' }), VENDOR);
    expect((await codeOf(renewal.renew('v1', input({ planKey: 'handyman_pro' }), VENDOR))).code).toBe('PLAN_CHANGE_NOT_ALLOWED');
  });
  it('a bad request key is refused', async () => {
    await fundWallet(500_000);
    expect((await codeOf(renewal.renew('v1', input({ idempotencyKey: 'short' }), VENDOR))).code).toBe('IDEMPOTENCY_CONFLICT');
  });
});

describe('exactly once', () => {
  it('the same key twice returns the first result; one charge, one term, one invoice', async () => {
    await fundWallet(500_000); const body = input({ idempotencyKey: 'renew-key-once-0001' });
    const a = await renewal.renew('v1', body, VENDOR); const b = await renewal.renew('v1', body, VENDOR);
    expect(b).toMatchObject({ orderId: a.orderId, replay: true, status: 'PAID' });
    expect(ww.store.ledger.filter((e) => e.kind === 'PLAN_RENEWAL')).toHaveLength(1); expect(bw.repo.invoices).toHaveLength(1);
    expect((await ww.store.wallet('v1'))!.balancePaise).toBe(146_000);
  });
  it('twelve parallel submits of one key charge once', async () => {
    await fundWallet(500_000); const body = input({ idempotencyKey: 'renew-key-race-0001' });
    const rs = await Promise.all(Array.from({ length: 12 }, () => renewal.renew('v1', body, VENDOR)));
    expect(new Set(rs.map((r) => r.orderId)).size).toBe(1); expect(rs.filter((r) => !r.replay)).toHaveLength(1);
    expect(ww.store.ledger.filter((e) => e.kind === 'PLAN_RENEWAL')).toHaveLength(1); expect((await ww.store.wallet('v1'))!.balancePaise).toBe(146_000);
  });
  it('a key already used for a different plan is refused', async () => {
    await fundWallet(5_000_000); const k = 'renew-key-mixed-0001';
    await renewal.renew('v1', input({ idempotencyKey: k }), VENDOR);
    expect((await codeOf(renewal.renew('v1', input({ idempotencyKey: k, planKey: 'handyman_plus' }), VENDOR))).code).toBe('IDEMPOTENCY_CONFLICT');
  });
  it('a key used by an ONLINE order is not reused for a wallet renewal', async () => {
    await fundWallet(5_000_000); const online = await bw.buy({ planKey: 'handyman_pro', termMonths: 3, idempotencyKey: 'renew-key-online-001' });
    expect(online.id).toBeTruthy();
    expect((await codeOf(renewal.renew('v1', input({ idempotencyKey: 'renew-key-online-001' }), VENDOR))).code).toBe('IDEMPOTENCY_CONFLICT');
  });
  it('another vendor cannot see or replay the first vendor\'s key: it is theirs alone', async () => {
    await fundWallet(500_000); await ww.open('v2'); await ww.store.unit('v2', (tx) => postEntry(tx, { kind: 'TOPUP', amountPaise: 500_000, idempotencyKey: 'seed-v2-0001', actor: act, now: ww.clock() }));
    const k = 'renew-key-shared-001';
    const a = await renewal.renew('v1', input({ idempotencyKey: k }), VENDOR); const b = await renewal.renew('v2', input({ idempotencyKey: k }), { type: 'VENDOR', id: 'v2', ip: null });
    expect(a.orderId).not.toBe(b.orderId); expect((await ww.store.wallet('v2'))!.balancePaise).toBe(146_000);
  });
});

describe('when the term cannot start', () => {
  it('the charge is given back with a REVERSAL entry, the order is closed, the plan is unchanged and the vendor is told nothing was charged', async () => {
    await fundWallet(500_000); bw.repo.failAssignOnce = true;
    const r = await codeOf(renewal.renew('v1', input(), VENDOR));
    expect([r.status, r.code]).toEqual([409, 'WALLET_RENEWAL_INVALID']);
    expect(r.body.message).toMatch(/nothing was charged/i);
    expect((await ww.store.wallet('v1'))!.balancePaise).toBe(500_000);
    const kinds = ww.store.ledger.map((e) => e.kind); expect(kinds.filter((k) => k === 'PLAN_RENEWAL')).toHaveLength(1); expect(kinds.filter((k) => k === 'REVERSAL')).toHaveLength(1);
    const rev = ww.store.ledger.find((e) => e.kind === 'REVERSAL')!; expect(rev.reversesId).toBe(ww.store.ledger.find((e) => e.kind === 'PLAN_RENEWAL')!.id);
    expect([...bw.repo.orders.values()].map((o) => o.status)).toEqual(['CANCELLED']);
    expect(bw.repo.plans.get(currentOf(bw).planId)!.key).toBe('handyman_free'); expect(bw.repo.invoices).toHaveLength(0);
    expect(await ww.svc.reconcileVendor('v1')).toMatchObject({ ok: true });
  });
  it('the same key after that failure says so again and charges nothing; a NEW key works and charges once', async () => {
    await fundWallet(500_000); bw.repo.failAssignOnce = true; const body = input({ idempotencyKey: 'renew-key-fail-0001' });
    await codeOf(renewal.renew('v1', body, VENDOR));
    const same = await codeOf(renewal.renew('v1', body, VENDOR));
    expect([same.status, same.code]).toEqual([409, 'WALLET_RENEWAL_INVALID']); expect(same.body.message).toMatch(/new request key/i);
    expect((await ww.store.wallet('v1'))!.balancePaise).toBe(500_000);
    const again = await renewal.renew('v1', input({ idempotencyKey: 'renew-key-fail-0002' }), VENDOR); expect(again.status).toBe('PAID');
    expect((await ww.store.wallet('v1'))!.balancePaise).toBe(146_000);
  });
  it('a crash in the middle of the unit leaves no trace at all (the wallet and the plan are rolled back together)', async () => {
    await fundWallet(500_000); const before = JSON.stringify([await ww.store.wallet('v1'), ww.store.ledger]);
    ww.store.failCommitOnce = true;
    await expect(renewal.renew('v1', input(), VENDOR)).rejects.toThrow(/simulated crash/);
    expect(JSON.stringify([await ww.store.wallet('v1'), ww.store.ledger])).toBe(before);
    expect(bw.repo.orders.size).toBe(0); expect(bw.repo.invoices).toHaveLength(0); expect(bw.repo.plans.get(currentOf(bw).planId)!.key).toBe('handyman_free');
  });
});
