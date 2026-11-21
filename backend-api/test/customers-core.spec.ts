import { checkCustomerInput, cleanTags, nextConsent, normaliseEmail, normalisePhone } from '../src/v3-customers/core/customer-core';

describe('how one person is recognised', () => {
  it('writes every common way of typing the same Indian number as one key', () => {
    for (const raw of ['98765 43210', '+91 98765-43210', '09876543210', '919876543210', '0091 9876543210', 9876543210]) expect(normalisePhone(raw)).toBe('919876543210');
  });
  it('refuses what cannot be a phone number', () => {
    for (const raw of ['', 'call me', '12345', '0000000000', '1'.repeat(16), null, undefined, {}]) expect(normalisePhone(raw as never)).toBeNull();
  });
  it('lower-cases an e-mail and refuses one that is not an address', () => {
    expect(normaliseEmail('  Meena.R@Example.COM ')).toBe('meena.r@example.com');
    for (const raw of ['', 'a@b', 'no at sign', '@x.com', 'a b@x.com', `${'a'.repeat(250)}@x.com`, 5]) expect(normaliseEmail(raw as never)).toBeNull();
  });
});

describe('checkCustomerInput', () => {
  it('needs a name and one way to recognise the person', () => {
    expect(checkCustomerInput({ name: 'Meena' })).toEqual({ ok: false, problems: ['phone or email: one of them is needed to recognise the customer'] });
    expect(checkCustomerInput({ phone: '9876543210' })).toMatchObject({ ok: false });
  });
  it('keeps the phone as typed and stores the keys', () => {
    const r = checkCustomerInput({ name: '  Meena   Ravi ', phone: '98765 43210', email: 'M@X.com' });
    expect(r).toEqual({ ok: true, value: { name: 'Meena Ravi', phone: '98765 43210', phoneKey: '919876543210', email: 'm@x.com', emailKey: 'm@x.com' } });
  });
  it('a value that is given but unreadable is a problem, never silently dropped', () => {
    expect(checkCustomerInput({ name: 'A', phone: '123', email: 'a@x.com' })).toEqual({ ok: false, problems: ['phone: not a phone number'] });
    expect(checkCustomerInput({ name: 'A', phone: '9876543210', email: 'nope' })).toEqual({ ok: false, problems: ['email: not an e-mail address'] });
  });
  it('limits the name length', () => { expect(checkCustomerInput({ name: 'x'.repeat(121), phone: '9876543210' })).toMatchObject({ ok: false }); });
});

describe('consent', () => {
  it('moves by request until the customer has opted out; an opt-out is final for the business', () => {
    expect(nextConsent('UNKNOWN', 'OPTED_IN')).toBe('OPTED_IN');
    expect(nextConsent('OPTED_IN', 'UNKNOWN')).toBe('UNKNOWN');
    expect(nextConsent('OPTED_IN', 'OPTED_OUT')).toBe('OPTED_OUT');
    expect(nextConsent('OPTED_OUT', 'OPTED_IN')).toBe('OPTED_OUT');
    expect(nextConsent('OPTED_OUT', 'UNKNOWN')).toBe('OPTED_OUT');
  });
});

describe('tags', () => {
  it('trims, drops repeats ignoring case, and refuses bad input', () => {
    expect(cleanTags([' vip ', 'VIP', 'regular'])).toEqual(['vip', 'regular']);
    expect(cleanTags(['x'.repeat(31)])).toBeNull(); expect(cleanTags(['', 'a'])).toBeNull(); expect(cleanTags([1])).toBeNull(); expect(cleanTags('a')).toBeNull();
    expect(cleanTags(Array.from({ length: 21 }, (_, i) => `t${i}`))).toBeNull();
  });
});
