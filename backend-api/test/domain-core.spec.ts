import { challengeName, checkTxt, DnsResolver, generateTxtValue } from '../src/site-domains/core/verification';
import { choosePrimary, planRedirect, DomainRow } from '../src/site-domains/core/canonical';
import { normaliseHostname, validateSubdomainSlug, confusableKey, SlugRules } from '../src/site-domains/core/hostname';

const RULES: SlugRules = { min: 3, max: 30, reserved: ['www', 'admin', 'api', 'support', 'mail'], blockedWords: ['scam', 'official'] };

describe('normaliseHostname', () => {
  it.each([
    ['Example.COM', 'example.com'], ['  www.Example.in. ', 'www.example.in'], ['shop.example.co.in:443', 'shop.example.co.in'], ['bücher.de', 'xn--bcher-kva.de'], ['xn--bcher-kva.de', 'xn--bcher-kva.de'],
  ])('%s -> %s', (i, o) => { expect(normaliseHostname(i)).toBe(o); });
  it.each(['', 'localhost', 'example', '127.0.0.1', '10.0.0.1', '[::1]', 'a b.com', 'exa_mple.com', '-bad.com', 'bad-.com', 'a..com', '*.example.com', 'http://example.com', 'example.com/path', 'user@example.com', `${'a'.repeat(64)}.com`, `${'a.'.repeat(130)}com`, 'example.c', 'example.123'])('refuses %j', (i) => { expect(normaliseHostname(i)).toBeNull(); });
  it('never throws on odd input', () => { for (const v of [null, undefined, 42, {}, [], '\u0000', 'a\nb.com']) expect(() => normaliseHostname(v as never)).not.toThrow(); });
});

describe('validateSubdomainSlug', () => {
  it('accepts a normal slug and lowercases it', () => { expect(validateSubdomainSlug('Sri-Ganesh-Plumbing', RULES)).toEqual({ ok: true, slug: 'sri-ganesh-plumbing' }); });
  it.each([
    ['ab', 'TOO_SHORT'], ['a'.repeat(31), 'TOO_LONG'], ['-abc', 'BAD_EDGE'], ['abc-', 'BAD_EDGE'], ['a--b', 'CONSECUTIVE_HYPHENS'], ['a_b', 'BAD_CHARACTERS'], ['a.b', 'BAD_CHARACTERS'], ['ça-va', 'BAD_CHARACTERS'],
    ['www', 'RESERVED'], ['ADMIN', 'RESERVED'], ['adm1n', 'RESERVED'], ['supp0rt', 'RESERVED'], ['m-a-i-l', 'RESERVED'], ['official', 'BLOCKED'], ['0fficial', 'BLOCKED'], ['my-scam-shop', 'BLOCKED'],
  ])('%s -> %s', (slug, code) => { expect(validateSubdomainSlug(slug, RULES)).toEqual({ ok: false, code }); });
  it('numbers only are allowed; a name added to the reserved list is refused', () => {
    expect(validateSubdomainSlug('12345', RULES).ok).toBe(true);
    expect(validateSubdomainSlug('get4domain', { ...RULES, reserved: [...RULES.reserved, 'get4domain'] })).toEqual({ ok: false, code: 'RESERVED' });
  });
  it('confusableKey folds look-alike characters and separators', () => { expect(confusableKey('Adm1n')).toBe('admin'); expect(confusableKey('m-a-i-l')).toBe('mail'); expect(confusableKey('5upp0rt')).toBe('support'); });
  it('never throws', () => { for (const v of [null, undefined, 5, {}, '']) expect(() => validateSubdomainSlug(v as never, RULES)).not.toThrow(); expect(validateSubdomainSlug(null as never, RULES).ok).toBe(false); });
});

const row = (o: Partial<DomainRow> & { hostname: string }): DomainRow => ({ id: o.hostname, kind: 'CUSTOM', status: 'ACTIVE', isPrimary: false, ...o });
describe('choosePrimary (exactly one primary per vendor; a custom domain is primary only when ACTIVE and the plan allows it)', () => {
  const sub = row({ hostname: 'shop.get4domain.com', kind: 'SUBDOMAIN', isPrimary: true });
  it('the subdomain is primary when it is the only host', () => { expect(choosePrimary([sub], { customAllowed: true })?.hostname).toBe('shop.get4domain.com'); });
  it('an ACTIVE custom domain flagged primary wins', () => { expect(choosePrimary([sub, row({ hostname: 'shop.in', isPrimary: true })], { customAllowed: true })?.hostname).toBe('shop.in'); });
  it('a custom domain that is not ACTIVE never wins', () => { for (const status of ['PENDING', 'VERIFYING', 'FAILED', 'REMOVED'] as const) expect(choosePrimary([sub, row({ hostname: 'shop.in', status, isPrimary: true })], { customAllowed: true })?.hostname).toBe('shop.get4domain.com'); });
  it('when the plan no longer allows custom domains the subdomain is primary, and the custom row is untouched', () => {
    const rows = [sub, row({ hostname: 'shop.in', isPrimary: true })];
    expect(choosePrimary(rows, { customAllowed: false })?.hostname).toBe('shop.get4domain.com');
    expect(rows[1].isPrimary).toBe(true);
  });
  it('an ACTIVE custom domain that is not flagged primary does not steal it', () => { expect(choosePrimary([sub, row({ hostname: 'shop.in' })], { customAllowed: true })?.hostname).toBe('shop.get4domain.com'); });
  it('REMOVED rows are ignored, and no usable host gives null', () => { expect(choosePrimary([row({ hostname: 'a.get4domain.com', kind: 'SUBDOMAIN', status: 'REMOVED', isPrimary: true })], { customAllowed: true })).toBeNull(); expect(choosePrimary([], { customAllowed: true })).toBeNull(); });
  it('two rows flagged primary (corrupt data) still give exactly one answer, deterministically', () => {
    const a = choosePrimary([row({ hostname: 'b.in', isPrimary: true }), row({ hostname: 'a.in', isPrimary: true }), sub], { customAllowed: true });
    expect(a?.hostname).toBe('a.in');
  });
});

describe('planRedirect (non-primary hosts 301 to the primary; www and apex by policy; path preserved by the caller)', () => {
  it('serves the primary host as it is', () => { expect(planRedirect({ requestHost: 'shop.in', primaryHost: 'shop.in', ownedHosts: ['shop.in'], wwwPolicy: 'apex' })).toEqual({ action: 'SERVE' }); });
  it('redirects another host of the same vendor to the primary with 301', () => { expect(planRedirect({ requestHost: 'shop.get4domain.com', primaryHost: 'shop.in', ownedHosts: ['shop.get4domain.com', 'shop.in'], wwwPolicy: 'apex' })).toEqual({ action: 'REDIRECT', host: 'shop.in', status: 301 }); });
  it('apex policy: www.<primary> redirects to the apex primary', () => { expect(planRedirect({ requestHost: 'www.shop.in', primaryHost: 'shop.in', ownedHosts: ['shop.in'], wwwPolicy: 'apex' })).toEqual({ action: 'REDIRECT', host: 'shop.in', status: 301 }); });
  it('www policy: the apex of a www primary redirects to www', () => { expect(planRedirect({ requestHost: 'shop.in', primaryHost: 'www.shop.in', ownedHosts: ['www.shop.in'], wwwPolicy: 'www' })).toEqual({ action: 'REDIRECT', host: 'www.shop.in', status: 301 }); });
  it('a www alias of a host the vendor does not own is not redirected (it is simply unknown)', () => { expect(planRedirect({ requestHost: 'www.other.in', primaryHost: 'shop.in', ownedHosts: ['shop.in'], wwwPolicy: 'apex' })).toEqual({ action: 'UNKNOWN' }); });
  it('an unknown host is unknown', () => { expect(planRedirect({ requestHost: 'x.in', primaryHost: 'shop.in', ownedHosts: ['shop.in'], wwwPolicy: 'apex' })).toEqual({ action: 'UNKNOWN' }); });
});

describe('verification', () => {
  it('the TXT value comes from the injected random source, is prefixed, and is long enough to be unguessable', () => {
    const v = generateTxtValue((n) => 'ab'.repeat(n / 2));
    expect(v).toBe(`g4d-verify=${'ab'.repeat(16)}`);
    expect(generateTxtValue((n) => 'f'.repeat(n)).length).toBeGreaterThanOrEqual(30);
  });
  it('the challenge name is <prefix>.<hostname>', () => { expect(challengeName('_g4d-verify', 'shop.in')).toBe('_g4d-verify.shop.in'); });
  const dns = (answers: string[][] | Error): DnsResolver => ({ resolveTxt: async () => { if (answers instanceof Error) throw answers; return answers; } });
  it('MATCHED when the value is among the records (long records arrive in chunks)', async () => {
    expect(await checkTxt(dns([['v=spf1 -all'], ['g4d-verify=', 'abc']]), '_g4d-verify.shop.in', 'g4d-verify=abc')).toBe('MATCHED');
  });
  it('MISMATCH when there are g4d records but not this value; NOT_FOUND when there are none', async () => {
    expect(await checkTxt(dns([['g4d-verify=zzz']]), 'n', 'g4d-verify=abc')).toBe('MISMATCH');
    expect(await checkTxt(dns([['something else']]), 'n', 'g4d-verify=abc')).toBe('NOT_FOUND');
    expect(await checkTxt(dns([]), 'n', 'g4d-verify=abc')).toBe('NOT_FOUND');
  });
  it('NXDOMAIN-like errors are NOT_FOUND; any other error is ERROR (never a crash)', async () => {
    expect(await checkTxt(dns(Object.assign(new Error('x'), { code: 'ENOTFOUND' })), 'n', 'v')).toBe('NOT_FOUND');
    expect(await checkTxt(dns(Object.assign(new Error('x'), { code: 'ENODATA' })), 'n', 'v')).toBe('NOT_FOUND');
    expect(await checkTxt(dns(Object.assign(new Error('x'), { code: 'ETIMEOUT' })), 'n', 'v')).toBe('ERROR');
  });
  it('the comparison is exact and case-sensitive on the value', async () => { expect(await checkTxt(dns([['G4D-VERIFY=ABC']]), 'n', 'g4d-verify=abc')).not.toBe('MATCHED'); });
});
