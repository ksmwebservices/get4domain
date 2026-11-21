import { HeldPaymentsService } from '../src/plan-billing/held-payments.service';
import { checkHeldResolution } from '../src/plan-billing/core/held-core';
import { BILLING_ERROR_CODES } from '../src/plan-billing/plan-billing.errors';
import { ForbiddenException } from '@nestjs/common';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { effectiveRolesFor, effectiveStaffRole } from '../src/auth/guards/admin-role-matrix';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';
import { currentOf, SUPER } from './support/billing-world';
import { deliver, flow, Flow } from './support/wave3-world';

/** Wave 4 W2: held payments. An ADMIN or SUPER_ADMIN accepts (only the exact order total) or rejects; both idempotent and audited; no refund here. */

const code = (e: unknown): string => ((e as { getResponse?: () => { code?: string } })?.getResponse?.() ?? (e as { response?: { code?: string } })?.response)?.code ?? '';
const err = async (p: Promise<unknown>): Promise<unknown> => { try { await p; } catch (e) { return e; } throw new Error('expected a refusal'); };
const ADMIN_ACTOR = { type: 'STAFF' as const, id: 'admin-1', ip: null };

/** an order whose payment was held: the gateway reported 354001 against a 354000 order */
async function held(name: 'razorpay' | 'cashfree' = 'razorpay', mail?: { send: (m: Record<string, unknown>) => Promise<void> }) {
  const f = flow(name); const o = await f.buy();
  const d = deliver(f, name, o, { amountMinor: 354001, paymentId: name === 'razorpay' ? 'pay_held1' : '777001', eventId: 'evt_held_0001' });
  expect(await f.settlement.handleGatewayWebhook(name, d.raw, d.headers)).toMatchObject({ result: 'REVIEW' });
  const svc = new HeldPaymentsService(f.w.repo, f.settlement, mail as never); svc.clock = () => new Date(f.w.now.t);
  return { f, o, svc };
}
const accept = (svc: HeldPaymentsService, id: string, over: Record<string, unknown> = {}, actor = ADMIN_ACTOR) => svc.resolve(id, { action: 'ACCEPT', note: 'checked the gateway dashboard', verifiedAmountPaise: 354000, gatewayPaymentId: 'pay_held1', ...over }, actor, 'Admin A');
const reject = (svc: HeldPaymentsService, id: string, over: Record<string, unknown> = {}) => svc.resolve(id, { action: 'REJECT', note: 'the payment was for another business', ...over }, ADMIN_ACTOR, 'Admin A');

describe('checkHeldResolution (pure)', () => {
  it('accepts a complete ACCEPT and a REJECT that needs only a note, and cleans the text', () => {
    expect(checkHeldResolution({ action: 'ACCEPT', note: '  checked   ok ', verifiedAmountPaise: 354000, gatewayPaymentId: ' pay_1 ' })).toEqual({ ok: true, value: { action: 'ACCEPT', note: 'checked ok', verifiedAmountPaise: 354000, gatewayPaymentId: 'pay_1' } });
    expect(checkHeldResolution({ action: 'REJECT', note: 'not ours' })).toEqual({ ok: true, value: { action: 'REJECT', note: 'not ours' } });
  });
  it('names every bad field at once', () => {
    const r = checkHeldResolution({ action: 'ACCEPT' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fields).sort()).toEqual(['gatewayPaymentId', 'note', 'verifiedAmountPaise']);
    expect(checkHeldResolution({ action: 'REFUND', note: 'xxxx' })).toMatchObject({ ok: false, fields: { action: expect.any(String) } });
    for (const verifiedAmountPaise of [0, -5, 1.5, '354000', null, NaN]) expect(checkHeldResolution({ action: 'ACCEPT', note: 'okay', gatewayPaymentId: 'pay_1', verifiedAmountPaise })).toMatchObject({ ok: false, fields: { verifiedAmountPaise: expect.any(String) } });
    for (const note of ['', 'ab', 'x'.repeat(301), 5, undefined]) expect(checkHeldResolution({ action: 'REJECT', note })).toMatchObject({ ok: false, fields: { note: expect.any(String) } });
  });
  it('the registered error codes exist', () => { for (const c of ['HELD_PAYMENT_NOT_FOUND', 'HELD_PAYMENT_INVALID', 'HELD_AMOUNT_MISMATCH', 'HELD_ALREADY_RESOLVED']) expect(BILLING_ERROR_CODES).toContain(c); });
});

describe.each(['razorpay', 'cashfree'] as const)('held payments on %s', (name) => {
  it('lists and shows the held payment: expected total, amount seen, gateway ids, why', async () => {
    const { o, svc } = await held(name);
    const l = await svc.list({ skip: 0, take: 20 });
    expect(l.total).toBe(1);
    expect(l.items[0]).toMatchObject({ id: o.id, vendorId: 'v1', gateway: name, status: 'REVIEW', heldReason: 'AMOUNT_MISMATCH', expectedTotalPaise: 354000, amountSeenPaise: 354001, resolution: null });
    expect(l.items[0].gatewayPaymentId).toBeTruthy(); expect(l.items[0].providerOrderId).toBeTruthy();
    expect(await svc.detail(o.id)).toMatchObject({ id: o.id, expectedTotalPaise: 354000, amountSeenPaise: 354001 });
  });

  it('filters by business, gateway and day, and pages', async () => {
    const { svc, o } = await held(name);
    expect((await svc.list({ vendorId: 'v2', skip: 0, take: 20 })).total).toBe(0);
    expect((await svc.list({ vendorId: 'v1', skip: 0, take: 20 })).total).toBe(1);
    expect((await svc.list({ gateway: name === 'razorpay' ? 'cashfree' : 'razorpay', skip: 0, take: 20 })).total).toBe(0);
    expect((await svc.list({ gateway: name, skip: 0, take: 20 })).total).toBe(1);
    expect((await svc.list({ from: new Date('2026-11-06T00:00:00Z'), skip: 0, take: 20 })).total).toBe(0);
    expect((await svc.list({ from: new Date('2026-11-05T00:00:00Z'), to: new Date('2026-11-06T00:00:00Z'), skip: 0, take: 20 })).total).toBe(1);
    expect((await svc.list({ skip: 1, take: 20 })).items).toEqual([]);
    expect(o.id).toBeTruthy();
  });

  it('ACCEPT with the exact total activates the plan and makes the invoice in one go, audited', async () => {
    const { f, o, svc } = await held(name);
    expect(currentOf(f.w).planId).toBe(f.w.ids.free); expect(f.invoices()).toBe(0);
    const r = await accept(svc, o.id);
    expect(r).toMatchObject({ status: 'PAID', outcome: 'ACCEPTED', invoice: { number: expect.any(String) } });
    expect(currentOf(f.w).planId).not.toBe(f.w.ids.free); expect(f.invoices()).toBe(1);
    expect(f.w.repo.orders.get(o.id)).toMatchObject({ status: 'PAID', paymentId: 'pay_held1', paidAmountPaise: 354000, reason: 'checked the gateway dashboard', settledByName: 'Admin A' });
    expect(f.w.repo.audits.filter((a) => a.action === 'billing.held.accepted' && a.entityId === o.id && a.actor.id === 'admin-1')).toHaveLength(1);
    expect(await svc.detail(o.id)).toMatchObject({ resolution: 'ACCEPTED', resolvedBy: 'Admin A', note: 'checked the gateway dashboard' });
  });

  it('ACCEPT with any other amount is refused with HELD_AMOUNT_MISMATCH and changes nothing, even the amount the gateway first reported', async () => {
    const { f, o, svc } = await held(name);
    for (const verifiedAmountPaise of [354001, 353999, 1, 3540000]) expect(code(await err(accept(svc, o.id, { verifiedAmountPaise })))).toBe('HELD_AMOUNT_MISMATCH');
    expect(f.w.repo.orders.get(o.id)!.status).toBe('REVIEW'); expect(f.invoices()).toBe(0); expect(currentOf(f.w).planId).toBe(f.w.ids.free);
    expect(f.w.repo.audits.some((a) => a.action === 'billing.held.accepted')).toBe(false);
  });

  it('ACCEPT is idempotent: the same call again changes nothing; one invoice, one extension', async () => {
    const { f, o, svc } = await held(name);
    await accept(svc, o.id);
    const end = currentOf(f.w).endsAt;
    expect(await accept(svc, o.id)).toMatchObject({ status: 'PAID', outcome: 'ALREADY_ACCEPTED' });
    expect(f.invoices()).toBe(1); expect(currentOf(f.w).endsAt).toEqual(end);
    expect(f.w.repo.audits.filter((a) => a.action === 'billing.held.accepted')).toHaveLength(1);
  });

  it('REJECT marks the order failed with the note, activates nothing, and is idempotent', async () => {
    const { f, o, svc } = await held(name);
    expect(await reject(svc, o.id)).toMatchObject({ status: 'FAILED', outcome: 'REJECTED' });
    expect(f.w.repo.orders.get(o.id)).toMatchObject({ status: 'FAILED', reason: 'the payment was for another business', settledByName: 'Admin A' });
    expect(currentOf(f.w).planId).toBe(f.w.ids.free); expect(f.invoices()).toBe(0);
    expect(await reject(svc, o.id)).toMatchObject({ outcome: 'ALREADY_REJECTED' });
    expect(f.w.repo.audits.filter((a) => a.action === 'billing.held.rejected' && a.actor.id === 'admin-1')).toHaveLength(1);
    expect(await svc.detail(o.id)).toMatchObject({ resolution: 'REJECTED', note: 'the payment was for another business' });
    expect((await svc.list({ skip: 0, take: 20 })).total).toBe(0);   // no longer held
  });

  it('a rejected payment cannot be accepted later, and an accepted one cannot be rejected: HELD_ALREADY_RESOLVED', async () => {
    const a = await held(name); await reject(a.svc, a.o.id);
    expect(code(await err(accept(a.svc, a.o.id)))).toBe('HELD_ALREADY_RESOLVED');
    const b = await held(name); await accept(b.svc, b.o.id);
    expect(code(await err(reject(b.svc, b.o.id)))).toBe('HELD_ALREADY_RESOLVED');
    expect(code(await err(accept(b.svc, b.o.id, { gatewayPaymentId: 'pay_other_2' })))).toBe('HELD_ALREADY_RESOLVED');   // a different payment id is not the same acceptance
  });

  it('a late webhook for a rejected order does not bring it back', async () => {
    const { f, o, svc } = await held(name); await reject(svc, o.id);
    const d = deliver(f, name, o, { amountMinor: 354000, paymentId: name === 'razorpay' ? 'pay_late2' : '777002', eventId: 'evt_late_0002' });
    await f.settlement.handleGatewayWebhook(name, d.raw, d.headers);
    expect(f.w.repo.orders.get(o.id)!.status).toBe('FAILED'); expect(f.invoices()).toBe(0);
  });

  it('an order that is not held (still waiting, or unknown) answers HELD_PAYMENT_NOT_FOUND, and a bad body is HELD_PAYMENT_INVALID', async () => {
    const { f, svc } = await held(name); const fresh = await f.buy({}, 'v2');
    expect(code(await err(svc.detail(fresh.id)))).toBe('HELD_PAYMENT_NOT_FOUND');
    expect(code(await err(accept(svc, fresh.id)))).toBe('HELD_PAYMENT_NOT_FOUND');
    expect(code(await err(reject(svc, fresh.id)))).toBe('HELD_PAYMENT_NOT_FOUND');
    expect(code(await err(svc.detail('no-such-order')))).toBe('HELD_PAYMENT_NOT_FOUND');
    expect(code(await err(accept(svc, 'no-such-order')))).toBe('HELD_PAYMENT_NOT_FOUND');
    expect(code(await err(svc.resolve(fresh.id, { action: 'ACCEPT' }, ADMIN_ACTOR, 'A')))).toBe('HELD_PAYMENT_INVALID');
  });

  it('money for a closed (expired) order is held too and can be accepted only at the exact total', async () => {
    const f = flow(name); const o = await f.buy();
    f.w.repo.orders.get(o.id)!.status = 'EXPIRED';
    const d = deliver(f, name, o, { amountMinor: 354000, paymentId: name === 'razorpay' ? 'pay_closed1' : '777003', eventId: 'evt_closed_001' });
    expect(await f.settlement.handleGatewayWebhook(name, d.raw, d.headers)).toMatchObject({ result: 'REVIEW' });
    const svc = new HeldPaymentsService(f.w.repo, f.settlement);
    expect((await svc.list({ skip: 0, take: 20 })).items[0]).toMatchObject({ heldReason: 'CURRENCY_OR_LATE_PAYMENT' });
    expect(code(await err(accept(svc, o.id, { verifiedAmountPaise: 100, gatewayPaymentId: 'pay_closed1' })))).toBe('HELD_AMOUNT_MISMATCH');
    expect(await accept(svc, o.id, { gatewayPaymentId: 'pay_closed1' })).toMatchObject({ outcome: 'ACCEPTED' });
  });
});

describe('the vendor message on REJECT (mail port, flag OFF by default)', () => {
  it('a refusing port (mail not live) leaves the message PENDING, never blocks the rejection', async () => {
    const sent: unknown[] = [];
    const port = { send: async (m: Record<string, unknown>) => { sent.push(m); throw Object.assign(new Error('off'), { response: { code: 'EMAIL_NOT_LIVE' } }); } };
    const { o, svc } = await held('razorpay', port);
    expect(await reject(svc, o.id)).toMatchObject({ outcome: 'REJECTED', mail: 'PENDING' });
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(sent[0])).not.toMatch(/354|rupee|₹/i);   // no amount in the text
  });
  it('a live port sends once; a transport failure is FAILED; no port is PENDING; a vendor with no address is NO_ADDRESS', async () => {
    const sent: unknown[] = [];
    const a = await held('razorpay', { send: async (m) => { sent.push(m); } });
    expect(await reject(a.svc, a.o.id)).toMatchObject({ mail: 'SENT' }); expect(sent).toHaveLength(1);
    await reject(a.svc, a.o.id); expect(sent).toHaveLength(1);   // the repeat sends nothing
    const b = await held('razorpay', { send: async () => { throw new Error('provider down'); } });
    expect(await reject(b.svc, b.o.id)).toMatchObject({ outcome: 'REJECTED', mail: 'FAILED' });
    const c = await held('razorpay');
    expect(await reject(c.svc, c.o.id)).toMatchObject({ mail: 'PENDING' });
    const d = await held('razorpay', { send: async () => undefined }); d.f.w.repo.vendors.get('v1')!.email = null as never;
    expect(await reject(d.svc, d.o.id)).toMatchObject({ mail: 'NO_ADDRESS' });
  });
});

describe('the role matrix for the three routes: ADMIN and SUPER_ADMIN only', () => {
  const ROUTES = ['GET /v3/admin/billing/held-payments', 'GET /v3/admin/billing/held-payments/:id', 'POST /v3/admin/billing/held-payments/:id/resolve'];
  const principal = (adminRole?: string, over: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({ sub: 's', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: effectiveStaffRole(adminRole), ...over });
  const may = (u: AuthenticatedUser | undefined, key: string): boolean => {
    const [method, ...r] = key.split(' ');
    try { return new AdminGuard().canActivate({ switchToHttp: () => ({ getRequest: () => ({ user: u, method, route: { path: r.join(' ') } }) }) } as never); } catch (e) { if (e instanceof ForbiddenException) return false; throw e; }
  };
  it('exactly ADMIN and SUPER_ADMIN, by the data and by the guard', () => {
    for (const k of ROUTES) { expect([...effectiveRolesFor(k)].sort()).toEqual(['ADMIN', 'SUPER_ADMIN']); expect(may(principal('ADMIN'), k)).toBe(true); expect(may(principal('SUPER_ADMIN'), k)).toBe(true); }
  });
  it('OPERATIONS, SALES, FIELD_EXECUTIVE, TELECALLER, SUPPORT, a vendor, a partner and anonymous are refused', () => {
    for (const role of ['OPERATIONS', 'MARKETING', 'FIELD_EXECUTIVE', 'TELECALLER', 'SUPPORT']) for (const k of ROUTES) expect([role, k, may(principal(role), k)]).toEqual([role, k, false]);
    for (const u of [{ sub: 'v', email: 'v@x.invalid', role: 'VENDOR' }, { sub: 'p', email: 'p@x.invalid', role: 'PARTNER', kind: 'referral_partner' }, undefined] as Array<AuthenticatedUser | undefined>) for (const k of ROUTES) expect(may(u, k)).toBe(false);
  });
});

export type { Flow };
void SUPER;
