import { createHash, createHmac } from 'crypto';
import { FakeRazorpay } from './support/fake-razorpay';
import { advance, billingWorld, BillingWorld, currentOf, paid, STAFF, SUPER, T0 } from './support/billing-world';

/** Slice 5.1b: the webhook (signature, replay, order of events), staff actions, invoice numbering, renewal reminders. */
const err = async (p: Promise<unknown>): Promise<{ code?: string; status?: number }> => { try { await p; return {}; } catch (e) { const r = e as { getResponse?: () => unknown; getStatus?: () => number }; return { code: ((r.getResponse?.() ?? {}) as { code?: string }).code, status: r.getStatus?.() }; } };
let w: BillingWorld;
beforeEach(() => { w = billingWorld(); });
const hook = (event: string, paymentId: string, o: Parameters<FakeRazorpay['webhook']>[2] = {}) => { const h = w.fake.webhook(event, paymentId, o); return w.settlement.handleWebhook(h.raw, h.signature, h.eventId); };

describe('the webhook', () => {
  it('a payment.captured with a good signature settles the order: PAID, one subscription, one invoice; the stored payload is REDACTED', async () => {
    const o = await w.buy(); const p = w.fake.pay(o.providerOrderId!); const h = w.fake.webhook('payment.captured', p.paymentId);
    expect(await w.settlement.handleWebhook(h.raw, h.signature, h.eventId)).toMatchObject({ status: 'OK', result: 'PAID' });
    expect(w.repo.orders.get(o.id)!.status).toBe('PAID'); expect(w.repo.invoices).toHaveLength(1); expect(currentOf(w).planId).toBe(w.ids.pro); expect(w.invalidated).toEqual(['v1']);
    const ev = w.repo.events.get(h.eventId)!; expect(ev).toMatchObject({ signatureValid: true, type: 'payment.captured', result: 'PAID', orderId: o.id }); expect(ev.processedAt).not.toBeNull();
    expect(JSON.stringify(ev.payloadRedacted)).not.toMatch(/buyer@example|9876543210|x@upi|1111|Visa|acc_test/); expect(JSON.stringify(ev.payloadRedacted)).toContain(p.paymentId);
  });
  it('a BAD or MISSING signature is refused and nothing is processed (only an empty record of the attempt is kept)', async () => {
    const o = await w.buy(); const p = w.fake.pay(o.providerOrderId!);
    const bad = w.fake.webhook('payment.captured', p.paymentId, { signWith: 'wrong-secret' });
    expect(await w.settlement.handleWebhook(bad.raw, bad.signature, bad.eventId)).toEqual({ status: 'BAD_SIGNATURE' });
    expect(await w.settlement.handleWebhook(bad.raw, undefined, bad.eventId)).toEqual({ status: 'BAD_SIGNATURE' });
    expect(await w.settlement.handleWebhook(undefined, bad.signature, bad.eventId)).toEqual({ status: 'BAD_SIGNATURE' });
    expect(await w.settlement.handleWebhook(Buffer.from(bad.raw + ' '), bad.signature, bad.eventId)).toEqual({ status: 'BAD_SIGNATURE' });   // one byte changed
    expect(w.repo.orders.get(o.id)!.status).toBe('PENDING_PAYMENT'); expect(w.repo.invoices).toHaveLength(0);
    for (const e of w.repo.events.values()) expect(e).toMatchObject({ signatureValid: false, payloadRedacted: {}, orderId: null });
    expect(w.repo.events.size).toBe(3);   // three different junk bodies, one record each
    await w.settlement.handleWebhook(bad.raw, bad.signature, bad.eventId); await w.settlement.handleWebhook(bad.raw, bad.signature, bad.eventId); expect(w.repo.events.size).toBe(3);   // the same junk is not stored again and again
  });
  it('REPLAY: the same event id again is a duplicate (still OK), changes nothing and does not extend the subscription twice', async () => {
    const o = await w.buy(); const p = w.fake.pay(o.providerOrderId!); const h = w.fake.webhook('payment.captured', p.paymentId);
    await w.settlement.handleWebhook(h.raw, h.signature, h.eventId); const endsAt = currentOf(w).endsAt;
    for (let i = 0; i < 3; i++) expect(await w.settlement.handleWebhook(h.raw, h.signature, h.eventId)).toMatchObject({ status: 'OK', duplicate: true });
    expect(currentOf(w).endsAt).toEqual(endsAt); expect(w.repo.subs.filter((s) => s.planId === w.ids.pro)).toHaveLength(1); expect(w.repo.invoices).toHaveLength(1);
  });
  it('a different event id for the SAME payment (the provider also sends order.paid) is safe: still one extension', async () => {
    const o = await w.buy(); const p = w.fake.pay(o.providerOrderId!);
    await hook('payment.captured', p.paymentId); expect(await hook('order.paid', p.paymentId)).toMatchObject({ status: 'OK', result: 'ALREADY_PAID' });
    expect(w.repo.subs.filter((s) => s.planId === w.ids.pro)).toHaveLength(1); expect(w.repo.invoices).toHaveLength(1);
  });
  it('without an event id header the body digest is the id, so the same body is still deduplicated', async () => {
    const o = await w.buy(); const p = w.fake.pay(o.providerOrderId!); const h = w.fake.webhook('payment.captured', p.paymentId);
    await w.settlement.handleWebhook(h.raw, h.signature, undefined); expect(await w.settlement.handleWebhook(h.raw, h.signature, undefined)).toMatchObject({ duplicate: true });
    expect(w.repo.events.has(`evt-${createHash('sha256').update(h.raw).digest('hex').slice(0, 40)}`)).toBe(true);
  });
  it('OUT OF ORDER: payment.failed arriving after the payment was captured is ignored; arriving before, it leaves the order payable', async () => {
    const o = await w.buy(); const failed = w.fake.pay(o.providerOrderId!, { status: 'failed' });
    expect(await hook('payment.failed', failed.paymentId)).toMatchObject({ status: 'OK', result: 'IGNORED' }); expect(w.repo.orders.get(o.id)!.status).toBe('PENDING_PAYMENT');
    const good = w.fake.pay(o.providerOrderId!); await hook('payment.captured', good.paymentId); expect(w.repo.orders.get(o.id)!.status).toBe('PAID');
    await hook('payment.failed', failed.paymentId); expect(w.repo.orders.get(o.id)!.status).toBe('PAID'); expect(w.repo.subs.filter((s) => s.planId === w.ids.pro)).toHaveLength(1);
  });
  it('an unknown order, an unknown event type and an unreadable body are recorded and answered OK without effect', async () => {
    const o = await w.buy(); const p = w.fake.pay(o.providerOrderId!);
    w.fake.payments.get(p.paymentId)!.orderId = 'order_unknown'; expect(await hook('payment.captured', p.paymentId)).toMatchObject({ status: 'OK', result: 'NO_ORDER' });
    w.fake.payments.get(p.paymentId)!.orderId = o.providerOrderId!; expect(await hook('subscription.charged', p.paymentId)).toMatchObject({ status: 'OK', result: 'IGNORED' });
    const raw = 'not json'; const sig = w.fake.webhook('x', p.paymentId); const junk = { raw, signature: createHmac('sha256', FakeRazorpay.WEBHOOK_SECRET).update(raw).digest('hex') };
    expect(await w.settlement.handleWebhook(junk.raw, junk.signature, 'evt_junk_1')).toMatchObject({ status: 'OK', result: 'IGNORED' }); void sig;
    expect(w.repo.orders.get(o.id)!.status).toBe('PENDING_PAYMENT');
  });
  it('payments off or not set up: the webhook is ignored with nothing stored', async () => {
    w.settings.over = { paymentsMode: 'off' }; const o = await w.buy().catch(() => null); void o;
    const h = { raw: '{}', signature: 'a'.repeat(64) }; expect(await w.settlement.handleWebhook(h.raw, h.signature, 'evt_x_1234')).toEqual({ status: 'IGNORED' }); expect(w.repo.events.size).toBe(0);
  });
  it('a webhook for an amount the order does not have goes to REVIEW; a payment for an EXPIRED order goes to REVIEW; neither activates', async () => {
    const a = await w.buy(); const pa = w.fake.pay(a.providerOrderId!, { amount: 1 }); expect(await hook('payment.captured', pa.paymentId)).toMatchObject({ result: 'REVIEW' });
    const b = await w.buy({ termMonths: 6 }); advance(w, 31 * 60); await w.settlement.expireStale(); const pb = w.fake.pay(b.providerOrderId!); expect(await hook('payment.captured', pb.paymentId)).toMatchObject({ result: 'REVIEW' });
    expect(currentOf(w).planId).toBe(w.ids.free); expect(w.repo.invoices).toHaveLength(0);
  });
  it('RACE: the webhook and the browser confirmation for the same payment, in either order, give exactly one extension and one invoice', async () => {
    for (const first of ['webhook', 'confirm'] as const) {
      const w2 = billingWorld(); const o = await w2.buy(); const p = w2.fake.pay(o.providerOrderId!); const h = w2.fake.webhook('payment.captured', p.paymentId);
      const run = { webhook: () => w2.settlement.handleWebhook(h.raw, h.signature, h.eventId), confirm: () => w2.orders.confirm('v1', o.id, { paymentId: p.paymentId, signature: p.signature }, { type: 'VENDOR', id: 'v1', ip: null }) };
      const other = first === 'webhook' ? 'confirm' : 'webhook';
      await Promise.all([run[first](), run[other](), run[first](), run[other]()]);
      expect(w2.repo.subs.filter((s) => s.planId === w2.ids.pro)).toHaveLength(1); expect(w2.repo.invoices).toHaveLength(1); expect(w2.repo.orders.get(o.id)!.status).toBe('PAID');
    }
  });
  it('if processing fails half way, nothing is kept and the provider\'s retry (same event id) is processed, not skipped as a duplicate', async () => {
    const o = await w.buy(); const p = w.fake.pay(o.providerOrderId!); const h = w.fake.webhook('payment.captured', p.paymentId);
    w.repo.failAssignOnce = true;
    await expect(w.settlement.handleWebhook(h.raw, h.signature, h.eventId)).rejects.toThrow('assign failed');
    expect(w.repo.orders.get(o.id)!.status).toBe('PENDING_PAYMENT'); expect(w.repo.invoices).toHaveLength(0); expect(w.repo.subs.filter((s) => s.planId === w.ids.pro)).toHaveLength(0); expect(w.repo.counters.get('2026-27') ?? 0).toBe(0);
    expect(await w.settlement.handleWebhook(h.raw, h.signature, h.eventId)).toMatchObject({ status: 'OK', result: 'PAID' }); expect(w.repo.invoices).toHaveLength(1);
  });
});

describe('invoices', () => {
  it('numbers are gap free and unique even when many orders are paid at once; a failed settlement does not burn a number', async () => {
    const orders = [];
    for (let i = 0; i < 6; i++) orders.push(await w.buy({}, i % 2 ? 'v2' : 'v1'));
    w.repo.failAssignOnce = true;
    const results = await Promise.all(orders.map((o) => { const p = w.fake.pay(o.providerOrderId!); const h = w.fake.webhook('payment.captured', p.paymentId); return w.settlement.handleWebhook(h.raw, h.signature, h.eventId).catch(() => 'failed'); }));
    expect(results.filter((r) => r === 'failed')).toHaveLength(1);
    const nums = w.repo.invoices.map((i) => i.invoiceNumber).sort(); expect(nums).toEqual(['INV/2026-27/000001', 'INV/2026-27/000002', 'INV/2026-27/000003', 'INV/2026-27/000004', 'INV/2026-27/000005']);
    const retry = orders.find((o) => ![...w.repo.invoices].some((i) => i.orderId === o.id))!; const p2 = w.fake.pay(retry.providerOrderId!); const h2 = w.fake.webhook('payment.captured', p2.paymentId); await w.settlement.handleWebhook(h2.raw, h2.signature, h2.eventId);
    expect(w.repo.invoices.map((i) => i.invoiceNumber).sort().at(-1)).toBe('INV/2026-27/000006');
  });
  it('the counter starts again at 1 in a new financial year', async () => {
    const a = await w.buy(); await paid(w, a); advance(w, 160 * 86_400);   // into 2027
    w.now.t = new Date('2027-04-02T10:00:00Z'); const b = await w.buy({ termMonths: 6 }); await paid(w, b);
    expect(w.repo.invoices.map((i) => i.invoiceNumber)).toEqual(['INV/2026-27/000001', 'INV/2027-28/000001']);
  });
  it('the invoice holds the seller from settings (empty until the owner supplies them), the buyer from the vendor profile, the tax split, and no card or bank detail', async () => {
    const a = await w.buy(); await paid(w, a); let inv = w.repo.invoices[0];
    expect(inv.snapshot).toMatchObject({ seller: { name: '', address: '', gstin: '', complete: false }, buyer: { businessName: 'Business v1', name: 'Owner v1', email: 'v1@x.invalid' }, plan: { key: 'handyman_pro' }, termMonths: 3, amountPaise: 354_000, currency: 'INR' });
    expect(inv.taxBreakdown).toMatchObject({ name: 'GST', ratePercent: 18, taxMinor: 54_000, taxableMinor: 300_000 });
    w.settings.over = { ...w.settings.over, invoiceSellerName: 'Example Seller', invoiceSellerAddress: '1 Road, City', invoiceSellerGstin: '29ABCDE1234F1Z5', invoiceNumberPrefix: 'ACME' };
    const b = await w.buy({ termMonths: 6 }); await paid(w, b); inv = w.repo.invoices[1];
    expect(inv.invoiceNumber).toBe('ACME/2026-27/000002'); expect((inv.snapshot as { seller: unknown }).seller).toMatchObject({ name: 'Example Seller', complete: true });
    expect(JSON.stringify(w.repo.invoices)).not.toMatch(/card|last4|pan|vpa|rzp_test|secret/i);
  });
  it('the plan and the entitlements change only after PAID: an unpaid, a review and an expired order leave the subscription alone', async () => {
    await w.buy(); const r = await w.buy({ termMonths: 6 }); const pr = w.fake.pay(r.providerOrderId!, { amount: 5 });
    await w.orders.confirm('v1', r.id, { paymentId: pr.paymentId, signature: pr.signature }, { type: 'VENDOR', id: 'v1', ip: null });
    expect(currentOf(w).planId).toBe(w.ids.free); expect(w.invalidated).toEqual([]);
  });
});

describe('staff', () => {
  it('SUPER_ADMIN marks an order paid offline: same subscription and invoice path, source STAFF, a reason is required, audited; PAID is idempotent', async () => {
    const o = await w.buy();
    await expect(w.settlement.markPaid(o.id, 'x', SUPER)).rejects.toThrow(/reason/);
    expect(await w.settlement.markPaid(o.id, 'bank transfer received', SUPER)).toEqual({ status: 'PAID', outcome: 'PAID' });
    expect(currentOf(w)).toMatchObject({ source: 'STAFF', planId: w.ids.pro }); expect(w.repo.invoices).toHaveLength(1);
    const order = w.repo.orders.get(o.id)!; expect(order).toMatchObject({ status: 'PAID', source: 'STAFF', reason: 'bank transfer received', paidAmountPaise: o.amountPaise }); expect(order.paymentId).toBe(`offline:${o.id}`);
    expect(w.repo.audits.find((a) => a.action === 'billing.order.paid')).toMatchObject({ actor: SUPER });
    expect(await w.settlement.markPaid(o.id, 'again please', SUPER)).toEqual({ status: 'PAID', outcome: 'ALREADY_PAID' }); expect(w.repo.invoices).toHaveLength(1);
  });
  it('an order under REVIEW can be marked paid by staff; a FAILED one, a CREATED one and an unknown one cannot', async () => {
    const r = await w.buy(); const p = w.fake.pay(r.providerOrderId!, { amount: 1 }); await w.orders.confirm('v1', r.id, { paymentId: p.paymentId, signature: p.signature }, { type: 'VENDOR', id: 'v1', ip: null });
    expect(w.repo.orders.get(r.id)!.status).toBe('REVIEW'); expect((await w.settlement.markPaid(r.id, 'checked with the bank', SUPER)).status).toBe('PAID');
    w.fake.failNextCreate = true; await err(w.buy({ termMonths: 6 })); const failed = [...w.repo.orders.values()].find((o) => o.status === 'FAILED')!;
    expect((await err(w.settlement.markPaid(failed.id, 'please', SUPER))).code).toBe('ORDER_STATE_INVALID'); expect((await err(w.settlement.markPaid('nope', 'please', SUPER))).code).toBe('ORDER_NOT_FOUND');
  });
  it('a refund is RECORDED only: no provider call, the subscription is untouched, the total cannot pass what was paid, only a paid order, a note is required', async () => {
    const o = await w.buy(); expect((await err(w.settlement.recordRefund(o.id, { amountPaise: 100, note: 'goodwill' }, SUPER))).code).toBe('ORDER_STATE_INVALID');
    await paid(w, o); const calls = { ...w.fake.calls }; const end = currentOf(w).endsAt;
    expect(await w.settlement.recordRefund(o.id, { amountPaise: 100_000, note: 'part refund by bank' }, SUPER)).toEqual({ refundRecordedPaise: 100_000 });
    expect(await w.settlement.recordRefund(o.id, { amountPaise: 54_000, note: 'second part' }, SUPER)).toEqual({ refundRecordedPaise: 154_000 });
    await expect(w.settlement.recordRefund(o.id, { amountPaise: 200_001, note: 'too much' }, SUPER)).rejects.toThrow(/more than was paid/);
    await expect(w.settlement.recordRefund(o.id, { amountPaise: 0, note: 'zero' }, SUPER)).rejects.toThrow(); await expect(w.settlement.recordRefund(o.id, { amountPaise: 1.5, note: 'half' }, SUPER)).rejects.toThrow();
    await expect(w.settlement.recordRefund(o.id, { amountPaise: 10, note: '' }, SUPER)).rejects.toThrow(/note/);
    expect(w.fake.calls).toEqual(calls); expect(currentOf(w).endsAt).toEqual(end); expect(w.repo.orders.get(o.id)).toMatchObject({ refundRecordedPaise: 154_000, refundRecordedBy: 'super-1', status: 'PAID' });
    expect(w.repo.audits.filter((a) => a.action === 'billing.order.refund_recorded')).toHaveLength(2); void STAFF;
  });
});

describe('renewal reminders (the cron tick)', () => {
  const live = async () => { const o = await w.buy(); await paid(w, o); return currentOf(w); };
  it('OFF by default: nothing happens; ON: the nearest offset is emailed (sandbox) once, a repeat tick sends nothing, and a renewal gives the next term fresh reminders', async () => {
    const sub = await live();   // ends 5 Feb 2027
    advance(w, 80 * 86_400); expect(await w.reminders.tick()).toEqual({ sent: 0, skipped: 0 });   // 13 days left; disabled
    w.settings.over = { ...w.settings.over, renewalRemindersEnabled: true };
    expect(await w.reminders.tick()).toEqual({ sent: 1, skipped: 0 }); expect(w.mailer.sent).toBe(1);
    expect(await w.reminders.tick()).toEqual({ sent: 0, skipped: 0 }); expect(w.repo.reminders).toEqual([{ subscriptionId: sub.id, daysBefore: 14, endsAt: sub.endsAt, kind: 'SENT' }]);
    advance(w, 6 * 86_400); expect(await w.reminders.tick()).toEqual({ sent: 1, skipped: 0 }); expect(w.repo.reminders.map((r) => r.daysBefore)).toEqual([14, 7]);
    const renew = await w.buy({ planKey: 'handyman_pro' }); await paid(w, renew); const sub2 = currentOf(w);
    expect(await w.reminders.tick()).toEqual({ sent: 0, skipped: 0 });   // far from the new end
    advance(w, 82 * 86_400); expect(await w.reminders.tick()).toEqual({ sent: 1, skipped: 0 }); expect(w.repo.reminders.at(-1)).toMatchObject({ subscriptionId: sub2.id, daysBefore: 14, kind: 'SENT' });
  });
  it('after downtime several offsets are due: only the nearest is emailed, the others are logged SKIPPED', async () => {
    const sub = await live(); w.settings.over = { ...w.settings.over, renewalRemindersEnabled: true }; w.now.t = new Date(sub.endsAt!.getTime() - 12 * 3_600_000);   // half a day left
    expect(await w.reminders.tick()).toEqual({ sent: 1, skipped: 2 }); expect(w.repo.reminders.map((r) => `${r.daysBefore}:${r.kind}`).sort()).toEqual(['14:SKIPPED', '1:SENT', '7:SKIPPED']);
  });
  it('two overlapping ticks never send the same reminder twice', async () => {
    await live(); w.settings.over = { ...w.settings.over, renewalRemindersEnabled: true }; advance(w, 80 * 86_400);
    const r = await Promise.all([w.reminders.tick(), w.reminders.tick(), w.reminders.tick()]); expect(r.reduce((n, x) => n + x.sent, 0)).toBe(1); expect(w.mailer.sent).toBe(1);
  });
  it('the text has no price and none of the retired names; a vendor who is only on Free, or whose term ended, gets nothing', async () => {
    const sub = await live(); w.settings.over = { ...w.settings.over, renewalRemindersEnabled: true }; advance(w, 80 * 86_400);
    let text = ''; w.mailer.send = async (m) => { text = `${m.subject} ${m.text}`; }; await w.reminders.tick();
    expect(text).toContain(sub.endsAt!.toISOString().slice(0, 10)); expect(text).not.toMatch(/₹|\bRs\.?\s?\d|\d+\s?(rupees|INR)|Workspace|\bBOS\b|LeadSpace|Online Identity/i);
    const w2 = billingWorld(); w2.settings.over = { ...w2.settings.over, renewalRemindersEnabled: true }; expect(await w2.reminders.tick()).toEqual({ sent: 0, skipped: 0 });
    advance(w, 200 * 86_400); expect(await w.reminders.tick()).toEqual({ sent: 0, skipped: 0 });
  });
  it('the tick also stops stale orders from being payable', async () => { await w.buy(); advance(w, 31 * 60); expect(await w.settlement.expireStale()).toBe(1); expect(T0.getTime()).toBeLessThan(w.now.t.getTime()); });
});
