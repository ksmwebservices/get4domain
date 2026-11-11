import { amountString, buildUpiIntent, normaliseUtr, nextPayStatus, isPayCode, PAY_CODE_ALPHABET, payCodeFrom } from '../src/v3-payments/core/pay-core';

describe('amountString: integer paise to a rupee string without floating point', () => {
  it.each([[1, '0.01'], [9, '0.09'], [10, '0.10'], [99, '0.99'], [100, '1.00'], [101, '1.01'], [150_000, '1500.00'], [123_456_789, '1234567.89'], [2_147_483_647, '21474836.47'], [999_999_999_999, '9999999999.99']])('%i paise is %s', (p, s) => { expect(amountString(p)).toBe(s); });
  it('every amount from 1 to 20000 paise round-trips exactly', () => {
    for (let p = 1; p <= 20_000; p++) { const [r, q] = amountString(p)!.split('.'); expect(Number(r) * 100 + Number(q)).toBe(p); expect(q).toHaveLength(2); }
  });
  it.each([0, -1, 1.5, NaN, Infinity, 1e15, '100' as unknown as number, null as unknown as number])('refuses %p', (p) => { expect(amountString(p)).toBeNull(); });
});

describe('buildUpiIntent', () => {
  it('builds pa, pn, am, tn, cu in a fixed order with percent encoding (spaces as %20)', () => {
    expect(buildUpiIntent({ pa: 'shop@okbank', pn: 'Priya Stores', amountPaise: 150_050, note: 'Order 12 & more' })).toBe('upi://pay?pa=shop%40okbank&pn=Priya%20Stores&am=1500.50&tn=Order%2012%20%26%20more&cu=INR');
  });
  it('leaves tn out when there is no note and cuts a long note to 50 characters', () => {
    expect(buildUpiIntent({ pa: 'a.b@okbank', pn: 'X Y', amountPaise: 100, note: null })).toBe('upi://pay?pa=a.b%40okbank&pn=X%20Y&am=1.00&cu=INR');
    expect(decodeURIComponent(buildUpiIntent({ pa: 'a.b@okbank', pn: 'X Y', amountPaise: 100, note: 'n'.repeat(80) })!.split('tn=')[1].split('&')[0])).toHaveLength(50);
  });
  it('returns null for a bad amount or a bad id', () => {
    expect(buildUpiIntent({ pa: 'shop@okbank', pn: 'X Y', amountPaise: 0, note: null })).toBeNull();
    expect(buildUpiIntent({ pa: 'nobank', pn: 'X Y', amountPaise: 100, note: null })).toBeNull();
  });
});

describe('the UPI reference number is optional and validated', () => {
  it('accepts nothing, or 8 to 22 letters and digits (upper-cased), and refuses anything else', () => {
    expect(normaliseUtr(undefined)).toEqual({ ok: true, utr: null }); expect(normaliseUtr('  ')).toEqual({ ok: true, utr: null }); expect(normaliseUtr('')).toEqual({ ok: true, utr: null });
    expect(normaliseUtr('412345678901')).toEqual({ ok: true, utr: '412345678901' }); expect(normaliseUtr(' ab12cd34ef ')).toEqual({ ok: true, utr: 'AB12CD34EF' });
    for (const bad of ['123', 'x'.repeat(23), '1234 5678 9012', '123456789<script>', 42]) expect(normaliseUtr(bad as never)).toEqual({ ok: false });
  });
});

describe('the pay-request state machine', () => {
  it('only the vendor can reach PAID; the customer tap reaches CUSTOMER_SAYS_PAID only', () => {
    expect(nextPayStatus('AWAITING', 'CUSTOMER_TAPS')).toBe('CUSTOMER_SAYS_PAID');
    expect(nextPayStatus('AWAITING', 'VENDOR_MARKS_PAID')).toBe('PAID'); expect(nextPayStatus('CUSTOMER_SAYS_PAID', 'VENDOR_MARKS_PAID')).toBe('PAID');
    expect(nextPayStatus('PAID', 'CUSTOMER_TAPS')).toBeNull(); expect(nextPayStatus('PAID', 'VENDOR_MARKS_PAID')).toBe('PAID');   // idempotent
    for (const from of ['AWAITING', 'CUSTOMER_SAYS_PAID', 'EXPIRED', 'CANCELLED'] as const) expect(nextPayStatus(from, 'CUSTOMER_TAPS') === 'PAID').toBe(false);
  });
  it('expiry applies to AWAITING only; cancel to AWAITING and CUSTOMER_SAYS_PAID; a cancelled request is final; an expired one can still be marked paid by the vendor', () => {
    expect(nextPayStatus('AWAITING', 'EXPIRES')).toBe('EXPIRED'); expect(nextPayStatus('CUSTOMER_SAYS_PAID', 'EXPIRES')).toBeNull(); expect(nextPayStatus('PAID', 'EXPIRES')).toBeNull();
    expect(nextPayStatus('AWAITING', 'VENDOR_CANCELS')).toBe('CANCELLED'); expect(nextPayStatus('CUSTOMER_SAYS_PAID', 'VENDOR_CANCELS')).toBe('CANCELLED'); expect(nextPayStatus('PAID', 'VENDOR_CANCELS')).toBeNull();
    expect(nextPayStatus('CANCELLED', 'VENDOR_MARKS_PAID')).toBeNull(); expect(nextPayStatus('EXPIRED', 'VENDOR_MARKS_PAID')).toBe('PAID'); expect(nextPayStatus('EXPIRED', 'CUSTOMER_TAPS')).toBeNull();
  });
});

describe('the pay code', () => {
  it('is built from random bytes, 24 characters from a 32 letter alphabet, and recognised by isPayCode', () => {
    const c = payCodeFrom(Uint8Array.from({ length: 24 }, (_, i) => i * 11)); expect(c).toHaveLength(24); expect([...c].every((ch) => PAY_CODE_ALPHABET.includes(ch))).toBe(true); expect(isPayCode(c)).toBe(true);
    expect(payCodeFrom(Uint8Array.from({ length: 24 }, () => 255))).not.toBe(payCodeFrom(Uint8Array.from({ length: 24 }, () => 0)));
    for (const bad of ['', 'short', 'A'.repeat(25), 'a'.repeat(24), '0'.repeat(24), 'AAAA AAAA AAAA AAAA AAAA']) expect(isPayCode(bad)).toBe(false);
  });
});
