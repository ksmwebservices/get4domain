import { classifyChange, dueReminders, financialYearOf, formatInvoiceNumber, renewalEnd, upgradeCreditPaise, verifyPaidAmount } from '../src/plan-billing/core/amounts';
import { canTransitionOrder, isTerminalOrder, OrderStatus } from '../src/plan-billing/core/order-state';
import { redactPaymentPayload } from '../src/plan-billing/core/redact';

const D = (s: string): Date => new Date(s);

describe('order state machine', () => {
  const ALL: OrderStatus[] = ['CREATED', 'PENDING_PAYMENT', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REVIEW'];
  const allowed: Record<OrderStatus, OrderStatus[]> = {
    CREATED: ['PENDING_PAYMENT', 'FAILED', 'EXPIRED', 'CANCELLED'], PENDING_PAYMENT: ['PAID', 'EXPIRED', 'CANCELLED', 'REVIEW'], REVIEW: ['PAID', 'CANCELLED'], PAID: [], FAILED: [], EXPIRED: ['REVIEW'], CANCELLED: ['REVIEW'],   // money that arrives for a closed order goes to staff, it never activates anything
  };
  it.each(ALL.flatMap((a) => ALL.map((b) => [a, b] as const)))('%s -> %s', (a, b) => { expect(canTransitionOrder(a, b)).toBe(allowed[a].includes(b)); });
  it('PAID and FAILED are final; EXPIRED and CANCELLED only lead to REVIEW (late money); REVIEW and PENDING_PAYMENT are open', () => { for (const s of ['PAID', 'FAILED'] as const) expect(isTerminalOrder(s)).toBe(true); for (const s of ['EXPIRED', 'CANCELLED', 'REVIEW', 'PENDING_PAYMENT', 'CREATED'] as const) expect(isTerminalOrder(s)).toBe(false); });
});

describe('amount verification: the paid amount and currency must equal the order snapshot', () => {
  const order = { amountPaise: 118000, currency: 'INR' };
  it('exact match is OK', () => { expect(verifyPaidAmount(order, { amount: 118000, currency: 'INR' })).toBe('OK'); });
  it.each([[117999, 'INR', 'AMOUNT_MISMATCH'], [118001, 'INR', 'AMOUNT_MISMATCH'], [0, 'INR', 'AMOUNT_MISMATCH'], [118000, 'USD', 'CURRENCY_MISMATCH'], [118000, 'inr', 'CURRENCY_MISMATCH'], [1180.5, 'INR', 'AMOUNT_MISMATCH'], [Number.NaN, 'INR', 'AMOUNT_MISMATCH']])('paid %s %s -> %s', (amount, currency, out) => { expect(verifyPaidAmount(order, { amount: amount as number, currency })).toBe(out); });
  it('non-numbers and missing fields never match', () => { expect(verifyPaidAmount(order, { amount: '118000' as never, currency: 'INR' })).toBe('AMOUNT_MISMATCH'); expect(verifyPaidAmount(order, null as never)).toBe('AMOUNT_MISMATCH'); });
});

describe('what kind of purchase is this', () => {
  const pro = { planKey: 'handyman_pro', level: 'PRO' as const, monthlyPaise: 100_000 };
  const bigger = { planKey: 'handyman_max', level: 'PRO' as const, monthlyPaise: 250_000 };
  const live = { planKey: 'handyman_pro', level: 'PRO' as const, monthlyPaise: 100_000, endsAt: D('2027-02-01T00:00:00Z'), status: 'ACTIVE' as const };
  const now = D('2026-11-05T10:00:00Z');
  it('no paid plan (none, Free, expired) is a NEW purchase', () => {
    expect(classifyChange(null, pro, now)).toBe('NEW'); expect(classifyChange({ planKey: 'handyman_free', level: 'FREE', monthlyPaise: 0, endsAt: null, status: 'ACTIVE' }, pro, now)).toBe('NEW');
    expect(classifyChange({ ...live, status: 'EXPIRED' }, pro, now)).toBe('NEW');
  });
  it('the same plan while it is paid (also in its grace period) is a RENEWAL', () => { expect(classifyChange(live, pro, now)).toBe('RENEWAL'); expect(classifyChange({ ...live, status: 'GRACE', endsAt: D('2026-11-01T00:00:00Z') }, pro, now)).toBe('RENEWAL'); });
  it('a dearer plan mid-term is an UPGRADE; a cheaper one mid-term is a DOWNGRADE; a cheaper one after the term ended is NEW', () => {
    expect(classifyChange(live, bigger, now)).toBe('UPGRADE'); expect(classifyChange({ ...live, planKey: 'handyman_max', monthlyPaise: 250_000 }, pro, now)).toBe('DOWNGRADE');
    expect(classifyChange({ ...live, planKey: 'handyman_max', monthlyPaise: 250_000, endsAt: D('2026-10-01T00:00:00Z'), status: 'EXPIRED' }, pro, now)).toBe('NEW');
  });
});

describe('upgrade credit (upgradeProration)', () => {
  const now = D('2026-11-05T10:00:00Z');
  const cur = { amountPaise: 1_200_000, termMonths: 12, endsAt: D('2027-05-05T10:00:00Z') };   // 6 whole months left
  it('PRORATE credits the unused WHOLE months at the old monthly rate; NONE credits nothing', () => {
    expect(upgradeCreditPaise('PRORATE', cur, now)).toBe(6 * 100_000); expect(upgradeCreditPaise('NONE', cur, now)).toBe(0);
  });
  it('part months do not count', () => { expect(upgradeCreditPaise('PRORATE', { ...cur, endsAt: D('2027-05-04T10:00:00Z') }, now)).toBe(5 * 100_000); });
  it('never more than the term, never negative, and unknown price or an ended term gives nothing', () => {
    expect(upgradeCreditPaise('PRORATE', { ...cur, endsAt: D('2030-01-01T00:00:00Z') }, now)).toBe(12 * 100_000);
    expect(upgradeCreditPaise('PRORATE', { ...cur, endsAt: D('2026-11-01T00:00:00Z') }, now)).toBe(0);
    expect(upgradeCreditPaise('PRORATE', { ...cur, amountPaise: null }, now)).toBe(0); expect(upgradeCreditPaise('PRORATE', { ...cur, termMonths: 0 }, now)).toBe(0);
  });
  it('the monthly rate is a whole number of paise (floor)', () => { expect(upgradeCreditPaise('PRORATE', { amountPaise: 100_000, termMonths: 3, endsAt: D('2027-02-05T10:00:00Z') }, now)).toBe(3 * 33_333); });
});

describe('renewal date maths', () => {
  const now = D('2026-11-05T10:00:00Z');
  it('extends from the LATER of now and the current end', () => {
    expect(renewalEnd(D('2026-12-20T00:00:00Z'), now, 3)).toEqual(D('2027-03-20T00:00:00Z'));   // still running: add to the end
    expect(renewalEnd(D('2026-10-01T00:00:00Z'), now, 3)).toEqual(D('2027-02-05T10:00:00Z'));   // already ended: add to now
    expect(renewalEnd(null, now, 6)).toEqual(D('2027-05-05T10:00:00Z'));
  });
  it('clamps to the end of a shorter month', () => { expect(renewalEnd(D('2026-11-30T00:00:00Z'), now, 3)).toEqual(D('2027-02-28T00:00:00Z')); });
});

describe('invoice numbering', () => {
  it('the financial year runs April to March in India time', () => {
    expect(financialYearOf(D('2026-04-01T00:00:00+05:30'))).toBe('2026-27'); expect(financialYearOf(D('2027-03-31T23:59:59+05:30'))).toBe('2026-27'); expect(financialYearOf(D('2027-04-01T00:00:00+05:30'))).toBe('2027-28');
    expect(financialYearOf(D('2026-03-31T20:00:00Z'))).toBe('2026-27');   // 01:30 on 1 April in India: already the new year
    expect(financialYearOf(D('2026-03-31T18:00:00Z'))).toBe('2025-26');   // 23:30 on 31 March in India
    expect(financialYearOf(D('2099-12-31T00:00:00Z'))).toBe('2099-00');
  });
  it('formats prefix / year / six digits', () => { expect(formatInvoiceNumber('INV', '2026-27', 1)).toBe('INV/2026-27/000001'); expect(formatInvoiceNumber('INV', '2026-27', 123456)).toBe('INV/2026-27/123456'); expect(formatInvoiceNumber('ACME', '2026-27', 7)).toBe('ACME/2026-27/000007'); });
});

describe('renewal reminders never repeat', () => {
  const now = D('2026-11-05T10:00:00Z'); const ends = D('2026-11-12T10:00:00Z');   // exactly 7 days left
  const sub = (id = 's1', endsAt = ends, status = 'ACTIVE') => ({ id, endsAt, status });
  const key = (id: string, d: number, e: Date) => `${id}|${d}|${e.toISOString()}`;
  it('sends the nearest due offset and marks the larger ones skipped', () => {
    expect(dueReminders([sub()], now, [14, 7, 1], new Set())).toEqual([{ subscriptionId: 's1', daysBefore: 14, endsAt: ends, action: 'SKIP' }, { subscriptionId: 's1', daysBefore: 7, endsAt: ends, action: 'SEND' }]);
  });
  it('an offset already logged is never sent again', () => {
    expect(dueReminders([sub()], now, [14, 7, 1], new Set([key('s1', 14, ends), key('s1', 7, ends)]))).toEqual([]);
    const later = D('2026-11-11T10:00:00Z');   // 1 day left
    expect(dueReminders([sub()], later, [14, 7, 1], new Set([key('s1', 14, ends), key('s1', 7, ends)]))).toEqual([{ subscriptionId: 's1', daysBefore: 1, endsAt: ends, action: 'SEND' }]);
  });
  it('a renewal moves the end date, so the offsets are fresh again for the new term', () => {
    const newEnd = D('2027-02-12T10:00:00Z'); expect(dueReminders([sub('s1', newEnd)], now, [14, 7, 1], new Set([key('s1', 7, ends)]))).toEqual([]);   // not due yet
    expect(dueReminders([sub('s1', newEnd)], D('2027-02-05T10:00:00Z'), [14, 7, 1], new Set([key('s1', 7, ends)])).map((r) => r.daysBefore)).toEqual([14, 7]);
  });
  it('nothing for a term that has not entered the window, has ended, is not ACTIVE, or has no end date', () => {
    expect(dueReminders([sub('s1', D('2027-03-01T00:00:00Z'))], now, [14, 7, 1], new Set())).toEqual([]);
    expect(dueReminders([sub('s1', D('2026-11-01T00:00:00Z'))], now, [14, 7, 1], new Set())).toEqual([]);
    expect(dueReminders([sub('s1', ends, 'CANCELLED')], now, [14, 7, 1], new Set())).toEqual([]);
    expect(dueReminders([{ id: 's2', endsAt: null, status: 'ACTIVE' }], now, [14, 7, 1], new Set())).toEqual([]);
  });
  it('works with an empty or unordered offset list', () => { expect(dueReminders([sub()], now, [], new Set())).toEqual([]); expect(dueReminders([sub()], now, [1, 14, 7], new Set()).map((r) => [r.daysBefore, r.action])).toEqual([[14, 'SKIP'], [7, 'SEND']]); });
});

describe('payment payload redaction: a whitelist, so nothing personal or card-like can be stored', () => {
  const event = {
    entity: 'event', account_id: 'acc_secret', event: 'payment.captured', contains: ['payment'], created_at: 1730800000,
    payload: { payment: { entity: { id: 'pay_1', entity: 'payment', amount: 118000, currency: 'INR', status: 'captured', order_id: 'order_1', method: 'card', captured: true, email: 'buyer@example.com', contact: '+919876543210', vpa: 'x@upi',
      card: { last4: '1111', network: 'Visa', name: 'A Buyer' }, bank: 'HDFC', wallet: null, notes: { vendorId: 'v1', phone: '9876543210' }, acquirer_data: { rrn: '123' }, error_description: 'declined by issuer', fee: 2000 } },
      order: { entity: { id: 'order_1', entity: 'order', amount: 118000, amount_paid: 118000, amount_due: 0, currency: 'INR', receipt: 'rcpt_1', status: 'paid', attempts: 1, notes: { email: 'buyer@example.com' } } } },
  };
  it('keeps ids, amounts, currency, statuses and the event name only', () => {
    const r = redactPaymentPayload(event) as { event: string; payload: { payment: { entity: Record<string, unknown> }; order: { entity: Record<string, unknown> } } };
    expect(r.event).toBe('payment.captured');
    expect(r.payload.payment.entity).toEqual({ id: 'pay_1', entity: 'payment', amount: 118000, currency: 'INR', status: 'captured', order_id: 'order_1', method: 'card', captured: true });
    expect(r.payload.order.entity).toEqual({ id: 'order_1', entity: 'order', amount: 118000, amount_paid: 118000, amount_due: 0, currency: 'INR', receipt: 'rcpt_1', status: 'paid', attempts: 1 });
    expect(JSON.stringify(r)).not.toMatch(/buyer@example|9876543210|x@upi|1111|Visa|HDFC|rrn|acc_secret|vendorId|declined/);
  });
  it('is total: garbage in gives a harmless object out', () => { for (const g of [null, undefined, 5, 'x', [], { payload: 5 }]) expect(() => redactPaymentPayload(g)).not.toThrow(); expect(redactPaymentPayload(null)).toEqual({}); });
});
