import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { decimalToPaise, FetchHttp, HttpRequest, HttpResponse, RegistrarHttp, ResellerClubAdapter, TEST_BASE } from '../src/v3-registrar/resellerclub.adapter';
import { GatedRegistrarPort, RegistrarError, RegistrarPort } from '../src/v3-registrar/registrar.port';

/**
 * Recorded-fixture tests of the ResellerClub adapter. The fixtures are ASSUMED shapes written from the names in the owner brief (the documentation could not be fetched): these tests prove the adapter
 * does what its comments say, NOT that ResellerClub answers that way. No network is touched: the HTTP port is a recording stub, and the one test of the real HTTP class replaces global fetch.
 */
const fixture = (n: string): unknown => JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures/resellerclub', n), 'utf8'));
const KEY = 'SECRETKEY-do-not-leak-7731';
const ENV = { RESELLERCLUB_AUTH_USERID: '777', RESELLERCLUB_API_KEY: KEY };

class Recorded extends RegistrarHttp {
  calls: HttpRequest[] = []; next: HttpResponse[] = [];
  async send(r: HttpRequest): Promise<HttpResponse> { this.calls.push(r); return this.next.shift() ?? { status: 200, body: {} }; }
}
const param = (r: HttpRequest, k: string): string[] => r.params.filter(([n]) => n === k).map(([, v]) => v);
const make = (env: Record<string, string | undefined> = ENV) => { const http = new Recorded(); return { http, a: new ResellerClubAdapter(http, () => env) }; };

describe('paths, methods and parameters (every one TO VERIFY)', () => {
  it('search: GET /domains/available.json with the name, each extension and the keys; statuses are mapped', async () => {
    const { http, a } = make(); http.next.push({ status: 200, body: fixture('available.json') });
    const hits = await a.search('sriganesh', ['com', 'in', 'org']);
    expect(http.calls[0]).toMatchObject({ method: 'GET', path: '/domains/available.json' });
    expect(param(http.calls[0], 'domain-name')).toEqual(['sriganesh']); expect(param(http.calls[0], 'tlds')).toEqual(['com', 'in', 'org']);
    expect(param(http.calls[0], 'auth-userid')).toEqual(['777']); expect(param(http.calls[0], 'api-key')).toEqual([KEY]);
    expect(hits.filter((h) => h.domain.startsWith('sriganesh.'))).toEqual([{ domain: 'sriganesh.com', status: 'AVAILABLE' }, { domain: 'sriganesh.in', status: 'TAKEN' }, { domain: 'sriganesh.org', status: 'UNKNOWN' }]);
  });
  it('costs: GET /products/reseller-cost-price.json, decimals become whole paise; an extension the answer lacks is left out', async () => {
    const { http, a } = make(); http.next.push({ status: 200, body: fixture('cost-price.json') });
    expect(await a.costs(['com', 'in', 'xyz'])).toEqual({ com: { registerPaise: 70_000, renewPaise: 75_050, transferPaise: 80_000 }, in: { registerPaise: 65_000, renewPaise: 70_000 } });
    expect(http.calls[0]).toMatchObject({ method: 'GET', path: '/products/reseller-cost-price.json' });
  });
  it('customer and contact: POST, the id is read from the answer; a non numeric answer is ambiguous', async () => {
    const { http, a } = make(); const d = { name: 'Meena R', company: 'Sri Ganesh', email: 'm@example.in', addressLine1: '1 Main Rd', city: 'Madurai', state: 'Tamil Nadu', country: 'IN', zipcode: '625001', phoneCc: '91', phone: '9876543210' };
    http.next.push({ status: 200, body: 4455 }, { status: 200, body: 6677 }, { status: 200, body: { customerid: 'x' } });
    expect(await a.createCustomer(d)).toBe('4455'); expect(http.calls[0]).toMatchObject({ method: 'POST', path: '/customers/v2/signup.json' });
    expect(param(http.calls[0], 'passwd')[0]).toMatch(/^Aa1!/); expect(param(http.calls[0], 'passwd')[0]).not.toBe(param(http.calls[0], 'username')[0]);
    expect(await a.createContact('4455', d)).toBe('6677'); expect(http.calls[1]).toMatchObject({ method: 'POST', path: '/contacts/add.json' }); expect(param(http.calls[1], 'customer-id')).toEqual(['4455']);
    await expect(a.createContact('4455', d)).rejects.toMatchObject({ code: 'REGISTRAR_BAD_ANSWER', ambiguous: true });
  });
  it('register: POST /domains/register.json with the contact ids, the name servers, NoInvoice and the privacy flags; the order id is read from entityid', async () => {
    const { http, a } = make(); http.next.push({ status: 200, body: fixture('register-ok.json') });
    expect(await a.register({ domain: 'sriganesh.com', years: 1, customerId: '4455', contactId: '6677', nameServers: ['ns1.example.com', 'ns2.example.com'], privacy: true })).toEqual({ orderId: '90210' });
    const c = http.calls[0]; expect(c).toMatchObject({ method: 'POST', path: '/domains/register.json' });
    expect(param(c, 'ns')).toEqual(['ns1.example.com', 'ns2.example.com']); expect(param(c, 'invoice-option')).toEqual(['NoInvoice']); expect(param(c, 'protect-privacy')).toEqual(['true']);
    for (const k of ['reg-contact-id', 'admin-contact-id', 'tech-contact-id', 'billing-contact-id']) expect(param(c, k)).toEqual(['6677']);
  });
  it('renew sends the current expiry in seconds; privacy and name servers are POSTs', async () => {
    const { http, a } = make(); http.next.push({ status: 200, body: { status: 'Success', endtime: '1858536000' } }, { status: 200, body: {} }, { status: 200, body: {} });
    expect(await a.renew('90210', 1, new Date('2027-01-01T00:00:00Z'))).toEqual({ expiresAt: new Date(1858536000 * 1000) });
    expect(param(http.calls[0], 'exp-date')).toEqual(['1798761600']); expect(http.calls[0]).toMatchObject({ method: 'POST', path: '/domains/renew.json' });
    await a.setPrivacy('90210', false); expect(http.calls[1]).toMatchObject({ method: 'POST', path: '/domains/modify-privacy-protection.json' }); expect(param(http.calls[1], 'protect-privacy')).toEqual(['false']);
    await a.setNameServers('90210', ['ns1.example.com', 'ns2.example.com']); expect(http.calls[2]).toMatchObject({ method: 'POST', path: '/domains/modify-ns.json' }); expect(param(http.calls[2], 'ns')).toHaveLength(2);
  });
  it('orderInfo: two GETs; a refusal on the first means the name is not in our account', async () => {
    const { http, a } = make(); http.next.push({ status: 200, body: 90210 }, { status: 200, body: fixture('details-active.json') });
    expect(await a.orderInfo('sriganesh.com')).toEqual({ orderId: '90210', status: 'ACTIVE', expiresAt: new Date(1827000000 * 1000), privacy: true });
    expect(http.calls.map((c) => [c.method, c.path])).toEqual([['GET', '/domains/orderid.json'], ['GET', '/domains/details.json']]);
    http.next.push({ status: 200, body: fixture('error-not-available.json') });   // any refusal on the lookup
    expect(await a.orderInfo('nothere.com')).toMatchObject({ status: 'NOT_FOUND', orderId: null });
  });
  it('balance: GET /billing/reseller-balance.json as whole paise', async () => {
    const { http, a } = make(); http.next.push({ status: 200, body: fixture('balance.json') });
    expect(await a.balance()).toBe(1_523_475); expect(http.calls[0]).toMatchObject({ method: 'GET', path: '/billing/reseller-balance.json' });
  });
  it('decimals to paise without floating point', () => {
    expect(decimalToPaise('700.00')).toBe(70_000); expect(decimalToPaise('12.5')).toBe(1_250); expect(decimalToPaise('650')).toBe(65_000); expect(decimalToPaise('1.239')).toBe(123); expect(decimalToPaise('abc')).toBeNull(); expect(decimalToPaise('-1')).toBeNull(); expect(decimalToPaise(undefined)).toBeNull();
  });
});

describe('errors: definite, ambiguous, retryable', () => {
  it('a refusal in the body is a definite failure with a code; insufficient reseller funds is its own code', async () => {
    const { http, a } = make(); const reg = { domain: 'sriganesh.com', years: 1, customerId: '1', contactId: '2', nameServers: ['a.example.com', 'b.example.com'], privacy: false };
    http.next.push({ status: 200, body: fixture('error-insufficient.json') }, { status: 200, body: fixture('error-not-available.json') });
    await expect(a.register(reg)).rejects.toMatchObject({ code: 'REGISTRAR_BALANCE_LOW', ambiguous: false, retryable: false });
    await expect(a.register(reg)).rejects.toMatchObject({ code: 'DOMAIN_NOT_AVAILABLE', ambiguous: false });
  });
  it('a server fault on a write is AMBIGUOUS (it may have happened); on a read it is retryable', async () => {
    const { http, a } = make(); http.next.push({ status: 503, body: null }, { status: 502, body: null });
    await expect(a.register({ domain: 'a.com', years: 1, customerId: '1', contactId: '2', nameServers: ['a.example.com', 'b.example.com'], privacy: false })).rejects.toMatchObject({ code: 'REGISTRAR_SERVER_ERROR', ambiguous: true, retryable: false });
    await expect(a.balance()).rejects.toMatchObject({ ambiguous: false, retryable: true });
  });
  it('a wrong key or a server address that is not whitelisted is its own definite code', async () => {
    const { http, a } = make(); http.next.push({ status: 403, body: null });
    await expect(a.balance()).rejects.toMatchObject({ code: 'REGISTRAR_NOT_AUTHORISED', retryable: false, ambiguous: false });
  });
  it('missing keys: no request is sent at all', async () => {
    const { http, a } = make({}); await expect(a.search('a', ['com'])).rejects.toMatchObject({ code: 'REGISTRAR_KEYS_MISSING' });
    expect(http.calls).toHaveLength(0);
  });
  it('the key never appears in an error, an error message or a log line', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined); const err = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { http, a } = make(); http.next.push({ status: 200, body: fixture('error-insufficient.json') }, { status: 403, body: null }, { status: 503, body: null });
    const seen: string[] = [];
    for (const f of [() => a.balance(), () => a.balance(), () => a.balance()]) { try { await f(); } catch (e) { seen.push(JSON.stringify(e), String((e as Error).message), String((e as Error).stack ?? '')); } }
    const logged = JSON.stringify([...warn.mock.calls, ...err.mock.calls]);
    expect([...seen, logged].join(' ')).not.toContain(KEY); expect([...seen, logged].join(' ')).not.toContain('777');
    warn.mockRestore(); err.mockRestore();
  });
});

describe('the real HTTP class (global fetch is replaced: no network)', () => {
  const real = global.fetch;
  afterEach(() => { global.fetch = real; });
  it('defaults to the TEST base; a GET carries its parameters in the query, a POST in a form body; the base is a setting', async () => {
    const fetchMock = jest.fn(async () => ({ status: 200, json: async () => ({ ok: 1 }) })); global.fetch = fetchMock as never;
    const h = new FetchHttp(() => ({}));
    await h.send({ method: 'GET', path: '/x.json', params: [['a', '1']] }); await h.send({ method: 'POST', path: '/y.json', params: [['b', '2']] });
    const [g, p] = fetchMock.mock.calls as unknown as Array<[string, { method: string; body?: string }]>;
    expect(g[0]).toBe(`${TEST_BASE}/x.json?a=1`); expect(p[0]).toBe(`${TEST_BASE}/y.json`); expect(p[1]).toMatchObject({ method: 'POST', body: 'b=2' });
    await new FetchHttp(() => ({ RESELLERCLUB_API_BASE: 'https://example.invalid/api/' })).send({ method: 'GET', path: '/z.json', params: [] });
    expect((fetchMock.mock.calls[2] as unknown as [string])[0]).toBe('https://example.invalid/api/z.json?');
  });
  it('a dropped connection on a write is ambiguous; on a read it is retryable', async () => {
    global.fetch = (async () => { throw new Error('socket hang up'); }) as never;
    const h = new FetchHttp(() => ({}));
    await expect(h.send({ method: 'POST', path: '/y.json', params: [] })).rejects.toMatchObject({ ambiguous: true });
    await expect(h.send({ method: 'GET', path: '/x.json', params: [] })).rejects.toMatchObject({ retryable: true, ambiguous: false });
  });
});

describe('the live flags gate every call (both OFF by default)', () => {
  class Spy extends RegistrarPort {
    calls: string[] = [];
    async search() { this.calls.push('search'); return []; } async costs() { this.calls.push('costs'); return {}; } async createCustomer() { this.calls.push('createCustomer'); return '1'; } async createContact() { this.calls.push('createContact'); return '2'; }
    async register() { this.calls.push('register'); return { orderId: '3' }; } async renew() { this.calls.push('renew'); return { expiresAt: null }; } async setPrivacy() { this.calls.push('setPrivacy'); } async setNameServers() { this.calls.push('setNameServers'); }
    async orderInfo() { this.calls.push('orderInfo'); return { orderId: null, status: 'NOT_FOUND' as const, expiresAt: null, privacy: null }; } async balance() { this.calls.push('balance'); return 1; }
    async transferEligibility() { this.calls.push('transferEligibility'); return { eligible: true, reason: 'OK' as const }; } async transferIn() { this.calls.push('transferIn'); return { orderId: '4' }; }
    async transferStatus() { this.calls.push('transferStatus'); return { status: 'PENDING' as const, orderId: null, expiresAt: null, reason: null }; }
  }
  const all = (g: GatedRegistrarPort): Array<[string, () => Promise<unknown>]> => [
    ['search', () => g.search('a', ['com'])], ['costs', () => g.costs(['com'])], ['createCustomer', () => g.createCustomer({} as never)], ['createContact', () => g.createContact('1', {} as never)], ['register', () => g.register({} as never)],
    ['renew', () => g.renew('1', 1, new Date())], ['setPrivacy', () => g.setPrivacy('1', true)], ['setNameServers', () => g.setNameServers('1', [])], ['orderInfo', () => g.orderInfo('a.com')], ['balance', () => g.balance()],
    ['transferEligibility', () => g.transferEligibility('a.com')], ['transferIn', () => g.transferIn({} as never)], ['transferStatus', () => g.transferStatus('a.com', null)],
  ];
  const outcome = async (g: GatedRegistrarPort): Promise<string[]> => { const ok: string[] = []; for (const [n, f] of all(g)) { try { await f(); ok.push(n); } catch (e) { expect(e).toBeInstanceOf(RegistrarError); expect((e as RegistrarError).code).toBe('REGISTRAR_LIVE_DISABLED'); } } return ok; };
  it('both off: nothing reaches the adapter', async () => { const s = new Spy(); expect(await outcome(new GatedRegistrarPort(s, () => ({})))).toEqual([]); expect(s.calls).toEqual([]); });
  it('search on, purchase off: only the reads pass', async () => { const s = new Spy(); expect(await outcome(new GatedRegistrarPort(s, () => ({ REGISTRAR_LIVE_SEARCH: 'true' })))).toEqual(['search', 'costs', 'orderInfo', 'balance', 'transferEligibility', 'transferStatus']); });
  it('purchase on, search off: the writes pass and the lookups that settle a purchase, but not the public search or the price list', async () => { const s = new Spy(); expect(await outcome(new GatedRegistrarPort(s, () => ({ REGISTRAR_LIVE_PURCHASE: 'true' })))).toEqual(['createCustomer', 'createContact', 'register', 'renew', 'setPrivacy', 'setNameServers', 'orderInfo', 'balance', 'transferEligibility', 'transferIn', 'transferStatus']); });
  it('the flags are read on every call', async () => { const env: Record<string, string | undefined> = {}; const g = new GatedRegistrarPort(new Spy(), () => env); await expect(g.balance()).rejects.toBeInstanceOf(RegistrarError); env.REGISTRAR_LIVE_SEARCH = 'true'; await expect(g.balance()).resolves.toBe(1); });
});
