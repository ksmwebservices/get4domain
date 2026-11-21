import { maskEmail, maskPhone } from '../src/directory/core/masking';
import { evaluateBusinessIndexing, evaluateListingPageIndexing } from '../src/directory/core/indexing';
import { canResend, evaluateAttempt, generateOtp, hashCode, hashPhone, normalisePhoneE164, verifyCodeHash } from '../src/directory/core/otp';
import { canTransitionRemoval, nextRemovalStatuses } from '../src/directory/core/removal';
import { clampPage, mergeSponsored, normaliseQuery, scoreMatch, toPrefixTsQuery } from '../src/directory/core/search';
import { businessSlug, slugify, uniqueSlug } from '../src/directory/core/slug';

describe('slugs', () => {
  it.each([['Sri Ganesh Plumbing', 'sri-ganesh-plumbing'], ['  A & B   Traders!! ', 'a-b-traders'], ['Café Madurai', 'cafe-madurai'], ['---x---', 'x'], ['O\'Neil\'s', 'o-neil-s']])('%s -> %s', (i, o) => { expect(slugify(i)).toBe(o); });
  it('a name with no Latin letters or digits (for example Tamil) falls back to "business"', () => { expect(slugify('தமிழ் கடை')).toBe('business'); expect(slugify('')).toBe('business'); expect(slugify(null as never)).toBe('business'); });
  it('is capped at 60 characters without a trailing hyphen', () => { const s = slugify('word '.repeat(40)); expect(s.length).toBeLessThanOrEqual(60); expect(s.endsWith('-')).toBe(false); });
  it('uniqueSlug: the base when free, then -2, -3 ... until free', () => {
    const taken = new Set(['a', 'a-2', 'a-3']);
    expect(uniqueSlug('a', (s) => taken.has(s))).toBe('a-4'); expect(uniqueSlug('fresh', (s) => taken.has(s))).toBe('fresh');
  });
  it('uniqueSlug keeps the suffix inside the length cap', () => { const base = 'x'.repeat(60); const out = uniqueSlug(base, (s) => s === base); expect(out.length).toBeLessThanOrEqual(60); expect(out).toMatch(/-2$/); });
  it('uniqueSlug terminates and still returns something unique if everything is taken', () => { expect(uniqueSlug('a', () => true)).toMatch(/^a-[a-z0-9]{6,}$/); });
  it('businessSlug joins name and city', () => { expect(businessSlug('Sri Ganesh Plumbing', 'Chennai')).toBe('sri-ganesh-plumbing-chennai'); expect(businessSlug('Sri Ganesh', undefined)).toBe('sri-ganesh'); });
});

describe('search query', () => {
  it('normalises: trims, lowercases, collapses space, drops punctuation and control characters, keeps letters and digits of any script', () => {
    expect(normaliseQuery('  Plumber   in  CHENNAI!! ').text).toBe('plumber in chennai');
    expect(normaliseQuery('தமிழ் கடை').tokens).toEqual(['தமிழ்', 'கடை']);
    expect(normaliseQuery('a\u0000b\nc').text).toBe('a b c');
    expect(normaliseQuery("x'; DROP TABLE y;--").tokens).toEqual(['x', 'drop', 'table', 'y']);
  });
  it('caps the length and the number of words, and an empty query has no tokens', () => {
    expect(normaliseQuery('a'.repeat(500)).text.length).toBeLessThanOrEqual(80);
    expect(normaliseQuery('w1 w2 w3 w4 w5 w6 w7 w8 w9 w10').tokens).toHaveLength(8);
    expect(normaliseQuery('   ').tokens).toEqual([]); expect(normaliseQuery(undefined as never).text).toBe('');
  });
  it('toPrefixTsQuery: every token a safe prefix term joined by &; nothing that is not a letter or digit survives', () => {
    expect(toPrefixTsQuery(['plumb', 'chen'])).toBe('plumb:* & chen:*');
    expect(toPrefixTsQuery(['a&b', "c'd", '(e)'])).toBe('ab:* & cd:* & e:*'); expect(toPrefixTsQuery([])).toBe('');
  });
  it('clampPage enforces a hard page-size cap and sane page numbers', () => {
    expect(clampPage(undefined, undefined, 50, 20)).toEqual({ page: 1, pageSize: 20, skip: 0 });
    expect(clampPage(3, 1000, 50, 20)).toEqual({ page: 3, pageSize: 50, skip: 100 });
    expect(clampPage(-4, 0, 50, 20)).toEqual({ page: 1, pageSize: 20, skip: 0 }); expect(clampPage(99999999, 10, 50, 20).page).toBeLessThanOrEqual(1000);
  });
  it('scoreMatch: a name hit outranks a description hit; all words must match; no tokens means no relevance', () => {
    const b = (name: string, description: string, category = '') => ({ name, description, category });
    expect(scoreMatch(['plumber'], b('Sri Plumber Works', 'pipes'))).toBeGreaterThan(scoreMatch(['plumber'], b('Sri Works', 'a plumber for pipes')));
    expect(scoreMatch(['plumber', 'chennai'], b('Sri Plumber Works', 'serving madurai'))).toBe(0);
    expect(scoreMatch([], b('x', 'y'))).toBe(0);
  });
  it('mergeSponsored: organic order is never changed; sponsored items are inserted at fixed positions and keep their label; at most one per N organic', () => {
    const organic = Array.from({ length: 12 }, (_, i) => ({ id: `o${i}`, sponsored: false as const }));
    const spons = [{ id: 's1', sponsored: true as const, label: 'Sponsored' }, { id: 's2', sponsored: true as const, label: 'Sponsored' }, { id: 's3', sponsored: true as const, label: 'Sponsored' }];
    const out = mergeSponsored(organic, spons, 5);
    expect(out.filter((x) => !x.sponsored).map((x) => x.id)).toEqual(organic.map((x) => x.id));   // organic order untouched
    expect(out.map((x) => x.id)).toEqual(['s1', 'o0', 'o1', 'o2', 'o3', 'o4', 's2', 'o5', 'o6', 'o7', 'o8', 'o9', 's3', 'o10', 'o11']);
    expect(out.filter((x) => x.sponsored).every((x) => (x as { label: string }).label === 'Sponsored')).toBe(true);
    expect(mergeSponsored(organic.slice(0, 2), spons, 5).filter((x) => x.sponsored)).toHaveLength(1);   // a short page does not drown in sponsored items
    expect(mergeSponsored(organic, [], 5)).toEqual(organic);
  });
  it('mergeSponsored refuses a sponsored item without a label (it can never appear unlabelled)', () => {
    expect(() => mergeSponsored([], [{ id: 's', sponsored: true as const, label: '' }], 5)).toThrow(/label/);
  });
});

describe('indexability', () => {
  const ok = { status: 'CLAIMED', name: 'Sri Ganesh Plumbing', categoryId: 'c', locationId: 'l', phoneE164: '+919876543210', addressLine: '', descriptionText: 'Fast and tidy plumbing work across the city, with clear prices.' };
  const rules = { indexUnclaimed: false, minDescriptionChars: 40 };
  it('a claimed business with every mandatory field is indexable', () => { expect(evaluateBusinessIndexing(ok, rules)).toEqual({ indexable: true, missing: [] }); });
  it('each missing mandatory field is named and blocks indexing', () => {
    const r = evaluateBusinessIndexing({ ...ok, name: '', locationId: null, phoneE164: null, addressLine: '', descriptionText: 'short' }, rules);
    expect(r.indexable).toBe(false); expect(r.missing.sort()).toEqual(['CONTACT', 'DESCRIPTION', 'LOCATION', 'NAME']);
  });
  it('an address line can stand in for a phone number', () => { expect(evaluateBusinessIndexing({ ...ok, phoneE164: null, addressLine: '12 Test Road' }, rules).indexable).toBe(true); });
  it('UNCLAIMED is not indexable unless the setting allows it; DRAFT, SUSPENDED and REMOVED never are', () => {
    expect(evaluateBusinessIndexing({ ...ok, status: 'UNCLAIMED' }, rules)).toMatchObject({ indexable: false, missing: ['CLAIM'] });
    expect(evaluateBusinessIndexing({ ...ok, status: 'UNCLAIMED' }, { ...rules, indexUnclaimed: true }).indexable).toBe(true);
    for (const status of ['DRAFT', 'SUSPENDED', 'REMOVED']) expect(evaluateBusinessIndexing({ ...ok, status }, { ...rules, indexUnclaimed: true }).indexable).toBe(false);
  });
  it('a thin location or category page is noindex below the threshold', () => {
    expect(evaluateListingPageIndexing(2, 3)).toEqual({ indexable: false, reason: 'THIN' }); expect(evaluateListingPageIndexing(3, 3)).toEqual({ indexable: true, reason: null });
    expect(evaluateListingPageIndexing(0, 0)).toEqual({ indexable: true, reason: null });
  });
});

describe('phone numbers', () => {
  it.each([['98765 43210', '+919876543210'], ['+91 98765-43210', '+919876543210'], ['09876543210', '+919876543210'], ['919876543210', '+919876543210'], ['+14155550123', '+14155550123']])('%s -> %s', (i, o) => { expect(normalisePhoneE164(i)).toBe(o); });
  it.each(['', '12345', '5876543210', 'abcdefghij', '+', '+1', '98765432101234567', null, undefined])('refuses %j', (i) => { expect(normalisePhoneE164(i as never)).toBeNull(); });
  it('masking keeps only the shape', () => { expect(maskPhone('+919876543210')).toBe('+91•••••••210'); expect(maskEmail('owner@example.com')).toBe('o•••@example.com'); expect(maskEmail('x@y.in')).toBe('x•••@y.in'); expect(maskEmail('nope')).toBe(''); });
});

describe('OTP', () => {
  it('generateOtp: six digits from the injected random source, zero padded, never from Math.random', () => {
    expect(generateOtp(() => 7)).toBe('000007'); expect(generateOtp(() => 999999)).toBe('999999');
    let seen: [number, number] | null = null; generateOtp((min, max) => { seen = [min, max]; return 5; }); expect(seen).toEqual([0, 1_000_000]);
  });
  it('hashCode is salted and keyed: same inputs equal, any change differs, and the code is not in the hash', () => {
    const h = hashCode('123456', 'salt-a', 'pepper');
    expect(h).toBe(hashCode('123456', 'salt-a', 'pepper')); expect(h).not.toBe(hashCode('123456', 'salt-b', 'pepper')); expect(h).not.toBe(hashCode('123457', 'salt-a', 'pepper')); expect(h).not.toBe(hashCode('123456', 'salt-a', 'other'));
    expect(h).not.toContain('123456'); expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
  it('verifyCodeHash compares in constant time and refuses anything that is not a code', () => {
    const h = hashCode('123456', 's', 'p');
    expect(verifyCodeHash('123456', h, 's', 'p')).toBe(true); expect(verifyCodeHash('654321', h, 's', 'p')).toBe(false);
    for (const bad of ['', '12345', '1234567', 'abcdef', ' 123456', null, undefined, 123456]) expect(verifyCodeHash(bad as never, h, 's', 'p')).toBe(false);
    expect(verifyCodeHash('123456', 'short', 's', 'p')).toBe(false);
  });
  it('hashPhone is keyed and stable', () => { expect(hashPhone('+919876543210', 'p')).toBe(hashPhone('+919876543210', 'p')); expect(hashPhone('+919876543210', 'p')).not.toBe(hashPhone('+919876543211', 'p')); expect(hashPhone('+919876543210', 'p')).not.toBe(hashPhone('+919876543210', 'q')); });
  const base = { status: 'PENDING' as const, attempts: 0, maxAttempts: 5, expiresAt: new Date('2026-11-05T10:10:00Z'), usedAt: null as Date | null };
  const now = new Date('2026-11-05T10:05:00Z');
  const hash = hashCode('123456', 's', 'p');
  it('right code in time: OK', () => { expect(evaluateAttempt(base, now, true)).toEqual({ result: 'OK', attempts: 1 }); });
  it('wrong code: WRONG with the attempt counted; the fifth wrong code LOCKS', () => {
    expect(evaluateAttempt(base, now, false)).toEqual({ result: 'WRONG', attempts: 1 });
    expect(evaluateAttempt({ ...base, attempts: 4 }, now, false)).toEqual({ result: 'LOCKED', attempts: 5 });
  });
  it('a locked challenge refuses even the right code; so do expired, used and non-pending ones', () => {
    expect(evaluateAttempt({ ...base, attempts: 5 }, now, true).result).toBe('LOCKED');
    expect(evaluateAttempt({ ...base, status: 'LOCKED' }, now, true).result).toBe('LOCKED');
    expect(evaluateAttempt(base, new Date('2026-11-05T10:10:01Z'), true).result).toBe('EXPIRED');
    expect(evaluateAttempt({ ...base, usedAt: now, status: 'VERIFIED' }, now, true).result).toBe('USED');
    expect(evaluateAttempt({ ...base, status: 'REVOKED' }, now, true).result).toBe('USED');
  });
  it('resend cooldown', () => {
    const last = new Date('2026-11-05T10:00:00Z');
    expect(canResend(last, new Date('2026-11-05T10:00:30Z'), 60)).toBe(false); expect(canResend(last, new Date('2026-11-05T10:01:00Z'), 60)).toBe(true); expect(canResend(null, now, 60)).toBe(true);
  });
  void hash;
});

describe('removal flow', () => {
  it('REQUESTED goes to APPROVED or REJECTED; APPROVED goes to EXECUTED; the rest is closed', () => {
    expect(nextRemovalStatuses('REQUESTED')).toEqual(['APPROVED', 'REJECTED']); expect(nextRemovalStatuses('APPROVED')).toEqual(['EXECUTED']);
    expect(nextRemovalStatuses('REJECTED')).toEqual([]); expect(nextRemovalStatuses('EXECUTED')).toEqual([]);
    expect(canTransitionRemoval('REQUESTED', 'EXECUTED')).toBe(false); expect(canTransitionRemoval('REJECTED', 'APPROVED')).toBe(false); expect(canTransitionRemoval('APPROVED', 'EXECUTED')).toBe(true);
  });
});
