import { Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Env } from './core/registrar-core';
import { CostRow, OrderInfo, RegisterRequest, RegistrantDetails, RegistrarError, RegistrarPort, SearchHit, TransferEligibility, TransferReason, TransferRequest, TransferState } from './registrar.port';

/**
 * The ResellerClub adapter behind RegistrarPort (slice 5.6d, owner override 2).
 *
 * NOTHING HERE HAS BEEN VERIFIED AGAINST ResellerClub. The documentation pages (manage.resellerclub.com/kb, developer.resellerclub.com, httpapi.com) answered HTTP 403 to the build session's fetch
 * tool, so every path, every parameter name and every response shape below is written from the names the owner's brief gives and is marked `TO VERIFY`. Each is covered by recorded-fixture tests that
 * prove the code does what the comment says, NOT that ResellerClub answers that way. The owner checks each against the live documentation before the first demo-environment test.
 *
 * Facts the owner confirmed from ResellerClub's help pages: authentication is `auth-userid` plus `api-key`; the production base is https://httpapi.com/ and the test base is https://test.httpapi.com/
 * (demo credentials only); only whitelisted IP addresses work; a wrong method returns an error (GET to read, POST to change).
 *
 * Rules kept here: the keys come from the server environment only (RESELLERCLUB_AUTH_USERID, RESELLERCLUB_API_KEY), are read at call time, and are never logged, returned or put in an error. A write that
 * times out or fails on the server side is AMBIGUOUS (it may have happened); the caller then waits for reconciliation. The base URL is a setting (RESELLERCLUB_API_BASE) and DEFAULTS TO THE TEST BASE.
 */

export interface HttpRequest { method: 'GET' | 'POST'; path: string; params: ReadonlyArray<readonly [string, string]> }
export interface HttpResponse { status: number; body: unknown }
/** The one place that touches the network. Tests give a recorded one; production gives FetchHttp below. */
export abstract class RegistrarHttp { abstract send(r: HttpRequest): Promise<HttpResponse> }

export const TEST_BASE = 'https://test.httpapi.com/api';

/** Real HTTP. A GET sends its parameters in the query string; a POST sends them as a form body, so a key never sits in a logged URL for a write. Never logs a URL, a parameter or a body. */
/** Built by a factory in the module (it has plain constructor arguments, which Nest cannot inject). */
export class FetchHttp extends RegistrarHttp {
  constructor(private readonly env: () => Env = () => process.env, private readonly timeoutMs: number = 20_000) { super(); }
  async send(r: HttpRequest): Promise<HttpResponse> {
    const base = (this.env().RESELLERCLUB_API_BASE || TEST_BASE).replace(/\/+$/, '');
    const qs = new URLSearchParams(); for (const [k, v] of r.params) qs.append(k, v);
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const res = await fetch(r.method === 'GET' ? `${base}${r.path}?${qs.toString()}` : `${base}${r.path}`, {
        method: r.method, signal: ctl.signal,
        ...(r.method === 'POST' ? { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: qs.toString() } : {}),
      });
      let body: unknown = null; try { body = await res.json(); } catch { body = null; }
      return { status: res.status, body };
    } catch { throw new RegistrarError('REGISTRAR_UNREACHABLE', r.method === 'GET', r.method === 'POST'); }   // a timeout or a dropped connection: for a write, it may have happened
    finally { clearTimeout(timer); }
  }
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
/** "123.45" to 12345 without floating point. Anything else is refused. */
export function decimalToPaise(v: unknown): number | null {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?\d*$/.exec(String(v ?? '').trim());
  return m ? Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0')) : null;
}
/** A safe classification of a refusal from its words (ASSUMED wording, TO VERIFY): used only to explain a transfer that cannot start. */
const hintOf = (msg: string): TransferReason | null => (/lock/.test(msg) ? 'LOCKED' : /60|sixty|recently registered|just registered/.test(msg) ? 'RECENTLY_REGISTERED' : /recently transferred|transferred recently/.test(msg) ? 'RECENTLY_TRANSFERRED' : /not registered|does not exist|not found/.test(msg) ? 'NOT_REGISTERED' : null);
const epoch = (v: unknown): Date | null => { const n = Number(v); return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : null; };

/** Built by a factory in the module together with its HTTP port. */
export class ResellerClubAdapter extends RegistrarPort {
  private readonly logger = new Logger(ResellerClubAdapter.name);
  constructor(private readonly http: RegistrarHttp, private readonly env: () => Env = () => process.env) { super(); }

  private auth(): Array<readonly [string, string]> {
    const e = this.env();
    if (!e.RESELLERCLUB_AUTH_USERID || !e.RESELLERCLUB_API_KEY) throw new RegistrarError('REGISTRAR_KEYS_MISSING', false);
    return [['auth-userid', e.RESELLERCLUB_AUTH_USERID], ['api-key', e.RESELLERCLUB_API_KEY]];
  }

  /** One call. A refusal in the body (status ERROR) is a definite failure; a server fault on a write is ambiguous. The body's message is read only to pick a code and is never copied into an error. */
  private async call(method: 'GET' | 'POST', path: string, params: Array<readonly [string, string]>): Promise<unknown> {
    const res = await this.http.send({ method, path, params: [...this.auth(), ...params] });
    const b = rec(res.body);
    if (res.status >= 500) throw new RegistrarError('REGISTRAR_SERVER_ERROR', method === 'GET', method === 'POST');
    if (res.status === 401 || res.status === 403) throw new RegistrarError('REGISTRAR_NOT_AUTHORISED', false);   // a wrong key, or this server's address is not whitelisted
    if (res.status >= 400 || String(b.status ?? '').toLowerCase() === 'error') {
      const msg = String(b.message ?? '').toLowerCase();
      this.logger.warn(`registrar refused ${method} ${path}: status ${res.status}`);
      throw new RegistrarError(msg.includes('insufficient') || msg.includes('balance') ? 'REGISTRAR_BALANCE_LOW' : msg.includes('not available') || msg.includes('already') ? 'DOMAIN_NOT_AVAILABLE' : 'REGISTRAR_REFUSED', false, false, hintOf(msg));
    }
    return res.body;
  }

  /** TO VERIFY: GET /domains/available.json with `domain-name` (the name without its extension) and one `tlds` per extension; the answer maps "name.tld" to { status: available | regthroughus | regthroughothers | unknown }. */
  async search(sld: string, tlds: readonly string[]): Promise<SearchHit[]> {
    const body = rec(await this.call('GET', '/domains/available.json', [['domain-name', sld], ...tlds.map((t) => ['tlds', t] as const)]));
    return Object.entries(body).map(([domain, info]) => {
      const s = String(rec(info).status ?? 'unknown').toLowerCase();
      return { domain, status: s === 'available' ? 'AVAILABLE' : s === 'regthroughus' || s === 'regthroughothers' ? 'TAKEN' : 'UNKNOWN' } as SearchHit;
    });
  }

  /**
   * TO VERIFY: GET /products/reseller-cost-price.json. ASSUMED shape (not read from ResellerClub): an object keyed by a product key per extension, each holding `addnewdomain` and `renewdomain`
   * maps from a number of years to a decimal price in the reseller's selling currency, for example { "dotcom": { "addnewdomain": { "1": "700.00" }, "renewdomain": { "1": "750.00" } } }.
   * The product key per extension (`PRODUCT_KEYS`) is also assumed. An extension the answer does not carry is left out, and the caller then cannot quote it.
   */
  async costs(tlds: readonly string[]): Promise<Record<string, CostRow>> {
    const body = rec(await this.call('GET', '/products/reseller-cost-price.json', []));
    const out: Record<string, CostRow> = {};
    for (const t of tlds) {
      const p = rec(body[PRODUCT_KEYS[t] ?? `dot${t.replace(/\./g, '')}`]);
      const reg = decimalToPaise(rec(p.addnewdomain)['1']); const ren = decimalToPaise(rec(p.renewdomain)['1']);
      const tr = decimalToPaise(rec(p.addtransferdomain)['1']);   // ASSUMED key for the transfer price (TO VERIFY)
      if (reg !== null && ren !== null) out[t] = { registerPaise: reg, renewPaise: ren, ...(tr !== null ? { transferPaise: tr } : {}) };
    }
    return out;
  }

  /** TO VERIFY: POST /customers/v2/signup.json with username, passwd, name, company, address-line-1, city, state, country, zipcode, phone-cc, phone, lang-pref; the answer is the numeric customer id. The account password is random and never kept. */
  async createCustomer(d: RegistrantDetails): Promise<string> {
    const pass = `Aa1!${randomBytes(6).toString('hex')}`;
    const body = await this.call('POST', '/customers/v2/signup.json', [['username', d.email], ['passwd', pass], ['name', d.name], ['company', d.company], ['address-line-1', d.addressLine1], ['city', d.city], ['state', d.state], ['country', d.country], ['zipcode', d.zipcode], ['phone-cc', d.phoneCc], ['phone', d.phone], ['lang-pref', 'en']]);
    return this.id(body);
  }

  /** TO VERIFY: POST /contacts/add.json with name, company, email, address-line-1, city, state, country, zipcode, phone-cc, phone, customer-id, type; the answer is the numeric contact id. */
  async createContact(customerId: string, d: RegistrantDetails): Promise<string> {
    const body = await this.call('POST', '/contacts/add.json', [['name', d.name], ['company', d.company], ['email', d.email], ['address-line-1', d.addressLine1], ['city', d.city], ['state', d.state], ['country', d.country], ['zipcode', d.zipcode], ['phone-cc', d.phoneCc], ['phone', d.phone], ['customer-id', customerId], ['type', 'Contact']]);
    return this.id(body);
  }

  /**
   * TO VERIFY: POST /domains/register.json with domain-name, years, ns (one per name server), customer-id, reg-contact-id, admin-contact-id, tech-contact-id, billing-contact-id, invoice-option
   * (NoInvoice: the reseller balance is debited, no invoice is raised for the customer), purchase-privacy and protect-privacy; the answer carries `entityid` (the order id) and `status`.
   */
  async register(r: RegisterRequest): Promise<{ orderId: string }> {
    const body = rec(await this.call('POST', '/domains/register.json', [
      ['domain-name', r.domain], ['years', String(r.years)], ...r.nameServers.map((n) => ['ns', n] as const), ['customer-id', r.customerId], ['reg-contact-id', r.contactId], ['admin-contact-id', r.contactId], ['tech-contact-id', r.contactId], ['billing-contact-id', r.contactId],
      ['invoice-option', 'NoInvoice'], ['purchase-privacy', String(r.privacy)], ['protect-privacy', String(r.privacy)],
    ]));
    const orderId = String(body.entityid ?? '').trim();
    if (!/^\d+$/.test(orderId)) throw new RegistrarError('REGISTRAR_BAD_ANSWER', false, true);   // we sent a purchase and cannot read an order id: it may have worked
    return { orderId };
  }

  /** TO VERIFY: POST /domains/renew.json with order-id, years, exp-date (the current expiry as seconds since 1970) and invoice-option; the answer carries the new expiry as `endtime` in the same unit. */
  async renew(orderId: string, years: number, currentExpiry: Date): Promise<{ expiresAt: Date | null }> {
    const body = rec(await this.call('POST', '/domains/renew.json', [['order-id', orderId], ['years', String(years)], ['exp-date', String(Math.floor(currentExpiry.getTime() / 1000))], ['invoice-option', 'NoInvoice']]));
    return { expiresAt: epoch(body.endtime) };
  }

  /** TO VERIFY: POST /domains/modify-privacy-protection.json with order-id, protect-privacy (true or false) and reason. */
  async setPrivacy(orderId: string, on: boolean): Promise<void> { await this.call('POST', '/domains/modify-privacy-protection.json', [['order-id', orderId], ['protect-privacy', String(on)], ['reason', on ? 'privacy protection on' : 'privacy protection off']]); }

  /** TO VERIFY: POST /domains/modify-ns.json with order-id and one `ns` per name server. */
  async setNameServers(orderId: string, ns: readonly string[]): Promise<void> { await this.call('POST', '/domains/modify-ns.json', [['order-id', orderId], ...ns.map((n) => ['ns', n] as const)]); }

  /**
   * TO VERIFY: two reads. GET /domains/orderid.json with domain-name gives the order id (a refusal or an empty answer means the name is not in our account); GET /domains/details.json with order-id and
   * options=OrderDetails gives `currentstatus` (Active, InActive, Pending...), `endtime` (seconds since 1970) and `privacy protection` flags.
   */
  async orderInfo(domain: string): Promise<OrderInfo> {
    let idBody: unknown;
    try { idBody = await this.call('GET', '/domains/orderid.json', [['domain-name', domain]]); } catch (e) { if (e instanceof RegistrarError && (e.code === 'REGISTRAR_REFUSED' || e.code === 'DOMAIN_NOT_AVAILABLE')) return { orderId: null, status: 'NOT_FOUND', expiresAt: null, privacy: null }; throw e; }
    const orderId = String(typeof idBody === 'object' ? '' : idBody ?? '').trim();
    if (!/^\d+$/.test(orderId)) return { orderId: null, status: 'NOT_FOUND', expiresAt: null, privacy: null };
    const d = rec(await this.call('GET', '/domains/details.json', [['order-id', orderId], ['options', 'OrderDetails']]));
    const cs = String(d.currentstatus ?? '').toLowerCase(); const ends = epoch(d.endtime);
    const status: OrderInfo['status'] = cs === 'active' ? (ends && ends.getTime() <= Date.now() ? 'EXPIRED' : 'ACTIVE') : cs === 'pending' || cs === 'inprocess' ? 'PENDING' : cs === 'expired' ? 'EXPIRED' : 'FAILED';
    return { orderId, status, expiresAt: ends, privacy: typeof d.isprivacyprotected === 'string' ? d.isprivacyprotected === 'true' : null };
  }

  /** TO VERIFY: GET /billing/reseller-balance.json; ASSUMED answer: `sellingcurrencybalance` as a decimal in the selling currency. */
  async balance(): Promise<number> {
    const v = decimalToPaise(rec(await this.call('GET', '/billing/reseller-balance.json', [])).sellingcurrencybalance);
    if (v === null) throw new RegistrarError('REGISTRAR_BAD_ANSWER', true);
    return v;
  }

  /**
   * TO VERIFY: GET /domains/validate-transfer.json with domain-name. ASSUMED answer: a body with `result` "true" when the registrar would accept the transfer; a refusal (status ERROR) carries a message
   * and the reason is picked from its words (lock, 60 days, recently, not registered). A refusal we cannot classify is UNKNOWN, which is not eligible.
   */
  async transferEligibility(domain: string): Promise<TransferEligibility> {
    try {
      const b = rec(await this.call('GET', '/domains/validate-transfer.json', [['domain-name', domain]]));
      return String(b.result ?? '').toLowerCase() === 'true' ? { eligible: true, reason: 'OK' } : { eligible: false, reason: 'UNKNOWN' };
    } catch (e) {
      if (e instanceof RegistrarError && !e.retryable && !e.ambiguous && (e.code === 'REGISTRAR_REFUSED' || e.code === 'DOMAIN_NOT_AVAILABLE')) return { eligible: false, reason: (e.hint as TransferReason | null) ?? 'UNKNOWN' };
      throw e;
    }
  }

  /**
   * TO VERIFY: POST /domains/transfer.json with domain-name, auth-code, customer-id, reg-contact-id, admin-contact-id, tech-contact-id, billing-contact-id, invoice-option (NoInvoice), purchase-privacy,
   * protect-privacy and one `ns` per name server; the answer carries `entityid`, the order id of the transfer. The authorisation code is sent once and is never logged or kept.
   */
  async transferIn(r: TransferRequest): Promise<{ orderId: string }> {
    const body = rec(await this.call('POST', '/domains/transfer.json', [
      ['domain-name', r.domain], ['auth-code', r.authCode], ['customer-id', r.customerId], ['reg-contact-id', r.contactId], ['admin-contact-id', r.contactId], ['tech-contact-id', r.contactId], ['billing-contact-id', r.contactId],
      ['invoice-option', 'NoInvoice'], ['purchase-privacy', String(r.privacy)], ['protect-privacy', String(r.privacy)], ...r.nameServers.map((n) => ['ns', n] as const),
    ]));
    const orderId = String(body.entityid ?? '').trim();
    if (!/^\d+$/.test(orderId)) throw new RegistrarError('REGISTRAR_BAD_ANSWER', false, true);
    return { orderId };
  }

  /**
   * TO VERIFY: the transfer's progress is read from GET /domains/details.json (order-id, options=OrderDetails): ASSUMED `currentstatus` values Active (done), InActive or Pending or InProcess (under way),
   * Cancelled or Rejected or Failed (ended). Without an order id the order is first looked up with GET /domains/orderid.json.
   */
  async transferStatus(domain: string, orderId: string | null): Promise<TransferState> {
    let id = orderId;
    if (!id) {
      try { const b = await this.call('GET', '/domains/orderid.json', [['domain-name', domain]]); id = String(typeof b === 'object' ? '' : b ?? '').trim(); } catch (e) { if (e instanceof RegistrarError && (e.code === 'REGISTRAR_REFUSED' || e.code === 'DOMAIN_NOT_AVAILABLE')) id = ''; else throw e; }
      if (!/^\d+$/.test(id)) return { status: 'NOT_FOUND', orderId: null, expiresAt: null, reason: null };
    }
    const d = rec(await this.call('GET', '/domains/details.json', [['order-id', id], ['options', 'OrderDetails']]));
    const cs = String(d.currentstatus ?? '').toLowerCase();
    const status: TransferState['status'] = cs === 'active' ? 'COMPLETED' : cs === 'cancelled' ? 'CANCELLED' : cs === 'rejected' || cs === 'failed' ? 'FAILED' : 'PENDING';
    return { status, orderId: id, expiresAt: epoch(d.endtime), reason: null };
  }

  private id(body: unknown): string {
    const id = String(typeof body === 'object' ? rec(body).customerid ?? rec(body).contactid ?? '' : body ?? '').trim();
    if (!/^\d+$/.test(id)) throw new RegistrarError('REGISTRAR_BAD_ANSWER', false, true);
    return id;
  }
}

/** ASSUMED product keys per extension for the price list (TO VERIFY). The default is "dot" plus the extension without its dots. */
export const PRODUCT_KEYS: Record<string, string> = { com: 'domcno', net: 'dotnet', org: 'domorg', in: 'dotin', 'co.in': 'dotcoin' };
