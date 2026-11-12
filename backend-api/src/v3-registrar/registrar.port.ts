import { Env, liveFlags } from './core/registrar-core';

/** What the registrar tells us about a name. */
export interface SearchHit { domain: string; status: 'AVAILABLE' | 'TAKEN' | 'UNKNOWN' }
/** The registrant, built from the vendor's verified details. */
export interface RegistrantDetails { name: string; company: string; email: string; addressLine1: string; city: string; state: string; country: string; zipcode: string; phoneCc: string; phone: string }
export interface RegisterRequest { domain: string; years: number; customerId: string; contactId: string; nameServers: string[]; privacy: boolean }
export interface OrderInfo { orderId: string | null; status: 'ACTIVE' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'NOT_FOUND'; expiresAt: Date | null; privacy: boolean | null }
/** Yearly cost in whole paise (the reseller's own price list). */
export interface CostRow { registerPaise: number; renewPaise: number }

/**
 * A registrar call that did not work. `ambiguous` is true when the request may or may not have been carried out (a timeout or a server fault AFTER a write was sent): the caller must NOT release a hold
 * or retry, it waits for reconciliation. `retryable` is true for a temporary fault on a read. The message never holds a key, a password or a full request.
 */
export class RegistrarError extends Error {
  constructor(readonly code: string, readonly retryable: boolean, readonly ambiguous: boolean = false) { super(code); this.name = 'RegistrarError'; }
}

/** The registrar (ResellerClub), behind one port. Production binds the gated adapter; tests bind a fake. No call here is ever made live by Claude Code. */
export abstract class RegistrarPort {
  abstract search(sld: string, tlds: readonly string[]): Promise<SearchHit[]>;
  abstract costs(tlds: readonly string[]): Promise<Record<string, CostRow>>;
  abstract createCustomer(d: RegistrantDetails): Promise<string>;
  abstract createContact(customerId: string, d: RegistrantDetails): Promise<string>;
  abstract register(r: RegisterRequest): Promise<{ orderId: string }>;
  abstract renew(orderId: string, years: number, currentExpiry: Date): Promise<{ expiresAt: Date | null }>;
  abstract setPrivacy(orderId: string, on: boolean): Promise<void>;
  abstract setNameServers(orderId: string, ns: readonly string[]): Promise<void>;
  /** looks a name up in our reseller account: used by reconciliation and by recovery after an unsure answer */
  abstract orderInfo(domain: string): Promise<OrderInfo>;
  /** the reseller balance in whole paise */
  abstract balance(): Promise<number>;
}

/**
 * The two live flags. REGISTRAR_LIVE_SEARCH lets the READ calls through (availability, price list, order lookups, balance); REGISTRAR_LIVE_PURCHASE lets everything that creates or changes something through
 * (customer, contact, register, renew, privacy, name servers). Both default OFF. With a flag off the call is refused here and the adapter behind it is never reached. Flags are read from the
 * environment on every call, so switching one needs a restart of the server only as the environment itself does.
 */
export class GatedRegistrarPort extends RegistrarPort {
  constructor(private readonly inner: RegistrarPort, private readonly env: () => Env = () => process.env) { super(); }
  private read(): void { const f = liveFlags(this.env()); if (!f.search && !f.purchase) throw new RegistrarError('REGISTRAR_LIVE_DISABLED', false); }
  private search_(): void { if (!liveFlags(this.env()).search) throw new RegistrarError('REGISTRAR_LIVE_DISABLED', false); }
  private write(): void { if (!liveFlags(this.env()).purchase) throw new RegistrarError('REGISTRAR_LIVE_DISABLED', false); }
  async search(sld: string, tlds: readonly string[]) { this.search_(); return this.inner.search(sld, tlds); }
  async costs(tlds: readonly string[]) { this.search_(); return this.inner.costs(tlds); }
  async createCustomer(d: RegistrantDetails) { this.write(); return this.inner.createCustomer(d); }
  async createContact(customerId: string, d: RegistrantDetails) { this.write(); return this.inner.createContact(customerId, d); }
  async register(r: RegisterRequest) { this.write(); return this.inner.register(r); }
  async renew(orderId: string, years: number, currentExpiry: Date) { this.write(); return this.inner.renew(orderId, years, currentExpiry); }
  async setPrivacy(orderId: string, on: boolean) { this.write(); return this.inner.setPrivacy(orderId, on); }
  async setNameServers(orderId: string, ns: readonly string[]) { this.write(); return this.inner.setNameServers(orderId, ns); }
  async orderInfo(domain: string) { this.read(); return this.inner.orderInfo(domain); }
  async balance() { this.read(); return this.inner.balance(); }
}
