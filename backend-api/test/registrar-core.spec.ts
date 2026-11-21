import {
  aadhaarProblem, expiryAlertDue, liveFlags, liveGuardProblems, marginFor, nextOrder, parseDomain, priceFromCost, renewalAllowed, resolveMargin, validNameServers, DOC_KINDS,
} from '../src/v3-registrar/core/registrar-core';

describe('domain names', () => {
  it('accepts a name and its extension, lowercase and trimmed', () => {
    expect(parseDomain(' Sri-Ganesh.CO.in ')).toEqual({ ok: true, domain: 'sri-ganesh.co.in', sld: 'sri-ganesh', tld: 'co.in' });
    expect(parseDomain('shop.com')).toEqual({ ok: true, domain: 'shop.com', sld: 'shop', tld: 'com' });
  });
  it('refuses what cannot be registered', () => {
    for (const bad of ['', 'nodot', '-a.com', 'a-.com', 'a..com', 'sp ace.com', 'a_b.com', `${'x'.repeat(64)}.com`, 'a.b.c.d.com', 'a.c', 'http://a.com', '.com'] as const) expect([bad, parseDomain(bad).ok]).toEqual([bad, false]);
  });
  it('a name with more than one label before the extension is refused: a vendor buys a domain, not a subdomain', () => {
    expect(parseDomain('www.shop.com').ok).toBe(false);
  });
});

describe('price: cost plus an admin-set margin (no price is invented)', () => {
  it('a percentage margin is in basis points, rounded half up to whole paise; a fixed margin is added as it is', () => {
    expect(priceFromCost(80_000, { kind: 'PERCENT_BP', value: 2500 })).toEqual({ costPaise: 80_000, marginPaise: 20_000, pricePaise: 100_000 });
    expect(priceFromCost(333, { kind: 'PERCENT_BP', value: 150 })).toEqual({ costPaise: 333, marginPaise: 5, pricePaise: 338 });   // 4.995 rounds up
    expect(priceFromCost(80_000, { kind: 'FIXED_PAISE', value: 15_000 })).toEqual({ costPaise: 80_000, marginPaise: 15_000, pricePaise: 95_000 });
  });
  it('refuses a cost or a margin that is not whole paise', () => {
    expect(() => priceFromCost(-1, { kind: 'FIXED_PAISE', value: 0 })).toThrow();
    expect(() => priceFromCost(100.5, { kind: 'FIXED_PAISE', value: 0 })).toThrow();
    expect(() => priceFromCost(100, { kind: 'FIXED_PAISE', value: -5 })).toThrow();
  });
  const rows = [
    { id: 'a', tld: 'com', kind: 'PERCENT_BP' as const, value: 1000, status: 'APPROVED' as const, effectiveFrom: new Date('2026-01-01') },
    { id: 'b', tld: 'com', kind: 'PERCENT_BP' as const, value: 2000, status: 'APPROVED' as const, effectiveFrom: new Date('2026-06-01') },
    { id: 'c', tld: 'com', kind: 'PERCENT_BP' as const, value: 9000, status: 'PROPOSED' as const, effectiveFrom: new Date('2026-02-01') },
    { id: 'd', tld: 'in', kind: 'FIXED_PAISE' as const, value: 5000, status: 'APPROVED' as const, effectiveFrom: new Date('2027-01-01') },
  ];
  it('the margin in force is the APPROVED row with the latest start that has begun; a proposal or a future row never applies', () => {
    expect(resolveMargin(rows, 'com', new Date('2026-03-01'))?.id).toBe('a');
    expect(resolveMargin(rows, 'com', new Date('2026-07-01'))?.id).toBe('b');
    expect(resolveMargin(rows, 'in', new Date('2026-07-01'))).toBeNull();
    expect(resolveMargin(rows, 'org', new Date('2026-07-01'))).toBeNull();
    expect(marginFor(rows, 'com', new Date('2026-07-01'))).toEqual({ kind: 'PERCENT_BP', value: 2000 });
  });
});

describe('renewal is before expiry only', () => {
  it('allowed while the expiry is in the future, refused at and after it', () => {
    const now = new Date('2026-11-12T10:00:00Z');
    expect(renewalAllowed(new Date('2026-11-12T10:00:01Z'), now)).toBe(true);
    expect(renewalAllowed(new Date('2026-11-12T10:00:00Z'), now)).toBe(false);
    expect(renewalAllowed(new Date('2026-01-01T00:00:00Z'), now)).toBe(false);
    expect(renewalAllowed(null, now)).toBe(false);
  });
});

describe('identity documents', () => {
  it('lists the accepted kinds and never a full Aadhaar number', () => {
    expect(DOC_KINDS).toEqual(['PAN', 'GST_CERTIFICATE', 'UDYAM', 'BUSINESS_REGISTRATION', 'AADHAAR_MASKED']);
    expect(aadhaarProblem('1234 5678 9012')).toBe(true);
    expect(aadhaarProblem('1234-5678-9012')).toBe(true);
    expect(aadhaarProblem('123456789012')).toBe(true);
    expect(aadhaarProblem('XXXX XXXX 9012')).toBe(false);
    expect(aadhaarProblem('ABCDE1234F')).toBe(false);
    expect(aadhaarProblem('9012')).toBe(false);
  });
});

describe('name servers', () => {
  it('needs two to five valid host names', () => {
    expect(validNameServers(['ns1.example.com', 'ns2.example.com'])).toBe(true);
    expect(validNameServers(['ns1.example.com'])).toBe(false);
    expect(validNameServers(['ns1.example.com', 'bad host'])).toBe(false);
    expect(validNameServers(Array.from({ length: 6 }, (_, i) => `ns${i}.example.com`))).toBe(false);
    expect(validNameServers(null)).toBe(false);
  });
});

describe('the order state machine', () => {
  it('walks CREATED, HELD, SUBMITTED, COMPLETED', () => {
    expect(nextOrder('CREATED', 'HOLD_PLACED')).toBe('HELD');
    expect(nextOrder('HELD', 'SUBMITTED')).toBe('SUBMITTED');
    expect(nextOrder('SUBMITTED', 'REGISTRAR_OK')).toBe('COMPLETED');
  });
  it('a refusal releases; a timeout is UNKNOWN until reconciliation settles it either way', () => {
    expect(nextOrder('SUBMITTED', 'REGISTRAR_REFUSED')).toBe('FAILED');
    expect(nextOrder('HELD', 'NOT_SUBMITTED')).toBe('FAILED');
    expect(nextOrder('SUBMITTED', 'REGISTRAR_UNSURE')).toBe('UNKNOWN');
    expect(nextOrder('UNKNOWN', 'REGISTRAR_OK')).toBe('COMPLETED');
    expect(nextOrder('UNKNOWN', 'REGISTRAR_REFUSED')).toBe('FAILED');
  });
  it('a finished order never moves again', () => {
    for (const ev of ['HOLD_PLACED', 'SUBMITTED', 'REGISTRAR_OK', 'REGISTRAR_REFUSED', 'REGISTRAR_UNSURE', 'NOT_SUBMITTED'] as const) { expect(nextOrder('COMPLETED', ev)).toBeNull(); expect(nextOrder('FAILED', ev)).toBeNull(); }
  });
});

describe('the live flags and the startup guard', () => {
  it('both flags are OFF unless set to true or 1, separately', () => {
    expect(liveFlags({})).toEqual({ search: false, purchase: false });
    expect(liveFlags({ REGISTRAR_LIVE_SEARCH: 'true' })).toEqual({ search: true, purchase: false });
    expect(liveFlags({ REGISTRAR_LIVE_PURCHASE: '1' })).toEqual({ search: false, purchase: true });
    expect(liveFlags({ REGISTRAR_LIVE_SEARCH: 'yes', REGISTRAR_LIVE_PURCHASE: 'TRUE' })).toEqual({ search: false, purchase: false });
  });
  it('refuses live mode unless both keys exist in the environment, and names which are missing (never their values)', () => {
    expect(liveGuardProblems({})).toEqual([]);
    expect(liveGuardProblems({ REGISTRAR_LIVE_SEARCH: 'true' })).toEqual(['RESELLERCLUB_AUTH_USERID', 'RESELLERCLUB_API_KEY']);
    expect(liveGuardProblems({ REGISTRAR_LIVE_PURCHASE: 'true', RESELLERCLUB_AUTH_USERID: '1' })).toEqual(['RESELLERCLUB_API_KEY']);
    expect(liveGuardProblems({ REGISTRAR_LIVE_PURCHASE: 'true', RESELLERCLUB_AUTH_USERID: '1', RESELLERCLUB_API_KEY: 'k' })).toEqual([]);
    expect(JSON.stringify(liveGuardProblems({ REGISTRAR_LIVE_SEARCH: 'true', RESELLERCLUB_API_KEY: 'topsecret' }))).not.toContain('topsecret');
  });
});

describe('expiry alerts', () => {
  const exp = new Date('2026-12-31T00:00:00Z');
  it('picks the nearest threshold that has been reached and not yet sent; nothing when the setting is off or the domain is far away', () => {
    expect(expiryAlertDue(exp, new Date('2026-11-15T00:00:00Z'), [60, 30, 7], [])).toBe(60);   // 46 days left: only the first threshold is reached
    expect(expiryAlertDue(exp, new Date('2026-12-01T00:00:00Z'), [60, 30, 7], [60])).toBe(30);
    expect(expiryAlertDue(exp, new Date('2026-12-01T00:00:00Z'), [60, 30, 7], [])).toBe(30);   // joined late: the nearest threshold, not a stale one
    expect(expiryAlertDue(exp, new Date('2026-12-26T00:00:00Z'), [60, 30, 7], [60, 30])).toBe(7);
    expect(expiryAlertDue(exp, new Date('2026-12-26T00:00:00Z'), [60, 30, 7], [60, 30, 7])).toBeNull();
    expect(expiryAlertDue(exp, new Date('2026-06-01T00:00:00Z'), [60, 30, 7], [])).toBeNull();
    expect(expiryAlertDue(exp, new Date('2026-12-01T00:00:00Z'), null, [])).toBeNull();
    expect(expiryAlertDue(exp, new Date('2027-01-05T00:00:00Z'), [60, 30, 7], [])).toBeNull();   // already expired: no reminder, renewal is no longer possible
  });
});
