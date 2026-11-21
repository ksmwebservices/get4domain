import * as fs from 'fs';
import * as path from 'path';
import { ForbiddenException } from '@nestjs/common';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { effectiveRolesFor, effectiveStaffRole } from '../src/auth/guards/admin-role-matrix';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';
import { checkCashConfirmation } from '../src/plan-billing/core/cash-core';
import { renderInvoiceHtml } from '../src/v3-vendor-gaps/core/gaps-core';
import { currentOf, STAFF, SUPER, VENDOR } from './support/billing-world';
import { flow, Flow } from './support/wave3-world';

/** Wave 3 Part E: cash confirmed by an ADMIN or SUPER_ADMIN, for a cash order, with every detail required. The vendor can never pay by hand. */

const TODAY = '2026-11-05';
const good = (over: Record<string, unknown> = {}) => ({ method: 'CASH', reference: 'RCPT-1001', receivedOn: '2026-11-04', amountPaise: 354000, specialCase: true, reason: 'paid cash at the office, no card or bank', ...over });
const code = (e: unknown): string => ((e as { getResponse?: () => { code?: string } })?.getResponse?.() ?? (e as { response?: { code?: string } })?.response)?.code ?? '';
const err = async (p: Promise<unknown>): Promise<unknown> => { try { await p; } catch (e) { return e; } throw new Error('expected a refusal'); };

describe('checkCashConfirmation (pure)', () => {
  it('accepts a complete confirmation and cleans the text', () => {
    expect(checkCashConfirmation(good({ reference: '  RCPT   1001 ', reason: '  paid cash   at the office ' }), 354000, TODAY)).toEqual({ ok: true, value: { reference: 'RCPT 1001', receivedOn: '2026-11-04', amountPaise: 354000, note: 'paid cash at the office' } });
  });
  it('anything but CASH is refused first, by its own code: bank, UPI, card, cheque, nothing', () => {
    for (const method of ['BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'cash', '', undefined, null, 1, {}]) {
      const r = checkCashConfirmation(good({ method }), 354000, TODAY);
      expect(r).toMatchObject({ ok: false, code: 'CASH_ONLY' });
    }
  });
  it('names every missing or bad field at once', () => {
    const r = checkCashConfirmation({ method: 'CASH' }, 354000, TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.code).toBe('CASH_DETAILS_INVALID'); expect(Object.keys(r.fields).sort()).toEqual(['amountPaise', 'reason', 'receivedOn', 'reference', 'specialCase']); }
  });
  it('the reference needs 3 to 200 characters with no control characters', () => {
    for (const reference of ['', 'ab', 'x'.repeat(201), 'ok\u0000no', 'ok\u001bno', 5, null]) expect(checkCashConfirmation(good({ reference }), 354000, TODAY)).toMatchObject({ ok: false, fields: { reference: expect.any(String) } });
    expect(checkCashConfirmation(good({ reference: 'line\nbreak\tand  spaces' }), 354000, TODAY)).toMatchObject({ ok: true, value: { reference: 'line break and spaces' } });   // whitespace is normalised, never kept as a line break
  });
  it('the day received must be a real day, not in the future, and not more than a year ago', () => {
    for (const receivedOn of ['', '2026-02-30', '2026-13-01', '04-11-2026', '2026-11-06', '2027-01-01', '2025-10-01', 20261104, null]) expect(checkCashConfirmation(good({ receivedOn }), 354000, TODAY)).toMatchObject({ ok: false, fields: { receivedOn: expect.any(String) } });
    expect(checkCashConfirmation(good({ receivedOn: TODAY }), 354000, TODAY).ok).toBe(true);
    expect(checkCashConfirmation(good({ receivedOn: '2025-11-05' }), 354000, TODAY).ok).toBe(true);
  });
  it('the amount must be whole paise, and the special-case acknowledgement and note are required', () => {
    for (const amountPaise of [0, -1, 1.5, '354000', null, NaN]) expect(checkCashConfirmation(good({ amountPaise }), 354000, TODAY)).toMatchObject({ ok: false, fields: { amountPaise: expect.any(String) } });
    for (const specialCase of [false, undefined, 'true', 1]) expect(checkCashConfirmation(good({ specialCase }), 354000, TODAY)).toMatchObject({ ok: false, fields: { specialCase: expect.any(String) } });
    for (const reason of ['', 'short', 'x'.repeat(301), undefined]) expect(checkCashConfirmation(good({ reason }), 354000, TODAY)).toMatchObject({ ok: false, fields: { reason: expect.any(String) } });
  });
  it('the amount must equal the order total including GST to the paise, in either direction', () => {
    for (const amountPaise of [353999, 354001, 300000, 1]) expect(checkCashConfirmation(good({ amountPaise }), 354000, TODAY)).toMatchObject({ ok: false, code: 'OFFLINE_AMOUNT_MISMATCH' });
  });
});

const cashOrder = (f: Flow, over: Partial<{ planKey: string; termMonths: number; key: string }> = {}, vendorId = 'v1') =>
  f.orders.createCashOrder(vendorId, { planKey: over.planKey ?? 'handyman_pro', termMonths: over.termMonths ?? 3, idempotencyKey: over.key ?? `cash-key-${Math.random().toString(36).slice(2, 10)}-abcd` }, SUPER);
const confirm = (f: Flow, id: string, over: Record<string, unknown> = {}, actor = SUPER) => f.settlement.confirmCash(id, good(over), actor, 'Admin A');

describe('a cash order and its confirmation (service)', () => {
  it('an admin makes a cash order at the server price: price book plus GST, no gateway, no provider order', async () => {
    const f = flow('cashfree');
    const o = await cashOrder(f);
    expect(o).toMatchObject({ gateway: 'cash', status: 'PENDING_PAYMENT', amountPaise: 354000, providerOrderId: null, clientToken: null, keyId: null });
    expect(f.gws.cashfree.calls).toEqual([]); expect(f.gws.razorpay.calls).toEqual([]);   // no gateway was called
    expect(f.w.repo.audits.some((a) => a.action === 'billing.cash_order.created' && a.entityId === o.id && a.actor.id === 'super-1')).toBe(true);
    expect(currentOf(f.w).planId).toBe(f.w.ids.free);   // nothing is activated by making the order
  });

  it('works while both gateways are OFF (cash needs no gateway)', async () => {
    const f = flow('razorpay'); f.set({ paymentsMode: 'off' });
    const o = await cashOrder(f);
    const r = await confirm(f, o.id);
    expect(r).toMatchObject({ status: 'PAID', outcome: 'PAID' });
  });

  it('is idempotent by key, and a key used for a different order is refused', async () => {
    const f = flow();
    const a = await cashOrder(f, { key: 'cash-idem-key-0001' }); const b = await cashOrder(f, { key: 'cash-idem-key-0001' });
    expect(b.id).toBe(a.id); expect(f.w.repo.orders.size).toBe(1);
    expect(code(await err(cashOrder(f, { key: 'cash-idem-key-0001', termMonths: 6 })))).toBe('IDEMPOTENCY_CONFLICT');
    const online = await f.buy();   // an online order that uses a key: a cash order cannot reuse it
    expect(code(await err(f.orders.createCashOrder('v1', { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: [...f.w.repo.orders.values()].find((o) => o.id === online.id)!.idempotencyKey }, SUPER)))).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('refuses what cannot be bought: a Free plan, an unknown plan, a downgrade, a term that is not offered', async () => {
    const f = flow();
    expect(code(await err(cashOrder(f, { planKey: 'handyman_free' })))).toBe('PLAN_NOT_PURCHASABLE');
    expect(code(await err(cashOrder(f, { planKey: 'nope' })))).toBe('PLAN_NOT_PURCHASABLE');
    expect(code(await err(cashOrder(f, { termMonths: 1 })))).toBe('TERM_NOT_OFFERED');
    expect(f.w.repo.orders.size).toBe(0);
  });

  it('confirming cash marks it paid, activates the plan, makes the invoice and the audit row, and shows the reference', async () => {
    const f = flow();
    const o = await cashOrder(f);
    const r = await confirm(f, o.id);
    expect(r).toEqual({ status: 'PAID', outcome: 'PAID', invoice: { number: 'INV/2026-27/000001', reference: 'RCPT-1001' } });
    const order = f.w.repo.orders.get(o.id)!;
    expect(order).toMatchObject({ status: 'PAID', source: 'STAFF', paidAmountPaise: 354000, settledReference: 'RCPT-1001', settledAmountPaise: 354000, settledByName: 'Admin A', reason: 'paid cash at the office, no card or bank' });
    expect(order.settledOn!.toISOString().slice(0, 10)).toBe('2026-11-04');
    expect(currentOf(f.w)).toMatchObject({ planId: f.w.ids.pro, source: 'STAFF' });
    const inv = f.w.repo.invoices[0];
    expect(inv.snapshot.payment).toEqual({ method: 'CASH', reference: 'RCPT-1001', receivedOn: '2026-11-04' });
    expect(inv.snapshot.amountPaise).toBe(354000);
    expect(renderInvoiceHtml(inv)).toContain('Paid in cash. Receipt reference RCPT-1001. Received 2026-11-04');
    const audit = f.w.repo.audits.find((a) => a.action === 'billing.order.paid')!;
    expect(audit.after).toMatchObject({ status: 'PAID', via: 'STAFF', amountPaise: 354000, cash: { reference: 'RCPT-1001', receivedOn: '2026-11-04', by: 'Admin A' } });
    expect(audit.actor).toMatchObject({ type: 'STAFF', id: 'super-1' });
    await new Promise((x) => setImmediate(x));
    expect(f.queued).toHaveLength(1);   // the invoice mail is recorded after the commit
  });

  it('confirming twice changes nothing: one subscription, one invoice, the same reference', async () => {
    const f = flow();
    const o = await cashOrder(f);
    await confirm(f, o.id);
    const again = await confirm(f, o.id);
    expect(again).toEqual({ status: 'PAID', outcome: 'ALREADY_PAID', invoice: { number: 'INV/2026-27/000001', reference: 'RCPT-1001' } });
    expect(f.invoices()).toBe(1); expect(f.w.repo.subs.filter((s) => s.vendorId === 'v1' && s.current)).toHaveLength(1);
    await Promise.all([confirm(f, (await cashOrder(f, { termMonths: 6 }, 'v2')).id, { amountPaise: 637200 }), confirm(f, (await cashOrder(f, { termMonths: 12 }, 'v1')).id, { amountPaise: 1132800 })]);
    expect(f.invoices()).toBe(3);   // each order, once
  });

  it('every refusal activates nothing and makes no invoice: wrong amount, wrong method, missing details', async () => {
    const f = flow();
    const o = await cashOrder(f);
    for (const [over, expected] of [[{ amountPaise: 353999 }, 'OFFLINE_AMOUNT_MISMATCH'], [{ amountPaise: 354001 }, 'OFFLINE_AMOUNT_MISMATCH'], [{ method: 'BANK_TRANSFER' }, 'CASH_ONLY'], [{ method: undefined }, 'CASH_ONLY'], [{ reference: '' }, 'CASH_DETAILS_INVALID'], [{ receivedOn: '2026-11-30' }, 'CASH_DETAILS_INVALID'], [{ specialCase: false }, 'CASH_DETAILS_INVALID'], [{ reason: 'short' }, 'CASH_DETAILS_INVALID']] as Array<[Record<string, unknown>, string]>) {
      expect([JSON.stringify(over), code(await err(confirm(f, o.id, over)))]).toEqual([JSON.stringify(over), expected]);
    }
    expect(f.w.repo.orders.get(o.id)!.status).toBe('PENDING_PAYMENT'); expect(f.invoices()).toBe(0); expect(currentOf(f.w).planId).toBe(f.w.ids.free);
  });

  it('only a CASH order can be confirmed: an online order, a held one and a closed one are refused', async () => {
    const f = flow('razorpay');
    const online = await f.buy();
    expect(code(await err(confirm(f, online.id)))).toBe('CASH_ORDER_INVALID');
    const held = await f.buy({ termMonths: 6 });
    f.gws.razorpay.addPayment({ paymentId: 'pay_held1', providerOrderId: held.providerOrderId!, amountMinor: 1, currency: 'INR', status: 'SUCCESS' });
    await f.orders.confirm('v1', held.id, { paymentId: 'pay_held1', signature: f.gws.razorpay.returnSignature(held.providerOrderId!, 'pay_held1') }, VENDOR);
    expect(f.w.repo.orders.get(held.id)!.status).toBe('REVIEW');
    expect(code(await err(confirm(f, held.id, { amountPaise: 637200 })))).toBe('CASH_ORDER_INVALID');
    const cash = await cashOrder(f, { termMonths: 12 });
    f.w.repo.orders.get(cash.id)!.status = 'CANCELLED';
    expect(code(await err(confirm(f, cash.id, { amountPaise: 1132800 })))).toBe('ORDER_STATE_INVALID');
    expect(code(await err(confirm(f, 'no-such-order')))).toBe('ORDER_NOT_FOUND');
    expect(f.invoices()).toBe(0);
  });

  it('is all or nothing: if the last step fails, the order, the plan and the invoice are all untouched', async () => {
    const f = flow();
    const o = await cashOrder(f);
    const real = f.w.repo.transaction.bind(f.w.repo);
    (f.w.repo as { transaction: unknown }).transaction = (v: string, fn: (tx: Record<string, unknown>) => Promise<unknown>) => real(v, async (tx) => fn({ ...(tx as object), audit: async () => { throw new Error('audit failed') } }) as never);
    await expect(confirm(f, o.id)).rejects.toThrow('audit failed');
    expect(f.w.repo.orders.get(o.id)!.status).toBe('PENDING_PAYMENT'); expect(f.invoices()).toBe(0); expect(currentOf(f.w).planId).toBe(f.w.ids.free);
  });

  it('the vendor can never settle an order by hand: no vendor route or vendor service mentions cash confirmation or marking paid', () => {
    const me = fs.readFileSync(path.resolve(__dirname, '../src/plan-billing/api/me-billing.controller.ts'), 'utf8');
    expect(me).not.toMatch(/confirmCash|markPaid|mark-paid|createCashOrder|cash/i);
    const orders = fs.readFileSync(path.resolve(__dirname, '../src/plan-billing/plan-order.service.ts'), 'utf8');
    expect(orders.match(/createCashOrder/g)!.length).toBe(1);   // defined once, used only by the admin controller
    const admin = fs.readFileSync(path.resolve(__dirname, '../src/plan-billing/api/billing-admin.controller.ts'), 'utf8');
    expect(admin).toMatch(/confirmCash/); expect(admin).not.toMatch(/\.markPaid\(/);   // the route no longer reaches the general marker
  });
});

describe('who may confirm cash', () => {
  const MARK = 'POST /v3/admin/billing/orders/:id/mark-paid'; const MAKE = 'POST /v3/admin/billing/vendors/:vendorId/cash-orders';
  const principal = (adminRole?: string, over: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({ sub: 's', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: effectiveStaffRole(adminRole), ...over });
  const may = (u: AuthenticatedUser, key: string): boolean => {
    const [method, ...r] = key.split(' ');
    try { return new AdminGuard().canActivate({ switchToHttp: () => ({ getRequest: () => ({ user: u, method, route: { path: r.join(' ') } }) }) } as never); } catch (e) { if (e instanceof ForbiddenException) return false; throw e; }
  };
  it('ADMIN and SUPER_ADMIN only', () => {
    for (const k of [MARK, MAKE]) { expect([...effectiveRolesFor(k)].sort()).toEqual(['ADMIN', 'SUPER_ADMIN']); expect(may(principal('ADMIN'), k)).toBe(true); expect(may(principal('SUPER_ADMIN'), k)).toBe(true); }
  });
  it('OPERATIONS, SALES, FIELD_EXECUTIVE, TELECALLER and SUPPORT are refused', () => {
    for (const role of ['OPERATIONS', 'MARKETING', 'FIELD_EXECUTIVE', 'TELECALLER', 'SUPPORT']) for (const k of [MARK, MAKE]) expect([role, k, may(principal(role), k)]).toEqual([role, k, false]);
  });
  it('a vendor owner, a vendor team member, a referral partner and an anonymous caller are refused', () => {
    const others: Array<AuthenticatedUser | undefined> = [{ sub: 'v', email: 'v@x.invalid', role: 'VENDOR' }, { sub: 'v', email: 'v@x.invalid', role: 'VENDOR', kind: 'team_member' }, { sub: 'p', email: 'p@x.invalid', role: 'PARTNER', kind: 'referral_partner' }, undefined];
    for (const u of others) for (const k of [MARK, MAKE]) expect(may(u as AuthenticatedUser, k)).toBe(false);
  });
  it('refunds stay SUPER_ADMIN only', () => { expect(may(principal('ADMIN'), 'POST /v3/admin/billing/orders/:id/refund')).toBe(false); expect(may(principal('SUPER_ADMIN'), 'POST /v3/admin/billing/orders/:id/refund')).toBe(true); });
  it('STAFF identity used in the world is a staff actor', () => { expect(STAFF.type).toBe('STAFF'); });
});
