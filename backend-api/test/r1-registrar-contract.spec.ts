import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CUSTOM_MESSAGES } from '../src/v3-registrar/core/public-availability-core';
import { failureOf, PublicDomainAvailabilityService, REGISTRAR_CALLS_PER_MINUTE } from '../src/v3-registrar/public-availability.service';
import { GatedRegistrarPort, RegistrarError, RegistrarPort } from '../src/v3-registrar/registrar.port';
import { RegistrarStore } from '../src/v3-registrar/registrar.store';
import { FetchHttp, HttpRequest, HttpResponse, LIVE_BASE, RegistrarHttp, ResellerClubAdapter, RcCredentials, TEST_BASE } from '../src/v3-registrar/resellerclub.adapter';

/**
 * R1.4 contract tests for the registrar's honest states, with FAKE responses. The shapes are the ones the adapter assumes (marked TO VERIFY in the adapter): these tests prove the adapter and the public route
 * do what their comments say, NOT that ResellerClub answers this way. No test here touches the network: the HTTP port is a recording stub, and the one test of the real HTTP class replaces global fetch.
 */
const fixture = (n: string): unknown => JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures/resellerclub', n), 'utf8'));
const KEY = 'SECRETKEY-r1-do-not-leak-5521';
const SAVED: RcCredentials = { userId: '888', apiKey: KEY, mode: 'demo' };

type Step = HttpResponse | RegistrarError;
class Scripted extends RegistrarHttp {
  calls: HttpRequest[] = []; steps: Step[] = [];
  async send(r: HttpRequest): Promise<HttpResponse> { this.calls.push(r); const s = this.steps.shift() ?? { status: 200, body: {} }; if (s instanceof RegistrarError) throw s; return s; }
}
const build = (o: { saved?: RcCredentials | null; env?: Record<string, string | undefined> } = {}) => {
  const http = new Scripted();
  const a = new ResellerClubAdapter(http, () => o.env ?? {}, o.saved === null ? undefined : async () => o.saved ?? SAVED);
  a.sleep = async () => undefined;
  return { http, a };
};
const param = (r: HttpRequest, k: string): string[] => r.params.filter(([n]) => n === k).map(([, v]) => v);
const code = async (p: Promise<unknown>): Promise<RegistrarError> => { try { await p; } catch (e) { return e as RegistrarError; } throw new Error('expected a refusal'); };

describe('R1.2 keys and mode: the saved settings first, then the environment', () => {
  it('demo mode calls the test base and live mode the production base, with the saved keys; none of it in a POST url', async () => {
    const demo = build({ saved: { ...SAVED, mode: 'demo' } }); demo.http.steps.push({ status: 200, body: fixture('available.json') });
    await demo.a.search('sriganesh', ['com']);
    expect(demo.http.calls[0].base).toBe(TEST_BASE); expect(TEST_BASE).toBe('https://test.httpapi.com/api'); expect(param(demo.http.calls[0], 'auth-userid')).toEqual(['888']); expect(param(demo.http.calls[0], 'api-key')).toEqual([KEY]);
    const live = build({ saved: { ...SAVED, mode: 'live' } }); live.http.steps.push({ status: 200, body: fixture('available.json') });
    await live.a.search('sriganesh', ['com']);
    expect(live.http.calls[0].base).toBe(LIVE_BASE); expect(LIVE_BASE).toBe('https://httpapi.com/api');
  });
  it('with nothing saved the server environment applies, on its own base; with neither, the call is never sent', async () => {
    const env = build({ saved: null, env: { RESELLERCLUB_AUTH_USERID: '777', RESELLERCLUB_API_KEY: KEY } }); env.http.steps.push({ status: 200, body: fixture('available.json') });
    await env.a.search('a', ['com']); expect(param(env.http.calls[0], 'auth-userid')).toEqual(['777']); expect(env.http.calls[0].base).toBeUndefined();
    const none = build({ saved: null, env: {} });
    expect((await code(none.a.search('a', ['com']))).code).toBe('REGISTRAR_KEYS_MISSING'); expect(none.http.calls).toHaveLength(0);
    const emptyStore = new ResellerClubAdapter(new Scripted(), () => ({}), async () => null);   // a settings store with nothing saved
    expect((await code(emptyStore.search('a', ['com']))).code).toBe('REGISTRAR_KEYS_MISSING');
  });
  it('the real HTTP class puts the keys in the query of a read only, uses the base it is given, and reports a timeout as its own code', async () => {
    const real = fetch; const seen: Array<{ url: string; method: string }> = [];
    (globalThis as { fetch: unknown }).fetch = async (url: string, init: { method: string }) => { seen.push({ url, method: init.method }); return { status: 200, json: async () => ({}) }; };
    try {
      await new FetchHttp(() => ({}), 50).send({ method: 'GET', path: '/domains/available.json', params: [['api-key', KEY]], base: LIVE_BASE });
      expect(seen[0].url.startsWith('https://httpapi.com/api/domains/available.json?')).toBe(true);
      (globalThis as { fetch: unknown }).fetch = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
      const e = await code(new FetchHttp(() => ({}), 50).send({ method: 'GET', path: '/x', params: [] }));
      expect(e).toMatchObject({ code: 'REGISTRAR_TIMEOUT', retryable: true, ambiguous: false });
      const w = await code(new FetchHttp(() => ({}), 50).send({ method: 'POST', path: '/x', params: [] }));
      expect(w).toMatchObject({ code: 'REGISTRAR_TIMEOUT', retryable: false, ambiguous: true });
      (globalThis as { fetch: unknown }).fetch = async () => { throw new TypeError('fetch failed'); };
      expect((await code(new FetchHttp(() => ({}), 50).send({ method: 'GET', path: '/x', params: [] }))).code).toBe('REGISTRAR_UNREACHABLE');
    } finally { (globalThis as { fetch: unknown }).fetch = real; }
  });
});

describe('R1.2 four distinct honest states from the adapter', () => {
  it('not configured: REGISTRAR_KEYS_MISSING (see above)', async () => { expect((await code(build({ saved: null }).a.search('a', ['com']))).code).toBe('REGISTRAR_KEYS_MISSING'); });
  it('access denied, by body text and by HTTP status, not retried', async () => {
    const byText = build(); byText.http.steps.push({ status: 200, body: fixture('access-denied.json') });
    expect(await code(byText.a.search('a', ['com']))).toMatchObject({ code: 'REGISTRAR_NOT_AUTHORISED', retryable: false, ambiguous: false }); expect(byText.http.calls).toHaveLength(1);
    const byText400 = build(); byText400.http.steps.push({ status: 400, body: fixture('access-denied.json') });
    expect((await code(byText400.a.search('a', ['com']))).code).toBe('REGISTRAR_NOT_AUTHORISED');
    const byStatus = build(); byStatus.http.steps.push({ status: 403, body: null });
    expect((await code(byStatus.a.costs(['com']))).code).toBe('REGISTRAR_NOT_AUTHORISED');
  });
  it('a key the registrar does not accept is its own state (REGISTRAR_BAD_KEYS), not access denied', async () => {
    const bad = build(); bad.http.steps.push({ status: 200, body: fixture('invalid-credentials.json') });
    expect((await code(bad.a.search('a', ['com']))).code).toBe('REGISTRAR_BAD_KEYS');
  });
  it('timeout: a read is tried three times, and succeeds if a later attempt answers; a write is never repeated', async () => {
    const slow = build(); slow.http.steps.push(new RegistrarError('REGISTRAR_TIMEOUT', true), new RegistrarError('REGISTRAR_TIMEOUT', true), new RegistrarError('REGISTRAR_TIMEOUT', true));
    expect(await code(slow.a.search('a', ['com']))).toMatchObject({ code: 'REGISTRAR_TIMEOUT' }); expect(slow.http.calls).toHaveLength(3);
    const recovers = build(); recovers.http.steps.push(new RegistrarError('REGISTRAR_UNREACHABLE', true), { status: 502, body: null }, { status: 200, body: fixture('available.json') });
    expect((await recovers.a.search('sriganesh', ['com'])).length).toBeGreaterThan(0); expect(recovers.http.calls).toHaveLength(3);
    const write = build(); write.http.steps.push(new RegistrarError('REGISTRAR_TIMEOUT', false, true));
    expect(await code(write.a.register({ domain: 'a.com', years: 1, customerId: '1', contactId: '2', nameServers: [], privacy: false }))).toMatchObject({ ambiguous: true }); expect(write.http.calls).toHaveLength(1);
    const server500 = build(); server500.http.steps.push({ status: 500, body: null });
    await code(server500.a.createCustomer({ name: 'a', company: 'b', email: 'e@x.in', addressLine1: 'l', city: 'c', state: 's', country: 'IN', zipcode: '1', phoneCc: '91', phone: '9' })); expect(server500.http.calls).toHaveLength(1);
  });
  it('a refusal that is not about access or keys is not retried and never leaks the registrar words into the error', async () => {
    const b = build(); b.http.steps.push({ status: 200, body: { status: 'ERROR', message: `something private ${KEY}` } });
    const e = await code(b.a.search('a', ['com'])); expect(e.code).toBe('REGISTRAR_REFUSED'); expect(e.message).not.toContain(KEY); expect(b.http.calls).toHaveLength(1);
  });
  it('registrar off: the gate refuses every read before the adapter is reached (no request is built)', async () => {
    const { http, a } = build(); const gated = new GatedRegistrarPort(a, () => ({}));
    for (const c of [() => gated.search('a', ['com']), () => gated.costs(['com']), () => gated.suggest('a', ['com'], 5)]) expect(await code(c())).toMatchObject({ code: 'REGISTRAR_LIVE_DISABLED' });
    expect(http.calls).toHaveLength(0);
    const on = new GatedRegistrarPort(a, () => ({ REGISTRAR_LIVE_SEARCH: 'true' })); http.steps.push({ status: 200, body: fixture('available.json') });
    expect((await on.search('sriganesh', ['com'])).length).toBeGreaterThan(0);
  });
});

describe('R1.2 the three read-only calls (recorded shapes)', () => {
  it('availability: GET /domains/available.json; "available" only for the registrar word available', async () => {
    const { http, a } = build(); http.steps.push({ status: 200, body: fixture('available.json') });
    const hits = await a.search('sriganesh', ['com', 'in', 'org']);
    expect(http.calls[0]).toMatchObject({ method: 'GET', path: '/domains/available.json' });
    expect(hits.filter((h) => h.domain.startsWith('sriganesh.'))).toEqual([{ domain: 'sriganesh.com', status: 'AVAILABLE' }, { domain: 'sriganesh.in', status: 'TAKEN' }, { domain: 'sriganesh.org', status: 'UNKNOWN' }]);
  });
  it('name suggestions: GET /domains/v5/suggest-names.json; only names the registrar marks available, at most the number asked for', async () => {
    const { http, a } = build(); http.steps.push({ status: 200, body: fixture('suggest-names.json') });
    const r = await a.suggest('kumar', ['com', 'in', 'net', 'org'], 3);
    expect(http.calls[0]).toMatchObject({ method: 'GET', path: '/domains/v5/suggest-names.json' });
    expect(param(http.calls[0], 'keyword')).toEqual(['kumar']); expect(param(http.calls[0], 'tld-only')).toEqual(['com', 'in', 'net', 'org']); expect(param(http.calls[0], 'no-of-results')).toEqual(['3']);
    expect(r).toEqual([{ domain: 'kumar-plumbing.com' }, { domain: 'kumarplumbing.in' }, { domain: 'mykumar.org' }]);
    const none = build(); none.http.steps.push({ status: 200, body: {} }); expect(await none.a.suggest('x', ['com'], 5)).toEqual([]);
    const cap = build(); cap.http.steps.push({ status: 200, body: fixture('suggest-names.json') }); await cap.a.suggest('kumar', ['com'], 500); expect(param(cap.http.calls[0], 'no-of-results')).toEqual(['20']);
  });
  it('TLD price list: GET /products/reseller-cost-price.json; decimals become whole paise', async () => {
    const { http, a } = build(); http.steps.push({ status: 200, body: fixture('cost-price.json') });
    expect(await a.costs(['com', 'in'])).toEqual({ com: { registerPaise: 70_000, renewPaise: 75_050, transferPaise: 80_000 }, in: { registerPaise: 65_000, renewPaise: 70_000 } });
    expect(http.calls[0]).toMatchObject({ method: 'GET', path: '/products/reseller-cost-price.json' });
  });
  it('a port that cannot suggest says so (the default)', async () => {
    const { RegistrarPort: P } = await import('../src/v3-registrar/registrar.port');
    expect(typeof P.prototype.suggest).toBe('function');
    await expect(Object.create(P.prototype).suggest('a', ['com'], 1)).rejects.toMatchObject({ code: 'REGISTRAR_NOT_SUPPORTED' });
  });
});

/** A registrar that answers as scripted, and counts the calls. */
class Port extends RegistrarPort {
  searches = 0; suggests = 0; searchFn: () => Promise<Array<{ domain: string; status: 'AVAILABLE' | 'TAKEN' | 'UNKNOWN' }>> = async () => [{ domain: 'x.com', status: 'AVAILABLE' }]; suggestFn: () => Promise<Array<{ domain: string }>> = async () => [];
  async search() { this.searches += 1; return this.searchFn(); }
  async suggest() { this.suggests += 1; return this.suggestFn(); }
  costs(): never { throw new Error('unused'); } createCustomer(): never { throw new Error('unused'); } createContact(): never { throw new Error('unused'); } register(): never { throw new Error('unused'); } renew(): never { throw new Error('unused'); }
  setPrivacy(): never { throw new Error('unused'); } setNameServers(): never { throw new Error('unused'); } orderInfo(): never { throw new Error('unused'); } balance(): never { throw new Error('unused'); }
  transferEligibility(): never { throw new Error('unused'); } transferIn(): never { throw new Error('unused'); } transferStatus(): never { throw new Error('unused'); }
}
function route(flag = true) {
  const rows = ['com', 'in'].map((tld) => ({ id: `m-${tld}`, tld, kind: 'FIXED_PAISE', value: 10_000, status: 'APPROVED', effectiveFrom: new Date('2026-01-01T00:00:00Z'), note: null }));
  const port = new Port();
  const svc = new PublicDomainAvailabilityService({ margins: async () => rows } as unknown as RegistrarStore, port, { check: async () => ({ available: true, name: 'n', reason: 'AVAILABLE' as const, message: 'free' }) });
  let t = Date.parse('2026-11-19T10:00:00Z'); svc.clock = () => new Date(t); svc.env = () => (flag ? { REGISTRAR_LIVE_SEARCH: 'true' } : {});
  return { svc, port, tick: (ms: number) => { t += ms; } };
}

describe('R1.2 the public route: distinct honest states, never "available" unless the registrar said so', () => {
  const failWith = (c: string) => async () => { throw new RegistrarError(c, false); };
  it.each([
    ['REGISTRAR_KEYS_MISSING', 'NOT_CONFIGURED'], ['REGISTRAR_NOT_AUTHORISED', 'ACCESS_DENIED'], ['REGISTRAR_BAD_KEYS', 'ACCESS_DENIED'], ['REGISTRAR_TIMEOUT', 'TIMEOUT'], ['REGISTRAR_UNREACHABLE', 'UNKNOWN'], ['REGISTRAR_SERVER_ERROR', 'UNKNOWN'],
  ])('registrar failure %s is the public state %s, with no results and never AVAILABLE', async (c, state) => {
    const { svc, port } = route(); port.searchFn = failWith(c);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((() => undefined) as never);
    const r = await svc.check('kumar-plumbing'); jest.restoreAllMocks();
    expect(r.customDomain).toMatchObject({ state, registrar: 'ON', results: [], suggestions: [] });
  });
  it('registrar off: REGISTRAR_OFF and the registrar is never asked', async () => {
    const { svc, port } = route(false); const r = await svc.check('kumar-plumbing');
    expect(r.customDomain.state).toBe('REGISTRAR_OFF'); expect(port.searches).toBe(0);
  });
  it('the public sentence never says why the registrar refused: no whitelist, no address, no key', () => {
    for (const s of ['NOT_CONFIGURED', 'ACCESS_DENIED', 'TIMEOUT'] as const) expect(CUSTOM_MESSAGES[s]).not.toMatch(/whitelist|ip|address|key|denied|reseller/i);
    expect(CUSTOM_MESSAGES.ACCESS_DENIED).toBe(CUSTOM_MESSAGES.NOT_CONFIGURED);   // distinct states, one calm sentence
  });
  it('AVAILABLE only when the registrar says AVAILABLE; TAKEN with suggestions the registrar marked available', async () => {
    const a = route(); a.port.searchFn = async () => [{ domain: 'kumar-plumbing.com', status: 'AVAILABLE' }];
    expect((await a.svc.check('kumar-plumbing')).customDomain).toMatchObject({ state: 'AVAILABLE', suggestions: [] }); expect(a.port.suggests).toBe(0);
    const t = route(); t.port.searchFn = async () => [{ domain: 'kumar-plumbing.com', status: 'TAKEN' }, { domain: 'kumar-plumbing.in', status: 'TAKEN' }];
    t.port.suggestFn = async () => [{ domain: 'kumar-plumbing-works.com' }, { domain: 'kumarplumbing.in' }];
    expect((await t.svc.check('kumar-plumbing')).customDomain).toMatchObject({ state: 'TAKEN', suggestions: ['kumar-plumbing-works.com', 'kumarplumbing.in'] });
    const u = route(); u.port.searchFn = async () => [{ domain: 'kumar-plumbing.com', status: 'UNKNOWN' }];
    expect((await u.svc.check('kumar-plumbing')).customDomain.state).toBe('UNKNOWN');
  });
  it('a failing suggestion never changes the answer; the answer is kept a minute (one call, not two)', async () => {
    const t = route(); t.port.searchFn = async () => [{ domain: 'a.com', status: 'TAKEN' }]; t.port.suggestFn = async () => { throw new RegistrarError('REGISTRAR_TIMEOUT', true); };
    expect((await t.svc.check('abc')).customDomain).toMatchObject({ state: 'TAKEN', suggestions: [] });
    await t.svc.check('abc'); expect(t.port.searches).toBe(1);
    t.tick(61_000); await t.svc.check('abc'); expect(t.port.searches).toBe(2);
  });
  it('throttle: beyond the per-minute cap an uncached name answers UNKNOWN without calling the registrar, and the cap resets', async () => {
    const t = route(); t.port.searchFn = async () => [{ domain: 'x.com', status: 'AVAILABLE' }];
    for (let i = 0; i < REGISTRAR_CALLS_PER_MINUTE; i++) await t.svc.check(`name${i}`);
    expect(t.port.searches).toBe(REGISTRAR_CALLS_PER_MINUTE);
    const over = await t.svc.check('onemore'); expect(over.customDomain).toMatchObject({ state: 'UNKNOWN', results: [] }); expect(t.port.searches).toBe(REGISTRAR_CALLS_PER_MINUTE);
    expect((await t.svc.check('name0')).customDomain.state).toBe('AVAILABLE');   // a cached name still answers
    t.tick(61_000); await t.svc.check('onemore'); expect(t.port.searches).toBe(REGISTRAR_CALLS_PER_MINUTE + 1);
  });
  it('failureOf maps the codes; an error that is not a registrar error is the generic one', () => {
    expect(failureOf(new RegistrarError('REGISTRAR_KEYS_MISSING', false))).toBe('NOT_CONFIGURED'); expect(failureOf(new Error('x'))).toBe('UNREACHABLE');
  });
});

describe('R1.2 no key in any log line or error', () => {
  it('a full run of failures logs the codes only and carries no key', async () => {
    const lines: string[] = [];
    const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((m) => jest.spyOn(Logger.prototype, m).mockImplementation(((...x: unknown[]) => { lines.push(x.map(String).join(' ')); }) as never));
    const out: string[] = [];
    try {
      for (const body of [fixture('access-denied.json'), fixture('invalid-credentials.json'), { status: 'ERROR', message: `echo ${KEY}` }]) { const b = build(); b.http.steps.push({ status: 200, body }); const e = await code(b.a.search('a', ['com'])); out.push(e.message, e.code, String(e.hint)); }
      const r = route(); r.port.searchFn = async () => { throw new RegistrarError('REGISTRAR_NOT_AUTHORISED', false); }; out.push(JSON.stringify(await r.svc.check('kumar')));
    } finally { spies.forEach((s) => s.mockRestore()); }
    expect(JSON.stringify([out, lines])).not.toContain(KEY);
    expect(lines.some((l) => l.includes('REGISTRAR_NOT_AUTHORISED'))).toBe(true);
  });
});
