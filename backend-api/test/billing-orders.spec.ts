import { advance, billingWorld, BillingWorld, currentOf, OTHER, paid, VENDOR } from './support/billing-world';

/** Slice 5.1b: creating an order (the quote, the rules about what may be bought) and confirming it (never trusting the browser). */
const err = async (p: Promise<unknown>): Promise<{ code?: string; status?: number; message?: string }> => {
  try { await p; return {}; } catch (e) { const r = e as { getResponse?: () => unknown; getStatus?: () => number }; const b = (r.getResponse?.() ?? {}) as { code?: string; message?: string }; return { code: b.code, message: b.message, status: r.getStatus?.() }; }
};
let w: BillingWorld;
beforeEach(() => { w = billingWorld(); });

describe('creating an order', () => {
  it('payments OFF (the default mode) refuses before anything is created', async () => {
    w.settings.over = { paymentsMode: 'off' };
    expect(await err(w.buy())).toMatchObject({ code: 'PAYMENTS_DISABLED', status: 409 }); expect(w.repo.orders.size).toBe(0); expect(w.fake.calls.createOrder).toBe(0);
  });
  it('the quote comes from the plan tables: approved price + tax from the tax table, integer paise; a provider order is created and the order waits for payment', async () => {
    const o = await w.buy();
    expect(o).toMatchObject({ status: 'PENDING_PAYMENT', kind: 'NEW', planKey: 'handyman_pro', termMonths: 3, amountPaise: 354_000, currency: 'INR', keyId: 'rzp_test_fakekey' }); expect(o.providerOrderId).toBe('order_1');
    expect(o.quote).toMatchObject({ base: 300_000, taxName: 'GST', taxRatePercent: 18, taxMinor: 54_000, totalMinor: 354_000, creditPaise: 0 });
    expect(Number.isInteger(o.amountPaise)).toBe(true); expect(o.expiresAt.getTime() - w.now.t.getTime()).toBe(30 * 60_000);
    expect(w.fake.orders.get('order_1')).toMatchObject({ amount: 354_000, currency: 'INR' });
    expect(currentOf(w).planId).toBe(w.ids.free);   // creating an order changes nothing about the plan
  });
  it('the 6 and 12 month terms are sold; 1, 2, 5 and 24 are not', async () => {
    expect((await w.buy({ termMonths: 6 })).amountPaise).toBe(Math.round(540_000 * 1.18)); expect((await w.buy({ termMonths: 12 })).amountPaise).toBe(Math.round(960_000 * 1.18));
    for (const t of [1, 2, 5, 24, 0, -3, 3.5]) expect(await err(w.buy({ termMonths: t }))).toMatchObject({ code: 'TERM_NOT_OFFERED', status: 400 });
  });
  it('a PROPOSED price, a price that starts in the future, or no price at all is PRICE_NOT_AVAILABLE; so is a missing tax rate', async () => {
    w.repo.prices.find((p) => p.planId === w.ids.pro && p.termMonths === 3)!.status = 'PROPOSED';
    expect(await err(w.buy())).toMatchObject({ code: 'PRICE_NOT_AVAILABLE', status: 409 });
    const p = w.repo.prices.find((x) => x.planId === w.ids.pro && x.termMonths === 3)!; p.status = 'APPROVED'; p.effectiveFrom = new Date('2027-01-01T00:00:00Z');
    expect((await err(w.buy())).code).toBe('PRICE_NOT_AVAILABLE');
    p.effectiveFrom = new Date('2026-01-01T00:00:00Z'); w.repo.taxes.length = 0; expect((await err(w.buy())).code).toBe('PRICE_NOT_AVAILABLE');
    expect(w.repo.orders.size).toBe(0);
  });
  it('only a PUBLIC, ACTIVE, PRO plan of the vendor\'s own track can be bought: a Free plan, a draft, a hidden plan, another track and an unknown key all give the same refusal', async () => {
    w.repo.plans.get(w.ids.plus)!.status = 'DRAFT';
    const refusals = [await err(w.buy({ planKey: 'handyman_free' })), await err(w.buy({ planKey: 'handyman_plus' })), await err(w.buy({ planKey: 'professional_pro' })), await err(w.buy({ planKey: 'nope' }))];
    w.repo.plans.get(w.ids.plus)!.status = 'ACTIVE'; w.repo.plans.get(w.ids.plus)!.isPublic = false; refusals.push(await err(w.buy({ planKey: 'handyman_plus' })));
    for (const r of refusals) expect(r).toMatchObject({ code: 'PLAN_NOT_PURCHASABLE', status: 409 });
    expect(new Set(refusals.map((r) => r.message)).size).toBe(1); expect(w.repo.orders.size).toBe(0);
  });
  it('a vendor with no subscription cannot buy (their track is unknown)', async () => { w.repo.subs.length = 0; expect((await err(w.buy())).code).toBe('PLAN_NOT_PURCHASABLE'); });
  it('discounts: an APPROVED promo code reduces the price before tax; an unapproved or wrong code does nothing', async () => {
    w.repo.discounts.push({ type: 'PROMO', name: 'Launch', percentOff: 10, amountOffPaise: null, conditions: { code: 'LAUNCH' }, stackable: true, active: true, status: 'APPROVED', validFrom: new Date('2026-01-01T00:00:00Z'), validTo: null });
    const withCode = await w.buy({}, 'v1'); expect(withCode.amountPaise).toBe(354_000);   // no code given
    const o = await w.orders.create('v1', { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: 'key-promo-abcdefgh', promoCode: 'launch' }, VENDOR);
    expect(o.amountPaise).toBe(Math.round(270_000 * 1.18)); expect(o.quote.discounts).toEqual([{ name: 'Launch', type: 'PROMO', amountPaise: 30_000 }]);
    const wrong = await w.orders.create('v1', { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: 'key-promo-wrong12', promoCode: 'nope' }, VENDOR); expect(wrong.amountPaise).toBe(354_000);
    w.repo.discounts[0].status = 'PROPOSED' as never; const draft = await w.orders.create('v1', { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: 'key-promo-draft12', promoCode: 'LAUNCH' }, VENDOR); expect(draft.amountPaise).toBe(354_000);
  });
  it('IDEMPOTENT: the same key returns the same order and creates no second provider order; the same key for a different plan or term is refused', async () => {
    const a = await w.buy({ idempotencyKey: 'same-key-abcdefgh' }); const b = await w.buy({ idempotencyKey: 'same-key-abcdefgh' });
    expect(b.id).toBe(a.id); expect(w.fake.calls.createOrder).toBe(1); expect(w.repo.orders.size).toBe(1);
    expect(await err(w.buy({ idempotencyKey: 'same-key-abcdefgh', termMonths: 6 }))).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
    expect(await err(w.buy({ idempotencyKey: 'same-key-abcdefgh', planKey: 'handyman_plus' }))).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    const c = await w.buy({ idempotencyKey: 'same-key-abcdefgh' }, 'v2'); expect(c.id).not.toBe(a.id);   // keys are per vendor
  });
  it('two requests with the same key at the same moment: one order', async () => {
    const [a, b] = await Promise.all([w.buy({ idempotencyKey: 'race-key-abcdefgh' }), w.buy({ idempotencyKey: 'race-key-abcdefgh' })]);
    expect(a.id).toBe(b.id); expect(w.repo.orders.size).toBe(1);
  });
  it('when the provider cannot create the order, the order is FAILED and the caller is told so; nothing is payable', async () => {
    w.fake.failNextCreate = true;
    expect(await err(w.buy())).toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR' }); expect([...w.repo.orders.values()][0].status).toBe('FAILED');
  });
  it('an amount that is not payable online (under one rupee after credit) is refused', async () => {
    w.repo.discounts.push({ type: 'PROMO', name: 'Free', percentOff: 100, amountOffPaise: null, conditions: {}, stackable: true, active: true, status: 'APPROVED', validFrom: new Date('2026-01-01T00:00:00Z'), validTo: null });
    expect(await err(w.buy())).toMatchObject({ code: 'ORDER_NOT_PAYABLE' });
  });
});

describe('renewals, upgrades and downgrades', () => {
  const makeCurrent = async (planKey: string) => { const o = await w.buy({ planKey }); await paid(w, o); return o; };
  it('buying the same plan while it runs is a RENEWAL: the new term is added to the END of the current one', async () => {
    const first = await makeCurrent('handyman_pro'); const end1 = currentOf(w).endsAt!;
    const again = await w.buy({ planKey: 'handyman_pro' }); expect(again.kind).toBe('RENEWAL'); await paid(w, again);
    const end2 = currentOf(w).endsAt!; expect(end2.getTime()).toBeGreaterThan(end1.getTime()); expect(end2.toISOString()).toBe(new Date(Date.UTC(2027, 4, 5, 10, 0, 0)).toISOString());   // 5 Nov 2026 + 3 + 3 months
    expect(first.kind).toBe('NEW');
  });
  it('renewing after the term ended starts from now (never backdated)', async () => {
    await makeCurrent('handyman_pro'); advance(w, 120 * 86_400); const o = await w.buy({ planKey: 'handyman_pro' }); expect(o.kind).toBe('NEW'); await paid(w, o);
    expect(currentOf(w).endsAt!.getTime()).toBeGreaterThan(w.now.t.getTime() + 80 * 86_400_000);
  });
  it('a dearer plan mid-term is an UPGRADE; with upgradeProration NONE there is no credit, with PRORATE the unused whole months are credited at the old monthly rate', async () => {
    await makeCurrent('handyman_pro'); advance(w, 40 * 86_400);   // about 1.4 months used of 3: one whole month unused... remaining is 1.6 months => 1 whole month
    const none = await w.buy({ planKey: 'handyman_plus', termMonths: 3 }); expect(none).toMatchObject({ kind: 'UPGRADE' }); expect(none.quote.creditPaise).toBe(0); expect(none.amountPaise).toBe(Math.round(600_000 * 1.18));
    w.settings.over = { ...w.settings.over, upgradeProration: 'PRORATE' };
    const credit = await w.buy({ planKey: 'handyman_plus', termMonths: 3 });
    expect(credit.quote.creditPaise).toBe(100_000); expect(credit.amountPaise).toBe(Math.round(500_000 * 1.18));
  });
  it('an upgrade starts a new term from now on the new plan; the old subscription is closed', async () => {
    await makeCurrent('handyman_pro'); const up = await w.buy({ planKey: 'handyman_plus' }); await paid(w, up);
    expect(w.repo.plans.get(currentOf(w).planId)!.key).toBe('handyman_plus'); expect(w.repo.subs.filter((s) => s.vendorId === 'v1' && s.current)).toHaveLength(1);
    expect(currentOf(w).endsAt!.toISOString()).toBe(new Date(Date.UTC(2027, 1, 5, 10, 0, 0)).toISOString());
  });
  it('a cheaper plan mid-term is NOT sold (downgrades take effect at term end): PLAN_CHANGE_NOT_ALLOWED; once the term has ended it is an ordinary NEW purchase', async () => {
    await makeCurrent('handyman_plus');
    expect(await err(w.buy({ planKey: 'handyman_pro' }))).toMatchObject({ code: 'PLAN_CHANGE_NOT_ALLOWED', status: 409 });
    advance(w, 200 * 86_400); expect((await w.buy({ planKey: 'handyman_pro' })).kind).toBe('NEW');
  });
});

describe('confirming a payment (the browser is never trusted)', () => {
  it('the right signature, a CAPTURED payment of the exact amount: the order is PAID, the plan is created, an invoice is written, the entitlement cache is told', async () => {
    const o = await w.buy(); const done = await paid(w, o);
    expect(done.status).toBe('PAID'); expect(done.paidAt).toEqual(w.now.t);
    const cur = currentOf(w); expect(w.repo.plans.get(cur.planId)!.key).toBe('handyman_pro'); expect(cur.source).toBe('SELF'); expect(cur.termMonths).toBe(3);
    expect(w.repo.subs.filter((s) => s.vendorId === 'v1')).toHaveLength(2);   // the Free subscription was closed, a new one opened
    expect(w.repo.invoices).toHaveLength(1); expect(w.repo.invoices[0]).toMatchObject({ invoiceNumber: 'INV/2026-27/000001', financialYear: '2026-27', orderId: o.id });
    expect(w.invalidated).toEqual(['v1']); expect(w.repo.audits.map((a) => a.action)).toEqual(expect.arrayContaining(['subscription.assign', 'billing.order.paid']));
  });
  it('a WRONG signature is refused (400) and changes nothing: no subscription, no invoice, the order still waits', async () => {
    const o = await w.buy(); const p = w.fake.pay(o.providerOrderId!);
    expect(await err(w.orders.confirm('v1', o.id, { paymentId: p.paymentId, signature: 'f'.repeat(64) }, VENDOR))).toMatchObject({ code: 'PAYMENT_SIGNATURE_INVALID', status: 400 });
    expect(await err(w.orders.confirm('v1', o.id, { paymentId: p.paymentId, signature: 'not hex' }, VENDOR))).toMatchObject({ code: 'PAYMENT_SIGNATURE_INVALID' });
    expect(w.repo.orders.get(o.id)!.status).toBe('PENDING_PAYMENT'); expect(w.repo.invoices).toHaveLength(0); expect(currentOf(w).planId).toBe(w.ids.free);
  });
  it('a valid signature is NOT enough: the provider is asked, and an authorized-only payment leaves the order waiting, a failed one is refused', async () => {
    const o = await w.buy(); const a = w.fake.pay(o.providerOrderId!, { status: 'authorized' });
    expect(await w.orders.confirm('v1', o.id, { paymentId: a.paymentId, signature: a.signature }, VENDOR)).toMatchObject({ pending: true, status: 'PENDING_PAYMENT' });
    const f = w.fake.pay(o.providerOrderId!, { status: 'failed' });
    expect(await err(w.orders.confirm('v1', o.id, { paymentId: f.paymentId, signature: f.signature }, VENDOR))).toMatchObject({ code: 'PAYMENT_NOT_CAPTURED' });
    expect(currentOf(w).planId).toBe(w.ids.free); expect(w.repo.invoices).toHaveLength(0);
  });
  it('a payment that belongs to ANOTHER provider order is refused even with a signature for that pair', async () => {
    const a = await w.buy(); const b = await w.buy({ termMonths: 6 }); const p = w.fake.pay(b.providerOrderId!);
    expect(await err(w.orders.confirm('v1', a.id, { paymentId: p.paymentId, signature: w.fake.signature(a.providerOrderId!, p.paymentId) }, VENDOR))).toMatchObject({ code: 'PAYMENT_SIGNATURE_INVALID' });
    expect(currentOf(w).planId).toBe(w.ids.free);
  });
  it('AMOUNT MISMATCH: the provider reports a different amount or currency: the order goes to REVIEW and nothing is activated', async () => {
    const a = await w.buy(); const pa = w.fake.pay(a.providerOrderId!, { amount: a.amountPaise - 100 });
    expect((await w.orders.confirm('v1', a.id, { paymentId: pa.paymentId, signature: pa.signature }, VENDOR)).status).toBe('REVIEW');
    const b = await w.buy({ termMonths: 6 }); const pb = w.fake.pay(b.providerOrderId!, { currency: 'USD' });
    expect((await w.orders.confirm('v1', b.id, { paymentId: pb.paymentId, signature: pb.signature }, VENDOR)).status).toBe('REVIEW');
    expect(currentOf(w).planId).toBe(w.ids.free); expect(w.repo.invoices).toHaveLength(0); expect(w.repo.audits.filter((x) => x.action === 'billing.order.review')).toHaveLength(2);
  });
  it('an EXPIRED order that gets paid anyway goes to REVIEW and never activates', async () => {
    const o = await w.buy(); advance(w, 31 * 60); expect(await w.settlement.expireStale()).toBe(1); expect(w.repo.orders.get(o.id)!.status).toBe('EXPIRED');
    const p = w.fake.pay(o.providerOrderId!);
    expect(await err(w.orders.confirm('v1', o.id, { paymentId: p.paymentId, signature: p.signature }, VENDOR))).toMatchObject({ code: 'ORDER_STATE_INVALID' });   // the browser path refuses a closed order
    expect(await w.settlement.settle({ orderId: o.id, paid: { paymentId: p.paymentId, amount: o.amountPaise, currency: 'INR' }, via: 'WEBHOOK', actor: { type: 'SYSTEM', id: null, ip: null }, reason: null })).toBe('REVIEW');
    expect(w.repo.orders.get(o.id)!.status).toBe('REVIEW'); expect(currentOf(w).planId).toBe(w.ids.free);
  });
  it('DOUBLE CONFIRM: confirming twice, or five times at once, gives exactly one subscription extension and one invoice', async () => {
    const o = await w.buy(); const p = w.fake.pay(o.providerOrderId!);
    const rs = await Promise.all(Array.from({ length: 5 }, () => err(w.orders.confirm('v1', o.id, { paymentId: p.paymentId, signature: p.signature }, VENDOR))));
    expect(rs.every((r) => !r.code)).toBe(true);
    expect(w.repo.subs.filter((s) => s.vendorId === 'v1' && s.planId === w.ids.pro)).toHaveLength(1); expect(w.repo.invoices).toHaveLength(1);
    await w.orders.confirm('v1', o.id, { paymentId: p.paymentId, signature: p.signature }, VENDOR); expect(w.repo.invoices).toHaveLength(1); expect(w.repo.subs.filter((s) => s.planId === w.ids.pro)).toHaveLength(1);
  });
  it('another vendor cannot confirm, and gets the same answer as for an order that does not exist', async () => {
    const o = await w.buy(); const p = w.fake.pay(o.providerOrderId!);
    const other = await err(w.orders.confirm('v2', o.id, { paymentId: p.paymentId, signature: p.signature }, OTHER)); const none = await err(w.orders.confirm('v2', 'nope', { paymentId: p.paymentId, signature: p.signature }, OTHER));
    expect(other).toMatchObject({ code: 'ORDER_NOT_FOUND', status: 404 }); expect(other).toEqual(none); expect(w.repo.orders.get(o.id)!.status).toBe('PENDING_PAYMENT');
  });
  it('payments switched off after the order was made: confirm is refused, nothing activates', async () => {
    const o = await w.buy(); const p = w.fake.pay(o.providerOrderId!); w.settings.over = { paymentsMode: 'off' };
    expect((await err(w.orders.confirm('v1', o.id, { paymentId: p.paymentId, signature: p.signature }, VENDOR))).code).toBe('PAYMENTS_DISABLED'); expect(currentOf(w).planId).toBe(w.ids.free);
  });
  it('the vendor sees only their own orders and invoices, newest first, with no refund or staff fields', async () => {
    const a = await w.buy(); await paid(w, a); await w.buy({ termMonths: 6 }, 'v2');
    const mine = await w.orders.listMine('v1', 1, 25); expect(mine.total).toBe(1); expect(Object.keys(mine.items[0]).sort()).toEqual(['amountPaise', 'createdAt', 'currency', 'expiresAt', 'id', 'keyId', 'kind', 'paidAt', 'planKey', 'providerOrderId', 'quote', 'status', 'termMonths']);
    expect((await w.orders.invoicesMine('v1', 1, 25)).total).toBe(1); expect((await w.orders.invoicesMine('v2', 1, 25)).total).toBe(0);
  });
});
