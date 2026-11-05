import { HttpException } from '@nestjs/common';
import { postEntry } from '../src/v3-wallet/wallet-engine';
import { advance, advanceDays, GST18, SUPER, V1, V2, walletWorld, WalletWorld } from './support/wallet-world';

/**
 * Slice 5.16a and 5.16a-2: the wallet service on the in-memory twin. Every rule below is also enforced by the database (checks, unique keys, the append-only trigger), which the staging
 * suite (wallet.int.spec.ts) proves. Here the point is the behaviour: who may do what, exactly once, never negative.
 */
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code: string | undefined; body: Record<string, unknown> }> => {
  try { await p; } catch (e) { if (e instanceof HttpException) { const b = e.getResponse() as Record<string, unknown>; return { status: e.getStatus(), code: b.code as string | undefined, body: b }; } throw e; }
  throw new Error('expected a refusal');
};
let w: WalletWorld;
beforeEach(() => { w = walletWorld(); });

describe('activation (owner rule 2)', () => {
  it('a Free-only vendor has no wallet: the view is a locked preview and nothing can be topped up or spent', async () => {
    const v = await w.svc.view('v1');
    expect(v).toMatchObject({ status: 'INACTIVE', locked: true, lockedReason: 'NO_PAID_PRO_TERM', balancePaise: 0, availablePaise: 0, topup: { enabled: false } });
    expect(v.lockedText).toMatch(/first Pro plan term/i);
    expect((await codeOf(w.svc.createTopup('v1', { amountPaise: 20_000, idempotencyKey: 'free-vendor-key' }, V1))).code).toBe('WALLET_NOT_ACTIVE');
    expect(await w.store.wallet('v1')).toBeNull();
  });

  it('a vendor with a paid Pro term gets an ACTIVE wallet the first time anything looks, even if the event was missed', async () => {
    await w.open('v1');
    expect(await w.store.wallet('v1')).toMatchObject({ status: 'ACTIVE', balancePaise: 0, activatedByEventId: 'plan_order:order-v1' });
    expect(w.store.audits.filter((a) => a.action === 'wallet.activated')).toHaveLength(1);
  });

  it('activation happens exactly once under 25 racing callers and writes one audit row and one event', async () => {
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => w.svc.activate('v1', `race-${i}`)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(w.store.audits.filter((a) => a.action === 'wallet.activated')).toHaveLength(1);
    await new Promise((r) => setImmediate(r));
    expect(w.events.filter((e) => e.type === 'wallet.activated')).toHaveLength(1);
    expect((await w.store.wallet('v1'))!.activatedByEventId).toMatch(/^race-/);
  });

  it('the listener path: a Pro plan order PAID or a Pro subscription a payment started opens it; anything else leaves it closed', async () => {
    expect(await w.svc.onEvidence('v1', { kind: 'PLAN_ORDER_PAID', planLevel: 'PRO' }, 'e1')).toBe(true);
    expect(await w.svc.onEvidence('v1', { kind: 'PLAN_ORDER_PAID', planLevel: 'PRO' }, 'e2')).toBe(false);
    expect(await w.svc.onEvidence('v2', { kind: 'SUBSCRIPTION', level: 'PRO', source: 'REGISTRATION', reason: null }, 'e3')).toBe(false);
    expect(await w.svc.onEvidence('v2', { kind: 'SUBSCRIPTION', level: 'PRO', source: 'STAFF', reason: 'goodwill' }, 'e4')).toBe(false);
    expect(await w.store.wallet('v2')).toBeNull();
    expect(await w.svc.onEvidence('v2', { kind: 'SUBSCRIPTION', level: 'PRO', source: 'STAFF', reason: 'plan order o9' }, 'e5')).toBe(true);
  });

  it('a staff Pro grant with no payment does NOT open the wallet, even when anything looks again; the wallet opens only after the first Pro payment (owner 5 November 2026)', async () => {
    // a Pro plan the staff granted for free leaves no paid evidence: the data-derived check (the one a missed event falls back to) finds nothing
    expect(await w.svc.syncActivation('v2')).toBeNull(); expect(await w.svc.syncActivation('v2')).toBeNull(); expect(await w.store.wallet('v2')).toBeNull();
    expect((await w.svc.view('v2'))).toMatchObject({ status: 'INACTIVE', locked: true, lockedReason: 'NO_PAID_PRO_TERM', topup: { enabled: false } });
    expect((await codeOf(w.svc.createTopup('v2', { amountPaise: 99_900, idempotencyKey: 'granted-no-pay-key' }, V2))).code).toBe('WALLET_NOT_ACTIVE');
    expect(w.store.audits.filter((a) => a.action === 'wallet.activated')).toHaveLength(0);
    // the first Pro payment is what opens it
    w.store.evidence.set('v2', { kind: 'PLAN_ORDER', id: 'order-v2' });
    expect(await w.svc.syncActivation('v2')).toMatchObject({ status: 'ACTIVE' });
  });

  it('a wallet that is already open is not opened again by later evidence', async () => {
    await w.open('v1'); await w.fund('v1', 50_000);
    await w.svc.syncActivation('v1');
    expect((await w.store.wallet('v1'))!.balancePaise).toBe(50_000);
    expect(w.store.audits.filter((a) => a.action === 'wallet.activated')).toHaveLength(1);
  });
});

describe('top-ups', () => {
  beforeEach(async () => { await w.open('v1'); await w.open('v2'); });

  it('are refused until staff set both limits (no defaults are invented)', async () => {
    w.wsettings.over = { walletTopupMinPaise: undefined as never, walletTopupMaxPaise: undefined as never };
    w.wsettings.over = {};
    expect((await codeOf(w.svc.createTopup('v1', { amountPaise: 20_000, idempotencyKey: 'no-limits-key1' }, V1))).code).toBe('WALLET_TOPUP_NOT_CONFIGURED');
    expect((await w.svc.view('v1')).topup).toMatchObject({ enabled: false, configured: false, minPaise: null, maxPaise: null });
  });

  it('must be a whole number of paise inside the limits', async () => {
    for (const [amount, code] of [[9_999, 'WALLET_TOPUP_AMOUNT_INVALID'], [1_000_001, 'WALLET_TOPUP_AMOUNT_INVALID'], [10_000.5, 'WALLET_TOPUP_AMOUNT_INVALID'], [-5, 'WALLET_TOPUP_AMOUNT_INVALID']] as const) {
      const r = await codeOf(w.svc.createTopup('v1', { amountPaise: amount, idempotencyKey: `bad-${amount}-key1` }, V1));
      expect([r.status, r.code]).toEqual([400, code]);
    }
    expect(w.fake.calls.createOrder).toBe(0);
  });

  it('create then confirm credits the exact amount once, opens one lot, and issues a numbered tax invoice from the shared series', async () => {
    const t = await w.svc.createTopup('v1', { amountPaise: 25_000, idempotencyKey: 'topup-key-0001' }, V1);
    expect(t).toMatchObject({ status: 'PENDING', amountPaise: 25_000, creditPaise: 25_000, payablePaise: 25_000, keyId: 'rzp_test_fakekey' });
    const p = w.fake.pay(t.providerOrderId!);
    const done = await w.svc.confirmTopup('v1', t.id, { paymentId: p.paymentId, signature: p.signature }, V1);
    expect(done.status).toBe('PAID');
    expect(await w.store.wallet('v1')).toMatchObject({ balancePaise: 25_000, heldPaise: 0 });
    const lots = await w.store.lots('v1'); expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({ remainingPaise: 25_000, status: 'OPEN' });
    expect(lots[0].expiresAt.getTime() - w.clock().getTime()).toBe(365 * 86_400_000);
    const rc = w.store.receipts[0];
    expect(rc).toMatchObject({ documentType: 'TAX_INVOICE', receiptNumber: 'INV/2026-27/000001' });
    expect(JSON.stringify(rc.snapshot)).not.toMatch(/not a tax invoice/);
  });

  it('a double confirm, a webhook replay and a confirm racing a webhook credit exactly once', async () => {
    const t = await w.svc.createTopup('v1', { amountPaise: 30_000, idempotencyKey: 'topup-key-0002' }, V1);
    const p = w.fake.pay(t.providerOrderId!); const pay = { paymentId: p.paymentId, signature: p.signature };
    const hook = () => w.svc.handleCapturedPayment({ providerOrderId: t.providerOrderId!, paymentId: p.paymentId, amount: 30_000, currency: 'INR' });
    const results = await Promise.all([w.svc.confirmTopup('v1', t.id, pay, V1), w.svc.confirmTopup('v1', t.id, pay, V1), hook(), hook(), hook()]);
    expect(results).toHaveLength(5);
    expect((await w.store.wallet('v1'))!.balancePaise).toBe(30_000);
    expect(w.store.ledger.filter((e) => e.kind === 'TOPUP')).toHaveLength(1);
    expect(w.store.receipts).toHaveLength(1);
    expect(await hook()).toBe('TOPUP_ALREADY_PAID');
  });

  it('a payment of the wrong amount or currency is never credited: it goes to review and the vendor sees nothing added', async () => {
    const t = await w.svc.createTopup('v1', { amountPaise: 30_000, idempotencyKey: 'topup-key-0003' }, V1);
    const p = w.fake.pay(t.providerOrderId!, { amount: 29_999 });
    expect(await w.svc.handleCapturedPayment({ providerOrderId: t.providerOrderId!, paymentId: p.paymentId, amount: 29_999, currency: 'INR' })).toBe('TOPUP_REVIEW');
    const q = w.fake.pay(t.providerOrderId!, { currency: 'USD' });
    expect(await w.svc.handleCapturedPayment({ providerOrderId: t.providerOrderId!, paymentId: q.paymentId, amount: 30_000, currency: 'USD' })).toBe('TOPUP_REVIEW');
    expect((await w.store.wallet('v1'))!.balancePaise).toBe(0);
    expect(w.store.audits.filter((a) => a.action === 'wallet.topup.review')).toHaveLength(2);
  });

  it('never trusts the browser: a bad signature, a payment for another order and an uncaptured payment credit nothing', async () => {
    const t = await w.svc.createTopup('v1', { amountPaise: 30_000, idempotencyKey: 'topup-key-0004' }, V1);
    const other = await w.svc.createTopup('v1', { amountPaise: 40_000, idempotencyKey: 'topup-key-0005' }, V1);
    const p = w.fake.pay(t.providerOrderId!);
    expect((await codeOf(w.svc.confirmTopup('v1', t.id, { paymentId: p.paymentId, signature: 'f'.repeat(64) }, V1))).code).toBe('PAYMENT_SIGNATURE_INVALID');
    const foreign = w.fake.pay(other.providerOrderId!);
    expect((await codeOf(w.svc.confirmTopup('v1', t.id, { paymentId: foreign.paymentId, signature: w.fake.signature(t.providerOrderId!, foreign.paymentId) }, V1))).code).toBe('PAYMENT_SIGNATURE_INVALID');
    const failed = w.fake.pay(t.providerOrderId!, { status: 'failed' });
    expect((await codeOf(w.svc.confirmTopup('v1', t.id, { paymentId: failed.paymentId, signature: failed.signature }, V1))).code).toBe('PAYMENT_NOT_CAPTURED');
    expect((await w.store.wallet('v1'))!.balancePaise).toBe(0);
  });

  it('the same request key returns the same top-up and makes one provider order; a different amount under the same key is refused', async () => {
    const a = await w.svc.createTopup('v1', { amountPaise: 20_000, idempotencyKey: 'topup-key-0006' }, V1);
    const b = await w.svc.createTopup('v1', { amountPaise: 20_000, idempotencyKey: 'topup-key-0006' }, V1);
    expect(b.id).toBe(a.id); expect(w.fake.calls.createOrder).toBe(1);
    expect((await codeOf(w.svc.createTopup('v1', { amountPaise: 30_000, idempotencyKey: 'topup-key-0006' }, V1))).code).toBe('WALLET_IDEMPOTENCY_CONFLICT');
  });

  it('a provider that is down leaves a FAILED top-up and no credit', async () => {
    w.fake.failNextCreate = true;
    expect((await codeOf(w.svc.createTopup('v1', { amountPaise: 20_000, idempotencyKey: 'topup-key-0007' }, V1))).code).toBe('PAYMENT_PROVIDER_ERROR');
    expect([...w.store.topups.values()][0].status).toBe('FAILED');
  });

  it('payments switched off refuses before any row is made', async () => {
    w.bsettings.over = { paymentsMode: 'off' };
    expect((await codeOf(w.svc.createTopup('v1', { amountPaise: 20_000, idempotencyKey: 'topup-key-0008' }, V1))).code).toBe('PAYMENTS_DISABLED');
    expect(w.store.topups.size).toBe(0);
  });

  it('a payment that arrives after the order expired is still credited (the vendor paid)', async () => {
    const t = await w.svc.createTopup('v1', { amountPaise: 20_000, idempotencyKey: 'topup-key-0009' }, V1);
    advance(w, 3 * 3600); expect(await w.store.expireStaleTopups(w.clock())).toBe(1);
    const p = w.fake.pay(t.providerOrderId!);
    expect(await w.svc.handleCapturedPayment({ providerOrderId: t.providerOrderId!, paymentId: p.paymentId, amount: 20_000, currency: 'INR' })).toBe('TOPUP_CREDITED');
    expect((await w.store.wallet('v1'))!.balancePaise).toBe(20_000);
  });

  it('a provider order that is not a top-up is not ours (the hook answers null so plan payments are untouched)', async () => {
    expect(await w.svc.handleCapturedPayment({ providerOrderId: 'order_plan_1', paymentId: 'pay_x', amount: 1, currency: 'INR' })).toBeNull();
  });

  it('refill invoices are numbered without gaps under concurrency', async () => {
    const tops = await Promise.all(Array.from({ length: 8 }, (_, i) => w.svc.createTopup(i % 2 ? 'v1' : 'v2', { amountPaise: 20_000, idempotencyKey: `race-topup-key-${i}` }, i % 2 ? V1 : V2)));
    await Promise.all(tops.map((t) => w.svc.handleCapturedPayment({ providerOrderId: t.providerOrderId!, paymentId: w.fake.pay(t.providerOrderId!).paymentId, amount: 20_000, currency: 'INR' })));
    expect(w.store.receipts.map((r) => r.receiptNumber).sort()).toEqual(Array.from({ length: 8 }, (_, i) => `INV/2026-27/${String(i + 1).padStart(6, '0')}`));
  });

  it('a frozen wallet cannot start a top-up', async () => {
    await w.svc.setFrozen('v1', { frozen: true, reason: 'chargeback review' }, SUPER);
    expect((await codeOf(w.svc.createTopup('v1', { amountPaise: 20_000, idempotencyKey: 'topup-key-0010' }, V1))).code).toBe('WALLET_FROZEN');
  });
});

describe('a refill: GST on top, the credit is the amount before GST, one tax invoice per refill (owner 5 November 2026)', () => {
  const MIN = 99_900;
  beforeEach(async () => { w.store.taxes = GST18; w.wsettings.over = { ...w.wsettings.over, walletTopupMinPaise: MIN }; await w.open('v1'); await w.open('v2'); });
  const pay = async (vendor: string, amount: number, key: string, actor = vendor === 'v1' ? V1 : V2) => {
    const t = await w.svc.createTopup(vendor, { amountPaise: amount, idempotencyKey: key }, actor); const p = w.fake.pay(t.providerOrderId!);
    return { t, p, done: await w.svc.confirmTopup(vendor, t.id, { paymentId: p.paymentId, signature: p.signature }, actor) };
  };

  it('the vendor pays the amount plus GST (CGST and SGST in the same state); the credit is the amount before GST', async () => {
    const t = await w.svc.createTopup('v1', { amountPaise: 100_000, idempotencyKey: 'refill-key-0001' }, V1);
    expect(t).toMatchObject({ amountPaise: 100_000, creditPaise: 100_000, taxPaise: 18_000, payablePaise: 118_000, tax: { intraState: true, lines: [{ name: 'CGST', amountMinor: 9_000 }, { name: 'SGST', amountMinor: 9_000 }] } });
    expect(w.fake.orders.get(t.providerOrderId!)!.amount).toBe(118_000);
    const p = w.fake.pay(t.providerOrderId!); await w.svc.confirmTopup('v1', t.id, { paymentId: p.paymentId, signature: p.signature }, V1);
    expect(await w.store.wallet('v1')).toMatchObject({ balancePaise: 100_000, heldPaise: 0 });
    expect((await w.store.lots('v1'))[0]).toMatchObject({ amountPaise: 100_000, remainingPaise: 100_000 });
    expect(w.store.ledger.filter((e) => e.kind === 'TOPUP').map((e) => e.amountPaise)).toEqual([100_000]);
  });

  it('another state is IGST', async () => {
    await w.store.unit('v2', (tx) => tx.setBillingProfile({ stateCode: '29', gstin: null }));
    const t = await w.svc.createTopup('v2', { amountPaise: 100_000, idempotencyKey: 'refill-key-0002' }, V2);
    expect(t).toMatchObject({ taxPaise: 18_000, payablePaise: 118_000, tax: { intraState: false, lines: [{ name: 'IGST', amountMinor: 18_000 }] } });
  });

  it('each refill issues ONE tax invoice from the shared series, with the seller, the buyer, the credit, the tax lines and the payment; it is not the old receipt', async () => {
    const { t, p } = await pay('v1', 100_000, 'refill-key-0003');
    const inv = w.store.receipts[0];
    expect(inv).toMatchObject({ documentType: 'TAX_INVOICE', receiptNumber: 'INV/2026-27/000001', vendorId: 'v1', topupId: t.id });
    expect(inv.snapshot).toMatchObject({
      topupId: t.id, creditPaise: 100_000, paymentId: p.paymentId, seller: { stateCode: '33' }, buyer: { vendorId: 'v1', stateCode: '33' },
      taxBreakdown: { taxableMinor: 100_000, taxMinor: 18_000, totalMinor: 118_000, intraState: true, lines: [{ name: 'CGST', amountMinor: 9_000 }, { name: 'SGST', amountMinor: 9_000 }] },
    });
    expect(JSON.stringify(inv.snapshot)).not.toMatch(/not a tax invoice/);
    expect([...w.store.counters.keys()].filter((k) => k.startsWith('RECEIPT'))).toEqual([]);   // no separate receipt series any more
    await pay('v1', 120_000, 'refill-key-0004');
    expect(w.store.receipts.map((r) => r.receiptNumber)).toEqual(['INV/2026-27/000001', 'INV/2026-27/000002']);
  });

  it('a double confirm, a webhook replay and a confirm racing a webhook issue exactly one invoice and one credit', async () => {
    const t = await w.svc.createTopup('v1', { amountPaise: 100_000, idempotencyKey: 'refill-key-0005' }, V1);
    const p = w.fake.pay(t.providerOrderId!); const body = { paymentId: p.paymentId, signature: p.signature };
    const hook = () => w.svc.handleCapturedPayment({ providerOrderId: t.providerOrderId!, paymentId: p.paymentId, amount: 118_000, currency: 'INR' });
    await Promise.all([w.svc.confirmTopup('v1', t.id, body, V1), w.svc.confirmTopup('v1', t.id, body, V1), hook(), hook(), hook()]);
    expect(w.store.receipts).toHaveLength(1); expect((await w.store.wallet('v1'))!.balancePaise).toBe(100_000); expect(w.store.ledger.filter((e) => e.kind === 'TOPUP')).toHaveLength(1);
    expect(await hook()).toBe('TOPUP_ALREADY_PAID');
  });

  it('a payment of the credit amount alone (without the GST) is the wrong amount: it goes to review, nothing is credited and no invoice is issued', async () => {
    const t = await w.svc.createTopup('v1', { amountPaise: 100_000, idempotencyKey: 'refill-key-0006' }, V1);
    const p = w.fake.pay(t.providerOrderId!, { amount: 100_000 });
    expect(await w.svc.handleCapturedPayment({ providerOrderId: t.providerOrderId!, paymentId: p.paymentId, amount: 100_000, currency: 'INR' })).toBe('TOPUP_REVIEW');
    expect((await w.store.wallet('v1'))!.balancePaise).toBe(0); expect(w.store.receipts).toEqual([]);
  });

  it('is refused when tax is not set up: no seller state, no buyer state or no rates; no order is made', async () => {
    w.wsettings.over = { ...w.wsettings.over, walletSellerStateCode: '' };
    const a = await codeOf(w.svc.createTopup('v1', { amountPaise: 100_000, idempotencyKey: 'refill-key-0007' }, V1)); expect([a.status, a.code, a.body.problem]).toEqual([409, 'TAX_NOT_CONFIGURED', 'SELLER_STATE_MISSING']);
    w.wsettings.over = { ...w.wsettings.over, walletSellerStateCode: '33' };
    await w.store.unit('v2', (tx) => tx.setBillingProfile({ stateCode: null, gstin: null }));
    const b = await codeOf(w.svc.createTopup('v2', { amountPaise: 100_000, idempotencyKey: 'refill-key-0008' }, V2)); expect([b.status, b.code, b.body.problem]).toEqual([409, 'TAX_NOT_CONFIGURED', 'BUYER_STATE_MISSING']);
    w.store.taxes = [];
    const c = await codeOf(w.svc.createTopup('v1', { amountPaise: 100_000, idempotencyKey: 'refill-key-0009' }, V1)); expect([c.status, c.code, c.body.problem]).toEqual([409, 'TAX_NOT_CONFIGURED', 'RATES_MISSING']);
    expect(w.fake.calls.createOrder).toBe(0); expect(w.store.topups.size).toBe(0);
  });

  it('a refill below the minimum is refused (the minimum is measured on the amount before GST); the minimum itself is accepted', async () => {
    const low = await codeOf(w.svc.createTopup('v1', { amountPaise: MIN - 1, idempotencyKey: 'refill-key-0010' }, V1)); expect([low.status, low.code]).toEqual([400, 'WALLET_TOPUP_AMOUNT_INVALID']);
    expect(low.body).toMatchObject({ minTopupPaise: MIN });
    expect(await w.svc.createTopup('v1', { amountPaise: MIN, idempotencyKey: 'refill-key-0011' }, V1)).toMatchObject({ creditPaise: MIN, payablePaise: MIN + 17_982 });   // 18 percent of 99,900 is 17,982
    expect(w.store.topups.size).toBe(1);
  });

  it('the vendor sees the tax and the invoice on the refill list, and another vendor never sees them', async () => {
    const { t } = await pay('v1', 100_000, 'refill-key-0012');
    const mine = (await w.svc.topups('v1', 1, 10)).items[0];
    expect(mine).toMatchObject({ id: t.id, creditPaise: 100_000, taxPaise: 18_000, payablePaise: 118_000, status: 'PAID' });
    expect((await w.svc.topups('v2', 1, 10)).items).toEqual([]);
    expect(await w.svc.invoiceForTopup('v1', t.id)).toMatchObject({ invoiceNumber: 'INV/2026-27/000001', documentType: 'TAX_INVOICE' });
    expect((await codeOf(w.svc.invoiceForTopup('v2', t.id))).code).toBe('WALLET_TOPUP_NOT_FOUND');
  });

  it('the credit lot of a refill is the amount before GST and lasts a year from the refill: the expiry date is on each lot', async () => {
    await pay('v1', 100_000, 'refill-key-0013');
    const lot = (await w.store.lots('v1'))[0];
    expect(lot.amountPaise).toBe(100_000); expect(lot.expiresAt.getTime() - w.clock().getTime()).toBe(365 * 86_400_000);
  });
});

describe('cross-tenant: one vendor can never see or use another vendor\'s wallet', () => {
  beforeEach(async () => { await w.open('v1'); await w.open('v2'); await w.fund('v1', 50_000); });
  it('vendor 2 cannot confirm, list or read vendor 1\'s top-up; ledgers and views are their own', async () => {
    const t = await w.svc.createTopup('v1', { amountPaise: 20_000, idempotencyKey: 'tenant-key-0001' }, V1);
    const p = w.fake.pay(t.providerOrderId!);
    expect((await codeOf(w.svc.confirmTopup('v2', t.id, { paymentId: p.paymentId, signature: p.signature }, V2))).code).toBe('WALLET_TOPUP_NOT_FOUND');
    expect((await w.svc.topups('v2', 1, 50)).total).toBe(0);
    expect((await w.svc.ledger('v2', 1, 50)).total).toBe(0);
    expect((await w.svc.view('v2')).balancePaise).toBe(0);
    expect((await w.svc.view('v1')).balancePaise).toBe(50_000);
  });
  it('a vendor ledger row never shows a staff identity or the lots', async () => {
    await w.svc.adjust('v1', { amountPaise: 1_000, reason: 'goodwill credit', idempotencyKey: 'adjust-key-0001' }, SUPER);
    const rows = (await w.svc.ledger('v1', 1, 50)).items;
    expect(JSON.stringify(rows)).not.toMatch(/super-1|lotUses|idempotency|actorId/);
    expect(rows[0]).toMatchObject({ kind: 'ADJUSTMENT', by: 'STAFF', reason: 'goodwill credit' });
  });
});

describe('staff operations', () => {
  beforeEach(async () => { await w.open('v1'); await w.fund('v1', 100_000); });
  it('an adjustment needs a reason, is audited, and can add or take away credit', async () => {
    expect((await codeOf(w.svc.adjust('v1', { amountPaise: 500, reason: 'no', idempotencyKey: 'adjust-key-0002' }, SUPER))).code).toBe('WALLET_ADJUST_INVALID');
    await w.svc.adjust('v1', { amountPaise: -30_000, reason: 'duplicate credit removed', idempotencyKey: 'adjust-key-0003' }, SUPER);
    await w.svc.adjust('v1', { amountPaise: 5_000, reason: 'goodwill credit', idempotencyKey: 'adjust-key-0004' }, SUPER);
    expect((await w.store.wallet('v1'))!.balancePaise).toBe(75_000);
    expect(w.store.audits.filter((a) => a.action === 'wallet.adjust')).toHaveLength(2);
  });
  it('an adjustment replays by key and can never take held money or go below zero', async () => {
    const a = await w.svc.adjust('v1', { amountPaise: -10_000, reason: 'correction entry', idempotencyKey: 'adjust-key-0005' }, SUPER);
    const b = await w.svc.adjust('v1', { amountPaise: -10_000, reason: 'correction entry', idempotencyKey: 'adjust-key-0005' }, SUPER);
    expect([a.replay, b.replay]).toEqual([false, true]); expect((await w.store.wallet('v1'))!.balancePaise).toBe(90_000);
    await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'HOLD', amountPaise: 80_000, idempotencyKey: 'hold-key-0001', actor: { type: 'SYSTEM', id: null }, now: w.clock() }));
    const r = await codeOf(w.svc.adjust('v1', { amountPaise: -20_000, reason: 'too much taken', idempotencyKey: 'adjust-key-0006' }, SUPER));
    expect([r.status, r.code]).toEqual([409, 'WALLET_ADJUST_INVALID']);
    expect((await codeOf(w.svc.adjust('v1', { amountPaise: -1_000_000, reason: 'far too much', idempotencyKey: 'adjust-key-0007' }, SUPER))).code).toBe('WALLET_ADJUST_INVALID');
  });
  it('freeze needs a reason, blocks spending, still lets a hold be released and a paid top-up be credited, and unfreeze restores', async () => {
    expect((await codeOf(w.svc.setFrozen('v1', { frozen: true, reason: 'x' }, SUPER))).code).toBe('WALLET_ADJUST_INVALID');
    await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'HOLD', amountPaise: 10_000, idempotencyKey: 'hold-key-0002', actor: { type: 'SYSTEM', id: null }, now: w.clock() }));
    await w.svc.setFrozen('v1', { frozen: true, reason: 'chargeback review' }, SUPER);
    const spend = (k: string) => w.store.unit('v1', (tx) => postEntry(tx, { kind: 'CHARGE', amountPaise: 1_000, idempotencyKey: k, actor: { type: 'SYSTEM', id: null }, now: w.clock() }));
    expect((await codeOf(spend('charge-key-0001'))).code).toBe('WALLET_FROZEN');
    const hold = w.store.ledger.find((e) => e.kind === 'HOLD')!;
    await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'RELEASE', amountPaise: 10_000, holdId: hold.id, idempotencyKey: 'release-key-0001', actor: { type: 'SYSTEM', id: null }, now: w.clock() }));
    await w.svc.setFrozen('v1', { frozen: false, reason: 'review finished' }, SUPER);
    await spend('charge-key-0002'); expect((await w.store.wallet('v1'))!.balancePaise).toBe(99_000);
  });
  it('the billing profile checks the state code and the GST number', async () => {
    expect((await codeOf(w.svc.setBillingProfile('v1', { stateCode: '7' }, V1))).code).toBe('WALLET_PROFILE_INVALID');
    expect((await codeOf(w.svc.setBillingProfile('v1', { stateCode: '33', gstin: '29ABCDE1234F1Z5' }, V1))).code).toBe('WALLET_PROFILE_INVALID');
    expect(await w.svc.setBillingProfile('v1', { stateCode: '33', gstin: '33abcde1234f1z5' }, V1)).toEqual({ stateCode: '33', gstin: '33ABCDE1234F1Z5' });
    expect((await w.svc.view('v1')).billingProfile).toEqual({ stateCode: '33', gstin: '33ABCDE1234F1Z5' });
  });
});

describe('reconcile', () => {
  beforeEach(async () => { await w.open('v1'); await w.fund('v1', 60_000); await w.svc.adjust('v1', { amountPaise: -10_000, reason: 'correction entry', idempotencyKey: 'rec-adjust-1' }, SUPER); });
  it('agrees for an honest wallet, for one vendor and for all of them', async () => {
    expect(await w.svc.reconcileVendor('v1')).toMatchObject({ ok: true, problems: [], balancePaise: 50_000, entries: 2 });
    expect(await w.svc.reconcileAll()).toEqual({ scanned: 1, mismatches: 0, wallets: [] });
  });
  it('detects a tampered cache (balance, held) and lots that no longer add up, and names the vendor', async () => {
    w.store.tamperWallet('v1', { balancePaise: 99_999 });
    const r = await w.svc.reconcileVendor('v1');
    expect(r.ok).toBe(false); expect(r.problems.join(' ')).toMatch(/balance on the wallet is 99999/);
    expect(await w.svc.reconcileAll()).toMatchObject({ mismatches: 1, wallets: [{ vendorId: 'v1' }] });
    w.store.tamperWallet('v1', { balancePaise: 50_000, heldPaise: 7 });
    expect((await w.svc.reconcileVendor('v1')).problems.join(' ')).toMatch(/held/);
  });
  it('the ledger cannot be edited: the twin refuses what the database trigger refuses', () => {
    expect(() => w.store.tamperLedger(w.store.ledger[0].id, { amountPaise: 1 })).toThrow(/cannot be changed/);
  });
});

describe('one-year validity and the expiry job (5.16a-2)', () => {
  beforeEach(async () => { await w.open('v1'); });
  it('credit expires on the day the validity ends: exactly the open remainder is written off, once, and a re-run changes nothing', async () => {
    await w.fund('v1', 40_000);
    await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'CHARGE', amountPaise: 15_000, idempotencyKey: 'spend-key-0001', actor: { type: 'SYSTEM', id: null }, now: w.clock() }));
    advanceDays(w, 364); expect(await w.svc.runExpiry()).toMatchObject({ vendors: 0, entries: 0 });
    advanceDays(w, 1);
    expect(await w.svc.runExpiry()).toMatchObject({ vendors: 1, entries: 1, failed: 0 });
    expect(await w.store.wallet('v1')).toMatchObject({ balancePaise: 0 });
    const exp = w.store.ledger.filter((e) => e.kind === 'EXPIRY'); expect(exp).toHaveLength(1);
    expect(exp[0]).toMatchObject({ amountPaise: -25_000, actorType: 'SYSTEM' });
    expect(await w.svc.runExpiry()).toMatchObject({ entries: 0 });
    expect(w.store.ledger.filter((e) => e.kind === 'EXPIRY')).toHaveLength(1);
    expect(await w.svc.reconcileVendor('v1')).toMatchObject({ ok: true });
  });
  it('held money survives the expiry run and is written off by a later run once it is released', async () => {
    await w.fund('v1', 40_000);
    const hold = await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'HOLD', amountPaise: 30_000, idempotencyKey: 'hold-key-0003', actor: { type: 'SYSTEM', id: null }, now: w.clock() }));
    advanceDays(w, 366);
    await w.svc.runExpiry(); expect(await w.store.wallet('v1')).toMatchObject({ balancePaise: 30_000, heldPaise: 30_000 });
    await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'RELEASE', amountPaise: 30_000, holdId: hold.entry.id, idempotencyKey: 'release-key-0002', actor: { type: 'SYSTEM', id: null }, now: w.clock() }));
    await w.svc.runExpiry(); expect(await w.store.wallet('v1')).toMatchObject({ balancePaise: 0, heldPaise: 0 });
    expect(await w.svc.reconcileVendor('v1')).toMatchObject({ ok: true });
  });
  it('spending takes the oldest lot first, in the same unit as the ledger entry, and the lots always add up to the balance', async () => {
    await w.fund('v1', 20_000); advanceDays(w, 30); await w.fund('v1', 30_000);
    const r = await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'CHARGE', amountPaise: 35_000, idempotencyKey: 'spend-key-0002', actor: { type: 'SYSTEM', id: null }, now: w.clock() }));
    expect(r.entry.lotUses.map((u) => u.amountPaise)).toEqual([20_000, 15_000]);
    const lots = (await w.store.lots('v1')).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    expect(lots.map((l) => [l.remainingPaise, l.status])).toEqual([[0, 'SPENT'], [15_000, 'OPEN']]);
    expect(lots.reduce((t, l) => t + l.remainingPaise, 0)).toBe((await w.store.wallet('v1'))!.balancePaise);
  });
  it('changing the validity setting affects only top-ups made afterwards', async () => {
    await w.fund('v1', 20_000);
    w.wsettings.over = { ...w.wsettings.over, walletCreditValidityDays: 30 };
    await w.fund('v1', 20_000);
    const lots = (await w.store.lots('v1')).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    expect(lots.map((l) => Math.round((l.expiresAt.getTime() - l.createdAt.getTime()) / 86_400_000))).toEqual([365, 30]);
  });
  it('a vendor with an expired lot and a failing wallet does not stop the others: failures are counted, not thrown', async () => {
    await w.open('v2'); await w.fund('v1', 20_000); await w.fund('v2', 20_000); advanceDays(w, 400);
    w.store.failCommitOnce = true;
    const r = await w.svc.runExpiry();
    expect(r).toMatchObject({ vendors: 2, entries: 1, failed: 1 });
    expect(await w.svc.runExpiry()).toMatchObject({ entries: 1, failed: 0 });
  });
});

describe('concurrency: many parallel spenders can never overspend, with a small connection pool', () => {
  it('60 parallel charges of 7,000 against 100,000 succeed 14 times, refuse the rest, and leave an exact balance', async () => {
    await w.open('v1'); await w.fund('v1', 100_000);
    const charge = (i: number) => w.store.unit('v1', (tx) => postEntry(tx, { kind: 'CHARGE', amountPaise: 7_000, idempotencyKey: `par-charge-${i}`, actor: { type: 'SYSTEM', id: null }, now: w.clock() }))
      .then(() => 'ok', (e) => (e instanceof HttpException ? 'http' : (e as { code?: string }).code ?? 'other'));
    const results = await Promise.all(Array.from({ length: 60 }, (_, i) => charge(i)));
    expect(results.filter((r) => r === 'ok')).toHaveLength(14);
    expect(results.filter((r) => r === 'INSUFFICIENT_WALLET')).toHaveLength(46);
    expect(await w.store.wallet('v1')).toMatchObject({ balancePaise: 2_000, heldPaise: 0 });
    expect(await w.svc.reconcileVendor('v1')).toMatchObject({ ok: true });
  });
  it('parallel holds can never hold more than is available', async () => {
    await w.open('v1'); await w.fund('v1', 50_000);
    const results = await Promise.all(Array.from({ length: 40 }, (_, i) => w.store.unit('v1', (tx) => postEntry(tx, { kind: 'HOLD', amountPaise: 6_000, idempotencyKey: `par-hold-${i}`, actor: { type: 'SYSTEM', id: null }, now: w.clock() })).then(() => 1, () => 0)));
    expect(results.reduce<number>((t, r) => t + r, 0)).toBe(8);
    expect((await w.store.wallet('v1'))!.heldPaise).toBe(48_000);
  });
  it('the same key sent 30 times in parallel writes one entry', async () => {
    await w.open('v1'); await w.fund('v1', 50_000);
    const r = await Promise.all(Array.from({ length: 30 }, () => w.store.unit('v1', (tx) => postEntry(tx, { kind: 'CHARGE', amountPaise: 5_000, idempotencyKey: 'same-key-everywhere', actor: { type: 'SYSTEM', id: null }, now: w.clock() }))));
    expect(r.filter((x) => !x.replay)).toHaveLength(1); expect((await w.store.wallet('v1'))!.balancePaise).toBe(45_000);
  });
  it('five vendors at once through a pool of three connections all finish, and never use more than three', async () => {
    for (const v of ['v1', 'v2', 'v3']) await w.open(v);
    w.store.poolSize = 3;
    await Promise.all(['v1', 'v2', 'v3'].flatMap((v) => Array.from({ length: 10 }, (_, i) => w.store.unit(v, (tx) => tx.ensureWallet()).then(() => w.store.unit(v, (tx) => tx.audit(V1, 'noop', `${v}-${i}`, null, null))))));
    expect(w.store.maxConnectionsInUse).toBeLessThanOrEqual(3);
    expect(w.store.maxUnitsRunning).toBe(1);
  });
  it('a unit that throws leaves no trace: wallet, lots and ledger are exactly as before', async () => {
    await w.open('v1'); await w.fund('v1', 50_000);
    const before = JSON.stringify([await w.store.wallet('v1'), w.store.ledger, await w.store.lots('v1')]);
    w.store.failCommitOnce = true;
    await expect(w.store.unit('v1', (tx) => postEntry(tx, { kind: 'CHARGE', amountPaise: 5_000, idempotencyKey: 'crash-key-0001', actor: { type: 'SYSTEM', id: null }, now: w.clock() }))).rejects.toThrow(/simulated crash/);
    expect(JSON.stringify([await w.store.wallet('v1'), w.store.ledger, await w.store.lots('v1')])).toBe(before);
  });
});

describe('holds, releases and reversals through the engine', () => {
  beforeEach(async () => { await w.open('v1'); await w.fund('v1', 50_000); });
  const act = { type: 'SYSTEM' as const, id: null };
  it('a hold is settled once: a second charge or release of the same hold is refused', async () => {
    const h = await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'HOLD', amountPaise: 20_000, idempotencyKey: 'hold-key-0010', actor: act, now: w.clock() }));
    await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'CHARGE', amountPaise: 20_000, holdId: h.entry.id, idempotencyKey: 'settle-key-0001', actor: act, now: w.clock() }));
    expect(await w.store.wallet('v1')).toMatchObject({ balancePaise: 30_000, heldPaise: 0 });
    for (const [kind, key] of [['CHARGE', 'settle-key-0002'], ['RELEASE', 'settle-key-0003']] as const) {
      await expect(w.store.unit('v1', (tx) => postEntry(tx, { kind, amountPaise: 20_000, holdId: h.entry.id, idempotencyKey: key, actor: act, now: w.clock() }))).rejects.toMatchObject({ code: 'HOLD_NOT_ENOUGH' });
    }
    expect((await w.store.wallet('v1'))!.balancePaise).toBe(30_000);
  });
  it('a charge of a hold must match the hold, and a release must name its hold', async () => {
    const h = await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'HOLD', amountPaise: 20_000, idempotencyKey: 'hold-key-0011', actor: act, now: w.clock() }));
    await expect(w.store.unit('v1', (tx) => postEntry(tx, { kind: 'CHARGE', amountPaise: 19_999, holdId: h.entry.id, idempotencyKey: 'settle-key-0004', actor: act, now: w.clock() }))).rejects.toMatchObject({ code: 'HOLD_NOT_ENOUGH' });
    await expect(w.store.unit('v1', (tx) => postEntry(tx, { kind: 'RELEASE', amountPaise: 20_000, idempotencyKey: 'settle-key-0005', actor: act, now: w.clock() }))).rejects.toMatchObject({ code: 'HOLD_NOT_ENOUGH' });
  });
  it('a charge is reversed once, back into the same lot, and the reversal is not a refund (the money stays in the wallet)', async () => {
    const c = await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'CHARGE', amountPaise: 12_000, idempotencyKey: 'charge-key-0010', actor: act, now: w.clock() }));
    const rev = await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'REVERSAL', amountPaise: 12_000, reversesId: c.entry.id, idempotencyKey: 'reverse-key-0001', actor: act, now: w.clock() }));
    expect(rev.entry).toMatchObject({ kind: 'REVERSAL', amountPaise: 12_000, reversesId: c.entry.id });
    expect((await w.store.wallet('v1'))!.balancePaise).toBe(50_000);
    expect((await w.store.lots('v1'))[0]).toMatchObject({ remainingPaise: 50_000, status: 'OPEN' });
    await expect(w.store.unit('v1', (tx) => postEntry(tx, { kind: 'REVERSAL', amountPaise: 12_000, reversesId: c.entry.id, idempotencyKey: 'reverse-key-0002', actor: act, now: w.clock() }))).rejects.toMatchObject({ code: 'REVERSAL_INVALID' });
    expect(await w.svc.reconcileVendor('v1')).toMatchObject({ ok: true });
  });
  it('a request key reused for something else is refused and writes nothing', async () => {
    await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'CHARGE', amountPaise: 1_000, idempotencyKey: 'reuse-key-0001', actor: act, now: w.clock() }));
    const r = await codeOf(w.store.unit('v1', (tx) => postEntry(tx, { kind: 'CHARGE', amountPaise: 2_000, idempotencyKey: 'reuse-key-0001', actor: act, now: w.clock() })));
    expect([r.status, r.code]).toEqual([409, 'WALLET_IDEMPOTENCY_CONFLICT']);
    expect((await w.store.wallet('v1'))!.balancePaise).toBe(49_000);
  });
  it('INSUFFICIENT_WALLET carries the exact shortfall and a top-up inside the staff limits', async () => {
    const { walletHttpError } = await import('../src/v3-wallet/wallet.errors');
    const { WalletRuleError } = await import('../src/v3-wallet/core/wallet-core');
    const e = walletHttpError(new WalletRuleError('INSUFFICIENT_WALLET', 'x', { shortfallPaise: 3_000, availablePaise: 50_000, requiredPaise: 53_000 }), { minPaise: 10_000, maxPaise: 1_000_000 });
    expect(e.getStatus()).toBe(409);
    expect(e.getResponse()).toMatchObject({ code: 'INSUFFICIENT_WALLET', shortfallPaise: 3_000, suggestedTopupPaise: 10_000, minTopupPaise: 10_000, maxTopupPaise: 1_000_000, availablePaise: 50_000, requiredPaise: 53_000 });
    const big = walletHttpError(new WalletRuleError('INSUFFICIENT_WALLET', 'x', { shortfallPaise: 400_000 }), { minPaise: 10_000, maxPaise: 1_000_000 });
    expect(big.getResponse()).toMatchObject({ shortfallPaise: 400_000, suggestedTopupPaise: 400_000 });
    const none = walletHttpError(new WalletRuleError('INSUFFICIENT_WALLET', 'x', { shortfallPaise: 3_000 }));
    expect(Object.keys(none.getResponse() as object)).not.toContain('suggestedTopupPaise');
  });
});

describe('the usage statement: deductions are ledger lines and a statement, never an invoice (owner 5 November 2026)', () => {
  const sys = { type: 'SYSTEM' as const, id: null };
  beforeEach(async () => { await w.open('v1'); await w.open('v2'); await w.fund('v1', 500_000); await w.fund('v2', 100_000); });
  const spend = (vendor: string, kind: 'CHARGE' | 'PACK_PURCHASE', amount: number, key: string, refType: string) => w.store.unit(vendor, (tx) => postEntry(tx, { kind, amountPaise: amount, idempotencyKey: key, refType, refId: `ref-${key}`, actor: sys, now: w.clock() }));

  it('lists what was used, newest first, with the total by kind; a refill is not a usage line', async () => {
    await spend('v1', 'CHARGE', 29_900, 'use-key-0001', 'theme_switch'); advanceDays(w, 1);
    await spend('v1', 'PACK_PURCHASE', 99_900, 'use-key-0002', 'pack'); advanceDays(w, 1);
    await spend('v1', 'CHARGE', 9_900, 'use-key-0003', 'service_request');
    const s = await w.svc.usageStatement('v1', {});
    expect(s.lines.map((l) => [l.kind, l.refType, l.amountPaise])).toEqual([['CHARGE', 'service_request', 9_900], ['PACK_PURCHASE', 'pack', 99_900], ['CHARGE', 'theme_switch', 29_900]]);
    expect(s.totals).toMatchObject({ usedPaise: 139_700, reversedPaise: 0, netPaise: 139_700, byKind: { CHARGE: 39_800, PACK_PURCHASE: 99_900 } });
    expect(JSON.stringify(s)).not.toMatch(/invoice number|INV\//i); expect(s.note).toMatch(/only a refill has a tax invoice/i);
  });

  it('a reversal is shown against the use it reverses and the net follows', async () => {
    const c = await spend('v1', 'CHARGE', 29_900, 'use-key-0004', 'theme_switch');
    await w.store.unit('v1', (tx) => postEntry(tx, { kind: 'REVERSAL', amountPaise: 29_900, reversesId: c.entry.id, idempotencyKey: 'use-key-0005', actor: sys, now: w.clock() }));
    const s = await w.svc.usageStatement('v1', {});
    expect(s.totals).toMatchObject({ usedPaise: 29_900, reversedPaise: 29_900, netPaise: 0 }); expect(s.lines.map((l) => l.kind)).toEqual(['REVERSAL', 'CHARGE']);
  });

  it('a period filters the lines and the totals; a deduction creates no invoice anywhere', async () => {
    await spend('v1', 'CHARGE', 10_000, 'use-key-0006', 'service_request'); advanceDays(w, 40); await spend('v1', 'CHARGE', 20_000, 'use-key-0007', 'service_request');
    const from = new Date(w.clock().getTime() - 5 * 86_400_000);
    const s = await w.svc.usageStatement('v1', { from, to: new Date(w.clock().getTime() + 86_400_000) });
    expect(s.lines.map((l) => l.amountPaise)).toEqual([20_000]); expect(s.totals.usedPaise).toBe(20_000);
    expect(w.store.receipts).toHaveLength(2);   // only the two refills (500,000 and 100,000) ever got a document
  });

  it('is the vendor\'s own: another vendor sees none of it', async () => {
    await spend('v1', 'CHARGE', 10_000, 'use-key-0008', 'service_request');
    expect((await w.svc.usageStatement('v2', {})).lines).toEqual([]);
  });

  it('refuses a period that is the wrong way round or not a date', async () => {
    expect((await codeOf(w.svc.usageStatement('v1', { from: new Date('2026-12-01'), to: new Date('2026-11-01') }))).code).toBe('WALLET_STATEMENT_PERIOD_INVALID');
    expect((await codeOf(w.svc.usageStatement('v1', { from: new Date('nope') }))).code).toBe('WALLET_STATEMENT_PERIOD_INVALID');
  });
});
