import { canMoveReport, comparePayeeName, foldText, matchProhibited, normaliseBlockValue, normaliseTerm, TAKEDOWN_NOTICE_HTML } from '../src/v3-trust/core/trust-core';

/** Slice 5.21: the pure rules. The phrases below are INVENTED test data; the real table is filled by staff and ships empty. */
describe('block list values are compared in one canonical form', () => {
  it('phone: the last ten digits, whatever the spelling', () => {
    for (const v of ['+91 98765 43210', '098765-43210', '9876543210', '+919876543210']) expect(normaliseBlockValue('PHONE', v)).toBe('9876543210');
    expect(normaliseBlockValue('PHONE', '12345')).toBeNull();
  });
  it('email: lower case, must look like an address', () => { expect(normaliseBlockValue('EMAIL', ' Foo@Example.COM ')).toBe('foo@example.com'); expect(normaliseBlockValue('EMAIL', 'nope')).toBeNull(); });
  it('domain: host only, no scheme, www, port, path', () => {
    expect(normaliseBlockValue('DOMAIN', 'https://WWW.Bad-Shop.in:8080/a/b?x=1')).toBe('bad-shop.in');
    expect(normaliseBlockValue('DOMAIN', 'bad-shop.in.')).toBe('bad-shop.in'); expect(normaliseBlockValue('DOMAIN', 'localhost')).toBeNull();
  });
  it('upi: lower case handle@bank', () => { expect(normaliseBlockValue('UPI', 'Shop.One@OkBank')).toBe('shop.one@okbank'); expect(normaliseBlockValue('UPI', 'shop one')).toBeNull(); });
  it('name: folded (case, accents, punctuation, spacing)', () => { expect(normaliseBlockValue('NAME', '  Sri  MURUGAN, Stores. ')).toBe('sri murugan stores'); expect(normaliseBlockValue('NAME', 'a')).toBeNull(); });
  it('empty, oversized and unknown kinds are refused', () => { expect(normaliseBlockValue('PHONE', '')).toBeNull(); expect(normaliseBlockValue('EMAIL', 'a@b.co'.padEnd(400, 'x'))).toBeNull(); expect(normaliseBlockValue('XYZ' as never, 'a')).toBeNull(); });
});

describe('the prohibited-phrase scan', () => {
  const terms = [{ term: 'Zeta Powder', category: 'TEST_A', enabled: true }, { term: 'quick  cash', category: 'TEST_B', enabled: true }, { term: 'switched off', category: 'TEST_C', enabled: false }];
  it('finds enabled phrases as whole words, case-blind and spacing-blind, each once', () => {
    expect(matchProhibited(['We sell ZETA   powder!!', 'zeta powder again'], terms)).toEqual([{ term: 'zeta powder', category: 'TEST_A' }]);
    expect(matchProhibited(['Get Quick-Cash today'], terms)).toEqual([{ term: 'quick cash', category: 'TEST_B' }]);
  });
  it('does not match inside a longer word, a disabled phrase, or an empty table', () => {
    expect(matchProhibited(['zetapowder', 'a zeta powderx'], terms)).toEqual([]);
    expect(matchProhibited(['this is switched off'], terms)).toEqual([]);
    expect(matchProhibited(['zeta powder'], [])).toEqual([]);
    expect(matchProhibited([], terms)).toEqual([]); expect(matchProhibited(['', '   '], terms)).toEqual([]);
  });
  it('a phrase cannot match across two separate texts', () => { expect(matchProhibited(['zeta', 'powder'], terms)).toEqual([]); });
  it('terms are stored folded', () => { expect(normaliseTerm('  Zeta,  POWDER ')).toBe('zeta powder'); expect(foldText('Café  Étoile')).toBe('cafe etoile'); });
});

describe('the payee name check', () => {
  it('MATCH on equal names, or when one holds the other as whole words', () => {
    expect(comparePayeeName('Murugan Stores', ['Murugan Stores', 'K Raman'])).toBe('MATCH');
    expect(comparePayeeName('SRI MURUGAN STORES', ['Murugan Stores'])).toBe('MATCH');
    expect(comparePayeeName('K Raman', ['Murugan Stores', 'K. Raman'])).toBe('MATCH');
  });
  it('MISMATCH when nothing lines up, UNKNOWN when there is nothing to compare', () => {
    expect(comparePayeeName('Someone Else', ['Murugan Stores', 'K Raman'])).toBe('MISMATCH');
    expect(comparePayeeName('Murug', ['Murugan Stores'])).toBe('MISMATCH');
    expect(comparePayeeName('', ['Murugan Stores'])).toBe('UNKNOWN'); expect(comparePayeeName(null, ['x y'])).toBe('UNKNOWN'); expect(comparePayeeName('A B', [])).toBe('UNKNOWN');
  });
});

describe('report moves and the notice page', () => {
  it('a closed report can only be looked at again', () => { expect(canMoveReport('NEW', 'CLOSED')).toBe(true); expect(canMoveReport('CLOSED', 'NEW')).toBe(false); expect(canMoveReport('CLOSED', 'LOOKING')).toBe(true); });
  it('the takedown notice is plain: no form, link, script or business content, and noindex; no banned product words', () => {
    expect(TAKEDOWN_NOTICE_HTML).toMatch(/noindex,nofollow/); expect(TAKEDOWN_NOTICE_HTML).not.toMatch(/<(form|a |script|img|iframe|input|button)/i);
    expect(TAKEDOWN_NOTICE_HTML).not.toMatch(/workspace|BOS|LeadSpace/i);
  });
});
