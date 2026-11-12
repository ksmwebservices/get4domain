import { Logger } from '@nestjs/common';
import { HttpRequest, HttpResponse, RegistrarHttp, ResellerClubAdapter } from '../src/v3-registrar/resellerclub.adapter';

/**
 * Recorded-fixture tests of the TRANSFER paths of the ResellerClub adapter (slice 5.6e). Every path, parameter and answer shape is ASSUMED and marked TO VERIFY in the adapter; these tests prove the code
 * does what its comments say, NOT that ResellerClub answers that way. No network: the HTTP port is a recording stub.
 */
const KEY = 'SECRETKEY-do-not-leak-4412'; const CODE = 'Auth-Code-7Zq!';
class Recorded extends RegistrarHttp { calls: HttpRequest[] = []; next: HttpResponse[] = []; async send(r: HttpRequest): Promise<HttpResponse> { this.calls.push(r); return this.next.shift() ?? { status: 200, body: {} }; } }
const make = () => { const http = new Recorded(); return { http, a: new ResellerClubAdapter(http, () => ({ RESELLERCLUB_AUTH_USERID: '777', RESELLERCLUB_API_KEY: KEY })) }; };
const param = (r: HttpRequest, k: string): string[] => r.params.filter(([n]) => n === k).map(([, v]) => v);
const refusal = (message: string): HttpResponse => ({ status: 200, body: { status: 'ERROR', message } });

describe('eligibility (TO VERIFY: GET /domains/validate-transfer.json)', () => {
  it('a true result is eligible', async () => {
    const { http, a } = make(); http.next.push({ status: 200, body: { result: 'true' } });
    expect(await a.transferEligibility('oldshop.com')).toEqual({ eligible: true, reason: 'OK' });
    expect(http.calls[0]).toMatchObject({ method: 'GET', path: '/domains/validate-transfer.json' }); expect(param(http.calls[0], 'domain-name')).toEqual(['oldshop.com']);
  });
  it('a refusal is classified into a safe reason from its words; one we cannot classify is UNKNOWN and still not eligible', async () => {
    const cases: Array<[string, string]> = [['The domain is locked at the current registrar', 'LOCKED'], ['Domain was registered 20 days ago: the 60 day rule applies', 'RECENTLY_REGISTERED'], ['Domain was recently transferred', 'RECENTLY_TRANSFERRED'], ['Domain is not registered', 'NOT_REGISTERED'], ['Something odd happened', 'UNKNOWN']];
    for (const [message, reason] of cases) { const { http, a } = make(); http.next.push(refusal(message)); expect([message, await a.transferEligibility('oldshop.com')]).toEqual([message, { eligible: false, reason }]); }
  });
  it('a server fault is an error, never an answer of "not eligible"', async () => {
    const { http, a } = make(); http.next.push({ status: 503, body: null });
    await expect(a.transferEligibility('oldshop.com')).rejects.toMatchObject({ code: 'REGISTRAR_SERVER_ERROR', retryable: true });
  });
});

describe('starting a transfer (TO VERIFY: POST /domains/transfer.json)', () => {
  it('sends the code once in the form body with the contacts, NoInvoice, privacy flags and name servers; the order id is read from entityid', async () => {
    const { http, a } = make(); http.next.push({ status: 200, body: { entityid: '90555', status: 'Success' } });
    expect(await a.transferIn({ domain: 'oldshop.com', authCode: CODE, customerId: '4455', contactId: '6677', nameServers: ['ns1.example.com', 'ns2.example.com'], privacy: true })).toEqual({ orderId: '90555' });
    const c = http.calls[0]; expect(c).toMatchObject({ method: 'POST', path: '/domains/transfer.json' });
    expect(param(c, 'auth-code')).toEqual([CODE]); expect(param(c, 'invoice-option')).toEqual(['NoInvoice']); expect(param(c, 'protect-privacy')).toEqual(['true']); expect(param(c, 'ns')).toHaveLength(2);
    for (const k of ['reg-contact-id', 'admin-contact-id', 'tech-contact-id', 'billing-contact-id']) expect(param(c, k)).toEqual(['6677']);
  });
  it('an unreadable answer to a sent transfer is ambiguous; a server fault on it is ambiguous; a refusal is definite', async () => {
    const r = { domain: 'oldshop.com', authCode: CODE, customerId: '1', contactId: '2', nameServers: ['a.example.com', 'b.example.com'], privacy: false };
    const { http, a } = make(); http.next.push({ status: 200, body: { status: 'Success' } }, { status: 502, body: null }, refusal('Invalid authorization code'));
    await expect(a.transferIn(r)).rejects.toMatchObject({ code: 'REGISTRAR_BAD_ANSWER', ambiguous: true });
    await expect(a.transferIn(r)).rejects.toMatchObject({ code: 'REGISTRAR_SERVER_ERROR', ambiguous: true });
    await expect(a.transferIn(r)).rejects.toMatchObject({ code: 'REGISTRAR_REFUSED', ambiguous: false });
  });
  it('the authorisation code never appears in an error, a message or a log line', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined); const err = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { http, a } = make(); http.next.push(refusal(`Invalid authorization code ${CODE}`), { status: 403, body: null }, { status: 503, body: null });
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) { try { await a.transferIn({ domain: 'oldshop.com', authCode: CODE, customerId: '1', contactId: '2', nameServers: ['a.example.com', 'b.example.com'], privacy: false }); } catch (e) { seen.push(JSON.stringify(e), String((e as Error).message), String((e as Error).stack ?? '')); } }
    const all = [...seen, JSON.stringify([...warn.mock.calls, ...err.mock.calls])].join(' ');
    expect(all).not.toContain(CODE); expect(all).not.toContain(KEY); warn.mockRestore(); err.mockRestore();
  });
});

describe('progress (TO VERIFY: GET /domains/orderid.json then GET /domains/details.json)', () => {
  it('maps the registrar status to completed, under way and ended', async () => {
    const cases: Array<[string, string]> = [['Active', 'COMPLETED'], ['InActive', 'PENDING'], ['Pending', 'PENDING'], ['InProcess', 'PENDING'], ['Cancelled', 'CANCELLED'], ['Rejected', 'FAILED'], ['Failed', 'FAILED']];
    for (const [cs, status] of cases) { const { http, a } = make(); http.next.push({ status: 200, body: { currentstatus: cs, endtime: '1858536000' } }); const t = await a.transferStatus('oldshop.com', '90555'); expect([cs, t.status]).toEqual([cs, status]); expect(t.expiresAt).toEqual(new Date(1858536000 * 1000)); expect(http.calls).toHaveLength(1); }
  });
  it('without an order id the name is looked up first; a name that is not there is NOT_FOUND', async () => {
    const { http, a } = make(); http.next.push({ status: 200, body: 90555 }, { status: 200, body: { currentstatus: 'Pending' } });
    expect(await a.transferStatus('oldshop.com', null)).toMatchObject({ status: 'PENDING', orderId: '90555' }); expect(http.calls.map((c) => c.path)).toEqual(['/domains/orderid.json', '/domains/details.json']);
    http.next.push(refusal('Domain is not registered')); expect(await a.transferStatus('nothere.com', null)).toMatchObject({ status: 'NOT_FOUND', orderId: null });
  });
});
