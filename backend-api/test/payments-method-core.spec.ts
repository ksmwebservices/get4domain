import { HIDDEN_GATEWAY_KINDS, isVendorOfferedKind, maskUpiId, normalisePayeeName, normaliseUpiId, upiChangeNeedsConfirm } from '../src/v3-payments/core/method-core';

/** Slice 5.17a (amendment 06, UPI only): the pure rules. All ids below are INVENTED sample data. */
describe('the UPI id format validator', () => {
  it('accepts handle@bank in any case and returns it in lower case', () => {
    expect(normaliseUpiId(' Shop.One@OkBank ')).toBe('shop.one@okbank');
    expect(normaliseUpiId('9876543210@ybl')).toBe('9876543210@ybl');
    expect(normaliseUpiId('a-b_c.d@upi')).toBe('a-b_c.d@upi');
  });
  it('refuses anything else', () => {
    for (const bad of ['', 'plain', 'no at sign', '@bank', 'x@', 'x@@bank', 'a b@bank', 'a@b', 'a@1bank', 'a@bank!', 'a@bank.com', `${'a'.repeat(300)}@bank`, 'x'.padEnd(5, 'अ') + '@bank']) expect(normaliseUpiId(bad)).toBeNull();
    expect(normaliseUpiId(undefined)).toBeNull(); expect(normaliseUpiId(42 as never)).toBeNull();
  });
});

describe('the payee name', () => {
  it('trims and folds spacing, keeps the case the vendor typed', () => { expect(normalisePayeeName('  Sri   Murugan  Stores ')).toBe('Sri Murugan Stores'); });
  it('needs 2 to 99 characters of letters, digits, spaces and . , & \' -', () => {
    expect(normalisePayeeName('A')).toBeNull(); expect(normalisePayeeName('')).toBeNull(); expect(normalisePayeeName('x'.repeat(100))).toBeNull();
    expect(normalisePayeeName('Bad<script>')).toBeNull(); expect(normalisePayeeName("D'Souza & Sons, Co.")).toBe("D'Souza & Sons, Co.");
    expect(normalisePayeeName(null)).toBeNull();
  });
});

describe('which method kinds a vendor may use (amendment 06)', () => {
  it('UPI and the non-online kinds are offered; every gateway kind is not', () => {
    for (const k of ['UPI', 'PAY_ON_DELIVERY', 'PAY_AT_VISIT', 'BANK_TRANSFER']) expect(isVendorOfferedKind(k)).toBe(true);
    for (const k of ['OWN_GATEWAY', 'GATEWAY_RAZORPAY', 'GATEWAY_CASHFREE', 'GATEWAY_PAYTM', 'ANYTHING_ELSE', '']) expect(isVendorOfferedKind(k)).toBe(false);
    expect(HIDDEN_GATEWAY_KINDS).toEqual(expect.arrayContaining(['OWN_GATEWAY', 'GATEWAY_RAZORPAY', 'GATEWAY_CASHFREE', 'GATEWAY_PAYTM']));
  });
});

describe('a changed UPI id needs a confirm step', () => {
  it('first save needs none; the same id needs none (case-blind); a different id needs one', () => {
    expect(upiChangeNeedsConfirm(null, 'a@bank')).toBe(false);
    expect(upiChangeNeedsConfirm('a@bank', 'A@Bank')).toBe(false);
    expect(upiChangeNeedsConfirm('a@bank', 'b@bank')).toBe(true);
    expect(upiChangeNeedsConfirm('a@bank', 'a@other')).toBe(true);
  });
});

describe('staff see a masked id', () => {
  it('keeps the first two characters and the bank handle', () => { expect(maskUpiId('shop.one@okbank')).toBe('sh•••@okbank'); expect(maskUpiId('ab@x1y')).toBe('ab•••@x1y'); expect(maskUpiId(null)).toBeNull(); });
});
