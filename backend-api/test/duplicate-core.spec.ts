import {
  classify, editDistance, hostOf, isMediumMatch, Match, matchesFromCandidates, NameCandidate, normaliseBusinessName, normaliseGstin, normalisePincode, phoneKeyOf, similarSubdomain, strengthOf, trigramSimilarity,
} from '../src/v3-duplicates/core/duplicate-core';

const strong = (signal: Match['signal'], attachable = false): Match => ({ signal, strength: 'STRONG', vendorId: attachable ? null : 'v1', businessId: attachable ? 'b1' : null, attachable });
const cand = (o: Partial<NameCandidate> = {}): NameCandidate => ({ vendorId: 'v1', businessId: null, attachable: false, similarity: 0.8, locationMatch: true, categoryMatch: true, ownerMatch: false, addressMatch: false, ...o });

describe('D1 duplicate core: normalisers', () => {
  it('phoneKeyOf is the last 10 digits whatever the spelling, and null below 10 digits (the migration backfill rule)', () => {
    for (const raw of ['+91 98765 43210', '098765 43210', '9876543210', '+91-9876543210', '0091 9876543210', '(+91) 98765-43210']) expect(phoneKeyOf(raw)).toBe('9876543210');
    expect(phoneKeyOf('12345')).toBeNull(); expect(phoneKeyOf('')).toBeNull(); expect(phoneKeyOf(undefined)).toBeNull(); expect(phoneKeyOf(98765)).toBeNull();
  });
  it('GSTIN: upper case, spaces and dashes removed, and only the 15-character shape counts', () => {
    expect(normaliseGstin('33abcde1234f1z5')).toBe('33ABCDE1234F1Z5');
    expect(normaliseGstin('33 ABCDE-1234F1Z5')).toBe('33ABCDE1234F1Z5');
    for (const bad of ['33ABCDE1234F1Z', '', 'hello', '33ABCDE1234F1X5', null]) expect(normaliseGstin(bad)).toBeNull();
  });
  it('a business name drops punctuation and legal words, so "Sri Ganesh Plumbing Pvt. Ltd." and "SRI GANESH PLUMBING" are one name', () => {
    expect(normaliseBusinessName('Sri Ganesh Plumbing Pvt. Ltd.')).toBe(normaliseBusinessName('SRI GANESH PLUMBING'));
    expect(normaliseBusinessName('Ram & Co')).toBe('ram');
    expect(normaliseBusinessName('Services')).toBe('services');   // never reduced to nothing
  });
  it('pincode: six digits only; hostOf strips scheme, www, port and path', () => {
    expect(normalisePincode('600017')).toBe('600017'); expect(normalisePincode('6000')).toBeNull();
    expect(hostOf('https://www.Example.com:8080/path?x=1')).toBe('example.com'); expect(hostOf('not a host')).toBeNull(); expect(hostOf('localhost')).toBeNull();
  });
  it('trigramSimilarity follows pg_trgm: identical = 1, unrelated = 0, a near name is high, a different one low', () => {
    expect(trigramSimilarity('Ganesh Plumbing', 'ganesh plumbing')).toBe(1);
    expect(trigramSimilarity('abc', 'xyz')).toBe(0);
    expect(trigramSimilarity('Sri Ganesh Plumbing', 'Sri Ganesh Plumbers')).toBeGreaterThan(0.55);
    expect(trigramSimilarity('Sri Ganesh Plumbing', 'Kumar Electricals')).toBeLessThan(0.2);
    // the value pg_trgm itself gives for similarity('word','two words'): 0.363636
    expect(trigramSimilarity('word', 'two words')).toBeCloseTo(0.3636, 3);
  });
});

describe('D1 duplicate core: classification', () => {
  it('strength: phone, e-mail, GSTIN, website and custom domain are strong; name+place+category medium; owner and address supporting', () => {
    for (const s of ['PHONE', 'EMAIL', 'GSTIN', 'WEBSITE', 'CUSTOM_DOMAIN'] as const) expect(strengthOf(s)).toBe('STRONG');
    expect(strengthOf('NAME_LOCATION_CATEGORY')).toBe('MEDIUM'); expect(strengthOf('OWNER')).toBe('SUPPORTING'); expect(strengthOf('ADDRESS')).toBe('SUPPORTING');
  });
  it('medium needs the place AND the category AND a close name; a nearer miss counts only with the owner or the address', () => {
    expect(isMediumMatch(cand())).toBe(true);
    expect(isMediumMatch(cand({ locationMatch: false }))).toBe(false);
    expect(isMediumMatch(cand({ categoryMatch: false }))).toBe(false);
    expect(isMediumMatch(cand({ similarity: 0.5 }))).toBe(false);
    expect(isMediumMatch(cand({ similarity: 0.5, ownerMatch: true }))).toBe(true);
    expect(isMediumMatch(cand({ similarity: 0.5, addressMatch: true }))).toBe(true);
    expect(isMediumMatch(cand({ similarity: 0.3, ownerMatch: true, addressMatch: true }))).toBe(false);
  });
  it('owner and address alone are supporting matches and never decide an outcome', () => {
    const ms = matchesFromCandidates([cand({ locationMatch: false, ownerMatch: true, addressMatch: true, similarity: 0.45 })]);
    expect(ms.map((m) => m.signal).sort()).toEqual(['ADDRESS', 'OWNER']);
    expect(classify(ms, { listingsAreAttachable: false }).outcome).toBe('CLEAR');
  });
  it('strong beats medium; medium beats nothing', () => {
    const med = matchesFromCandidates([cand()]);
    expect(classify([...med, strong('PHONE')], { listingsAreAttachable: false })).toMatchObject({ outcome: 'BLOCKED' });
    expect(classify(med, { listingsAreAttachable: false })).toMatchObject({ outcome: 'POSSIBLE' });
    expect(classify([], { listingsAreAttachable: false }).outcome).toBe('CLEAR');
  });
  it('an unowned listing stops a self-service path but not a staff path (which attaches to it)', () => {
    const m = [strong('PHONE', true)];
    expect(classify(m, { listingsAreAttachable: false }).outcome).toBe('BLOCKED');
    expect(classify(m, { listingsAreAttachable: true }).outcome).toBe('CLEAR');
    // a listing that HAS an owner is a real business on every path
    expect(classify([{ ...strong('PHONE', true), vendorId: 'v9', attachable: false }], { listingsAreAttachable: true }).outcome).toBe('BLOCKED');
  });
});

describe('D1 duplicate core: similar subdomain', () => {
  it('editDistance is capped', () => { expect(editDistance('abc', 'abd')).toBe(1); expect(editDistance('abc', 'xyzxyz')).toBeGreaterThan(2); });
  it('a look-alike or a one-letter difference warns; a different name and an identical one do not', () => {
    expect(similarSubdomain('sr1ganesh', ['kumar', 'sriganesh'])).toBe('sriganesh');   // 1 read as i
    expect(similarSubdomain('sriganesh', ['sriganesh'])).toBeNull();                   // identical is "taken", not a warning
    expect(similarSubdomain('sriganesh', ['sriganeshh'])).toBe('sriganeshh');
    expect(similarSubdomain('sriganesh', ['kumar-electricals'])).toBeNull();
    expect(similarSubdomain('abc', ['abd'])).toBeNull();                               // short names are not compared by distance
  });
});
