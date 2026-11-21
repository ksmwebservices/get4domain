import { randomBytes } from 'crypto';
import { addressHash, chooseRoutes, maskAddress, renderMessage } from '../src/requests-orders/core/messaging-core';
import {
  amountCheck, canMoveOrder, canReserve, formatInvoiceNumber, formatOrderNo, hmacHex, MethodKind, MethodStatus, offerProblem, OfferTerms, parseGatewayEvent, paymentReadiness, priceCart, reservationExpiry,
  verifyVendorSignature,
} from '../src/requests-orders/core/commerce-core';
import {
  canTransition, consentTextHash, consentValid, duplicateKey, expiresAtFor, hashTrackingToken, isExpired, isTerminal, looksLikeTrackingToken, needsNudge, newTrackingToken, REQUEST_STATUSES,
  RequestStatus, responseMinutes, spamDecision, spamScore, summarise, validatePayload, vendorMayMove,
} from '../src/requests-orders/core/requests-core';

/** Slice 5.14, every pure piece, exhaustively where the dispatch says so. */
const T = new Date('2026-11-05T10:00:00.000Z');
const min = (n: number) => new Date(T.getTime() + n * 60_000);

describe('request state machine', () => {
  const allowed: Record<RequestStatus, RequestStatus[]> = {
    RECEIVED: ['DELIVERED', 'SEEN', 'RESPONDED', 'SPAM', 'EXPIRED', 'CLOSED'], DELIVERED: ['SEEN', 'RESPONDED', 'SPAM', 'EXPIRED', 'CLOSED'], SEEN: ['RESPONDED', 'CONFIRMED', 'SPAM', 'EXPIRED', 'CLOSED'],
    RESPONDED: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'EXPIRED'], CONFIRMED: ['IN_PROGRESS', 'COMPLETED', 'CLOSED'], IN_PROGRESS: ['COMPLETED', 'CLOSED'], COMPLETED: ['CLOSED'], CLOSED: [], EXPIRED: [], SPAM: [],
  };
  it('every one of the 100 pairs is allowed or refused exactly as the table says', () => {
    for (const from of REQUEST_STATUSES) for (const to of REQUEST_STATUSES) expect({ from, to, ok: canTransition(from, to) }).toEqual({ from, to, ok: allowed[from].includes(to) });
  });
  it('CLOSED, EXPIRED and SPAM are final; nothing moves back to RECEIVED', () => {
    for (const s of ['CLOSED', 'EXPIRED', 'SPAM'] as const) expect(isTerminal(s)).toBe(true);
    for (const from of REQUEST_STATUSES) expect(canTransition(from, 'RECEIVED')).toBe(false);
  });
  it('a vendor never sets RECEIVED, DELIVERED or EXPIRED by hand', () => {
    for (const from of REQUEST_STATUSES) for (const to of ['RECEIVED', 'DELIVERED', 'EXPIRED'] as const) expect(vendorMayMove(from, to)).toBe(false);
    expect(vendorMayMove('SEEN', 'RESPONDED')).toBe(true); expect(vendorMayMove('SEEN', 'SPAM')).toBe(true);
  });
  it('expiry: only a request nobody answered expires, at the date and not a moment before', () => {
    const r = { status: 'SEEN' as RequestStatus, expiresAt: expiresAtFor(T, 30) };
    expect(isExpired(r, new Date(r.expiresAt.getTime() - 1))).toBe(false); expect(isExpired(r, r.expiresAt)).toBe(true);
    for (const s of ['RESPONDED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'SPAM', 'EXPIRED'] as const) expect(isExpired({ status: s, expiresAt: T }, min(1))).toBe(false);
  });
  it('response time and summary: minutes, median of an odd and an even count, awaiting count', () => {
    expect(responseMinutes(T, min(7))).toBe(7); expect(responseMinutes(T, null)).toBeNull(); expect(responseMinutes(min(5), T)).toBe(0);
    const r = (status: RequestStatus, resp: number | null) => ({ status, createdAt: T, firstResponseAt: resp === null ? null : min(resp) });
    expect(summarise([r('RESPONDED', 10), r('RESPONDED', 30), r('RECEIVED', null)])).toEqual({ total: 3, awaiting: 1, byStatus: { RESPONDED: 2, RECEIVED: 1 }, responded: 2, medianResponseMinutes: 20 });
    expect(summarise([r('RESPONDED', 10), r('RESPONDED', 30), r('CLOSED', 50)]).medianResponseMinutes).toBe(30); expect(summarise([]).medianResponseMinutes).toBeNull();
  });
  it('the nudge: only an unanswered open request, only after the minutes', () => {
    const r = { status: 'RECEIVED' as RequestStatus, createdAt: T, firstResponseAt: null };
    expect(needsNudge(r, min(29), 30)).toBe(false); expect(needsNudge(r, min(30), 30)).toBe(true);
    expect(needsNudge({ ...r, status: 'RESPONDED' }, min(99), 30)).toBe(false); expect(needsNudge({ ...r, firstResponseAt: min(2) }, min(99), 30)).toBe(false);
  });
});

describe('tracking tokens and consent', () => {
  it('a token is 256 bits of randomness, the hash is not the token, and nonsense is recognised before any lookup', () => {
    const a = newTrackingToken(randomBytes); const b = newTrackingToken(randomBytes);
    expect(a).not.toBe(b); expect(looksLikeTrackingToken(a)).toBe(true); expect(a).toHaveLength(43);
    expect(hashTrackingToken(a)).toMatch(/^[0-9a-f]{64}$/); expect(hashTrackingToken(a)).not.toContain(a); expect(hashTrackingToken(a)).not.toBe(hashTrackingToken(b));
    for (const bad of ['', 'x', 'x'.repeat(44), 'x'.repeat(42) + '!', null, 7]) expect(looksLikeTrackingToken(bad)).toBe(false);
  });
  it('consent must be given, for the CURRENT text version, with both flags present', () => {
    const ok = { contactByBusiness: true, contactByPlatform: false, marketing: false, textVersion: 3 };
    expect(consentValid(ok, 3)).toBe(true); expect(consentValid(ok, 4)).toBe(false); expect(consentValid({ ...ok, contactByBusiness: false }, 3)).toBe(false);
    expect(consentValid({ ...ok, marketing: undefined }, 3)).toBe(false); expect(consentValid(undefined, 3)).toBe(false); expect(consentValid({ ...ok, textVersion: '3' }, 3)).toBe(false);
    expect(consentTextHash('a')).not.toBe(consentTextHash('b')); expect(consentTextHash('a')).toHaveLength(64);
  });
});

describe('payload validation per kind', () => {
  it('each kind accepts its own fields and refuses anything else', () => {
    expect(validatePayload('ENQUIRY', { message: 'Do you fix leaks?' })).toEqual({ ok: true, payload: { message: 'Do you fix leaks?' } });
    expect(validatePayload('ENQUIRY', { message: 'x' }).ok).toBe(false); expect(validatePayload('ENQUIRY', {}).ok).toBe(false);
    expect((validatePayload('ENQUIRY', { message: 'hello there', isAdmin: true }) as { errors: string[] }).errors).toEqual(['isAdmin: not a field of ENQUIRY']);
    expect(validatePayload('APPOINTMENT', { preferredAt: '2026-12-01T10:00:00Z', service: 'Check-up' })).toMatchObject({ ok: true, payload: { preferredAt: '2026-12-01T10:00:00.000Z' } });
    expect(validatePayload('APPOINTMENT', { preferredAt: 'tomorrow-ish' }).ok).toBe(false);
    expect(validatePayload('QUOTE', { service: 'Wiring', details: 'Three rooms' }).ok).toBe(true); expect(validatePayload('QUOTE', { service: 'Wiring' }).ok).toBe(false);
    expect(validatePayload('PRODUCT_ENQUIRY', { productRef: 'sku-1' }).ok).toBe(true); expect(validatePayload('PRODUCT_ENQUIRY', {}).ok).toBe(false);
  });
  it('a visitor cannot send an order through the request route, and non-objects are just empty', () => {
    expect(validatePayload('ORDER', { message: 'hello' }).ok).toBe(false); expect(validatePayload('ENQUIRY', 'a string' as never).ok).toBe(false); expect(validatePayload('ENQUIRY', ['x'] as never).ok).toBe(false);
    expect(validatePayload('ENQUIRY', { message: 'a'.repeat(1001) }).ok).toBe(false);
  });
});

describe('spam', () => {
  const clean = { honeypot: '', blocked: false, duplicateRecent: false, fromPhoneLastHour: 0, fromIpLastHour: 0, text: 'please call me' };
  it('a clean request scores 0; the honeypot and the blocklist are 100; duplicates, rates and links add up and are capped', () => {
    expect(spamScore(clean)).toEqual({ score: 0, reasons: [] });
    expect(spamScore({ ...clean, honeypot: 'http://x' })).toMatchObject({ score: 100, reasons: ['HONEYPOT'] }); expect(spamScore({ ...clean, blocked: true })).toMatchObject({ score: 100, reasons: ['BLOCKLIST'] });
    expect(spamScore({ ...clean, duplicateRecent: true }).score).toBe(60); expect(spamScore({ ...clean, fromPhoneLastHour: 3 }).score).toBe(40); expect(spamScore({ ...clean, fromIpLastHour: 10 }).score).toBe(30);
    expect(spamScore({ ...clean, text: 'http://a.in http://b.in www.c.in' }).reasons).toEqual(['LINKS']); expect(spamScore({ ...clean, duplicateRecent: true, fromPhoneLastHour: 5, fromIpLastHour: 50 }).score).toBe(100);
  });
  it('the thresholds decide: below OTP accept, from OTP ask a code, from block refuse', () => {
    const t = { otp: 50, block: 90 };
    expect([0, 49, 50, 89, 90, 100].map((s) => spamDecision(s, t))).toEqual(['ACCEPT', 'ACCEPT', 'ASK_OTP', 'ASK_OTP', 'BLOCK', 'BLOCK']);
    expect(duplicateKey('+91', 'ENQUIRY', { message: 'a' })).toBe(duplicateKey('+91', 'ENQUIRY', { message: 'a' })); expect(duplicateKey('+91', 'ENQUIRY', { message: 'a' })).not.toBe(duplicateKey('+91', 'QUOTE', { message: 'a' }));
  });
});

describe('paymentReadiness: every combination (owner rule 7)', () => {
  const kinds: MethodKind[] = ['OWN_GATEWAY', 'UPI', 'PAY_ON_DELIVERY', 'PAY_AT_VISIT', 'BANK_TRANSFER']; const statuses: MethodStatus[] = ['UNVERIFIED', 'ACTIVE', 'DISABLED'];
  it('nothing configured: enquiry only', () => { expect(paymentReadiness([])).toBe('ENQUIRY_ONLY'); });
  it('a single method: only an ACTIVE gateway or UPI gives full checkout; any other ACTIVE method gives an order request; unverified or disabled counts for nothing', () => {
    for (const kind of kinds) for (const status of statuses) {
      const want = status !== 'ACTIVE' ? 'ENQUIRY_ONLY' : kind === 'OWN_GATEWAY' || kind === 'UPI' ? 'FULL_CHECKOUT' : 'ORDER_REQUEST_ONLY';
      expect({ kind, status, r: paymentReadiness([{ kind, status }]) }).toEqual({ kind, status, r: want });
    }
  });
  it('mixes: a gateway wins over pay on delivery; a broken gateway falls back to the order request the vendor still offers', () => {
    expect(paymentReadiness([{ kind: 'PAY_ON_DELIVERY', status: 'ACTIVE' }, { kind: 'UPI', status: 'ACTIVE' }])).toBe('FULL_CHECKOUT');
    expect(paymentReadiness([{ kind: 'PAY_ON_DELIVERY', status: 'ACTIVE' }, { kind: 'OWN_GATEWAY', status: 'DISABLED' }])).toBe('ORDER_REQUEST_ONLY');
    expect(paymentReadiness([{ kind: 'PAY_ON_DELIVERY', status: 'DISABLED' }, { kind: 'OWN_GATEWAY', status: 'UNVERIFIED' }])).toBe('ENQUIRY_ONLY');
  });
});

describe('the cart in whole paise', () => {
  const line = (productRef: string, unitPaise: number, qty = 1, taxPercent = 0) => ({ productRef, name: productRef, unitPaise, qty, taxPercent });
  const offer = (o: Partial<OfferTerms> = {}): OfferTerms => ({ kind: 'COUPON', code: 'SAVE10', percentOff: 10, flatPaise: null, minOrderPaise: 0, startsAt: null, endsAt: null, usageLimit: null, usedCount: 0, status: 'ACTIVE', ...o });
  it('no offer: subtotal, tax per line (half up), total', () => {
    const c = priceCart([line('a', 10_000, 2, 18), line('b', 999, 1, 5)], null, T);
    expect(c.subtotalPaise).toBe(20_999); expect(c.discountPaise).toBe(0); expect(c.taxPaise).toBe(3600 + 50); expect(c.totalPaise).toBe(20_999 + 3650); expect(c.offerCode).toBeNull();
    expect(c.lines.map((l) => l.lineTotalPaise)).toEqual([23_600, 1049]);
  });
  it('a percentage coupon is rounded half up and shared across lines so they add up EXACTLY; tax is on the discounted amount', () => {
    const c = priceCart([line('a', 3333), line('b', 3333), line('c', 3334)], offer({ percentOff: 15 }), T);
    expect(c.subtotalPaise).toBe(10_000); expect(c.discountPaise).toBe(1500); expect(c.lines.reduce((n, l) => n + l.discountPaise, 0)).toBe(1500); expect(c.offerCode).toBe('SAVE10');
    const taxed = priceCart([line('a', 10_000, 1, 18)], offer({ percentOff: 10 }), T); expect(taxed.discountPaise).toBe(1000); expect(taxed.taxPaise).toBe(1620); expect(taxed.totalPaise).toBe(9000 + 1620);
  });
  it('a flat coupon never exceeds the subtotal; sharing is exact for awkward amounts', () => {
    expect(priceCart([line('a', 500)], offer({ percentOff: null, flatPaise: 99_999 }), T).totalPaise).toBe(0);
    for (const flat of [1, 2, 3, 7, 100, 333]) { const c = priceCart([line('a', 101), line('b', 202), line('c', 303)], offer({ percentOff: null, flatPaise: flat }), T); expect(c.lines.reduce((n, l) => n + l.discountPaise, 0)).toBe(c.discountPaise); expect(c.discountPaise).toBe(flat); }
  });
  it('an offer that does not apply (paused, not started, ended, used up, below the minimum, no value) changes nothing', () => {
    const cases: Array<[Partial<OfferTerms>, string]> = [[{ status: 'PAUSED' }, 'NOT_ACTIVE'], [{ startsAt: min(10) }, 'NOT_STARTED'], [{ endsAt: T }, 'ENDED'], [{ usageLimit: 5, usedCount: 5 }, 'USED_UP'], [{ minOrderPaise: 20_000 }, 'MINIMUM'], [{ percentOff: null, flatPaise: null }, 'NO_VALUE']];
    for (const [o, why] of cases) { expect(offerProblem(offer(o), 10_000, T)).toBe(why); expect(priceCart([line('a', 10_000)], offer(o), T).discountPaise).toBe(0); }
    expect(offerProblem(offer(), 10_000, T)).toBeNull();
  });
  it('bad lines are refused: empty cart, fractions, negatives, zero or huge quantity, bad tax, an absurd total', () => {
    expect(() => priceCart([], null, T)).toThrow(RangeError);
    for (const bad of [line('a', 10.5), line('a', -1), line('a', 100, 0), line('a', 100, 1001), line('a', 100, 1.5), line('a', 100, 1, 101), line('a', 100, 1, 1.5), line('', 100)]) expect(() => priceCart([bad], null, T)).toThrow(RangeError);
    expect(() => priceCart([line('a', 900_000_000, 3)], null, T)).toThrow(RangeError);
  });
});

describe('stock, gateway events, numbers', () => {
  it('stock: untracked is unlimited; tracked is on hand minus reserved', () => {
    expect(canReserve(null, 999)).toBe(true); expect(canReserve({ onHand: 5, reserved: 3 }, 2)).toBe(true); expect(canReserve({ onHand: 5, reserved: 3 }, 3)).toBe(false); expect(canReserve({ onHand: 0, reserved: 0 }, 1)).toBe(false);
    expect(reservationExpiry(T, 15).getTime()).toBe(T.getTime() + 15 * 60_000);
  });
  it('the vendor webhook signature is the HMAC of the raw body with THAT vendor secret; any other secret, body, signature or missing piece is false', () => {
    const body = Buffer.from('{"id":"e1"}'); const good = hmacHex('whsec-a', body);
    expect(verifyVendorSignature(body, good, 'whsec-a')).toBe(true); expect(verifyVendorSignature(body, good.toUpperCase(), 'whsec-a')).toBe(true);
    expect(verifyVendorSignature(body, good, 'whsec-b')).toBe(false); expect(verifyVendorSignature(Buffer.from('{"id":"e2"}'), good, 'whsec-a')).toBe(false);
    expect(verifyVendorSignature(body, undefined, 'whsec-a')).toBe(false); expect(verifyVendorSignature(undefined, good, 'whsec-a')).toBe(false); expect(verifyVendorSignature(body, good, null)).toBe(false);
    expect(verifyVendorSignature(body, 'zz', 'whsec-a')).toBe(false); expect(verifyVendorSignature(body, good.slice(2), 'whsec-a')).toBe(false);
  });
  it('the event shape and the exact amount check', () => {
    expect(parseGatewayEvent({ id: 'e1', type: 'payment.captured', orderRef: 'o1', amountPaise: 5000, currency: 'inr' })).toEqual({ eventId: 'e1', type: 'payment.captured', orderRef: 'o1', amountPaise: 5000, currency: 'INR' });
    for (const bad of [null, 'x', {}, { id: 'e1' }, { id: 'e1', type: 't', orderRef: 'o', amountPaise: 1.5, currency: 'INR' }, { id: 'e1', type: 't', orderRef: 'o', amountPaise: -1, currency: 'INR' }, { id: '', type: 't', orderRef: 'o', amountPaise: 1, currency: 'INR' }]) expect(parseGatewayEvent(bad)).toBeNull();
    expect(amountCheck({ amountPaise: 5000, currency: 'INR' }, { amountPaise: 5000, currency: 'INR' })).toBe('OK'); expect(amountCheck({ amountPaise: 5000, currency: 'INR' }, { amountPaise: 4999, currency: 'INR' })).toBe('MISMATCH');
    expect(amountCheck({ amountPaise: 5000, currency: 'INR' }, { amountPaise: 5000, currency: 'USD' })).toBe('MISMATCH');
  });
  it('numbers and order moves', () => {
    expect(formatInvoiceNumber('INV-', 42)).toBe('INV-000042'); expect(formatInvoiceNumber('INV-', 1234567)).toBe('INV-1234567'); expect(formatOrderNo(7)).toBe('#7');
    expect(canMoveOrder('PLACED', 'PACKED')).toBe(true); expect(canMoveOrder('PACKED', 'SHIPPED')).toBe(true); expect(canMoveOrder('CANCELLED', 'PAID')).toBe(false); expect(canMoveOrder('DELIVERED', 'PLACED')).toBe(false); expect(canMoveOrder('NOPE', 'PAID')).toBe(false);
  });
});

describe('messaging', () => {
  const none = { WHATSAPP: false, SMS: false, EMAIL: false };
  it('routes: WhatsApp, then SMS, then email; STOP removes a channel; nothing left means the dashboard; email needs an address, the others a phone', () => {
    expect(chooseRoutes({ phone: '+91', email: 'a@b.in' }, none).map((r) => r.channel)).toEqual(['WHATSAPP', 'SMS', 'EMAIL']);
    expect(chooseRoutes({ phone: '+91', email: 'a@b.in' }, { ...none, WHATSAPP: true }).map((r) => r.channel)).toEqual(['SMS', 'EMAIL']);
    expect(chooseRoutes({ phone: '+91' }, none).map((r) => r.channel)).toEqual(['WHATSAPP', 'SMS']); expect(chooseRoutes({ email: 'a@b.in' }, none).map((r) => r.channel)).toEqual(['EMAIL']);
    expect(chooseRoutes({ phone: '+91', email: 'a@b.in' }, { WHATSAPP: true, SMS: true, EMAIL: true })).toEqual([{ channel: 'DASHBOARD', senderRoute: 'DASHBOARD' }]); expect(chooseRoutes({}, none)[0].channel).toBe('DASHBOARD');
  });
  it('the sender is always the platform route, never a personal number', () => {
    expect(chooseRoutes({ phone: '+91', email: 'a@b.in' }, none).map((r) => r.senderRoute)).toEqual(['GET4DOMAIN_WHATSAPP_NUMBER', 'REGISTERED_SMS_SENDER', 'GET4DOMAIN_EMAIL_WITH_BUSINESS_NAME_REPLY_TO']);
  });
  it('hashes match case-insensitively, differ by channel, and the masked form hides the address', () => {
    expect(addressHash('EMAIL', 'A@B.in', 'p')).toBe(addressHash('EMAIL', ' a@b.in ', 'p')); expect(addressHash('SMS', '+91', 'p')).not.toBe(addressHash('WHATSAPP', '+91', 'p'));
    expect(maskAddress('EMAIL', 'meena@example.in')).toBe('m•••@example.in'); expect(maskAddress('SMS', '+919876543210')).not.toContain('9876543'); expect(maskAddress('SMS', '123')).toBe('•••');
  });
  it('a message always names the business; variables are filled; unknown ones are empty; line breaks and angle brackets are stripped; the bridge line is added when given', () => {
    expect(renderMessage('Hello {{customerName}}, we got {{reference}}.', { customerName: 'Meena', businessName: 'Acme Plumbing', reference: 'R1' })).toBe('Acme Plumbing: Hello Meena, we got R1.');
    expect(renderMessage('{{businessName}} replied to {{reference}}.', { businessName: 'Acme Plumbing', reference: 'R1' })).toBe('Acme Plumbing replied to R1.');
    expect(renderMessage('Hi {{nope}} there', { businessName: 'Acme' })).toBe('Acme: Hi there');
    expect(renderMessage('Hi {{customerName}}', { customerName: 'A<b>\nB', businessName: 'Acme' })).not.toMatch(/[<>\n]/);
    expect(renderMessage('{{businessName}} says hi', { businessName: 'Acme' }, 'We pass requests on.')).toBe('Acme says hi We pass requests on.');
  });
});
