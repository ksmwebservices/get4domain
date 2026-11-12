import { OtpPepper } from '../../src/directory/pepper';
import { Actor } from '../../src/plans/admin/audit.service';
import { ActivityEvent } from '../../src/common/activity-bus';
import { OrderStatus } from '../../src/v3-registrar/core/registrar-core';
import { DocCrypto } from '../../src/v3-registrar/doc-crypto';
import { IdentityOtpSender, IdentityService } from '../../src/v3-registrar/identity.service';
import { CostRow, OrderInfo, RegisterRequest, RegistrantDetails, RegistrarError, RegistrarPort, SearchHit, TransferEligibility, TransferRequest, TransferState } from '../../src/v3-registrar/registrar.port';
import { RegistrarService } from '../../src/v3-registrar/registrar.service';
import {
  AccessAction, DocBlob, DuplicateOrderError, InvoiceRow, MarginDbRow, NewOrder, NewRegistered, OrderKind, OrderPatch, OrderRow, OtpRow, RegisteredPatch, RegisteredRow, RegistrantFields, RegistrantPatch, RegistrantRow,
  RegistrantStatus, RegistrarStore, RegistrarTx, RunRow,
} from '../../src/v3-registrar/registrar.store';
import { DEFAULT_REGISTRAR_SETTINGS, RegistrarSettings } from '../../src/v3-registrar/settings/registrar-settings';
import { WalletTx } from '../../src/v3-wallet/wallet.store';
import { MemoryWalletStore } from './memory-wallet-store';
import { walletWorld, WalletWorld } from './wallet-world';

/** In-memory twin of PrismaRegistrarStore. A unit runs inside the wallet twin's unit, and this twin rolls back together with it (a sidecar), so a ledger entry and the order rows commit or vanish together. */
export class MemoryRegistrarStore extends RegistrarStore {
  orders: OrderRow[] = []; registeredRows: RegisteredRow[] = []; invoices: InvoiceRow[] = []; marginRows: MarginDbRow[] = []; registrants = new Map<string, RegistrantRow>(); docs = new Map<string, DocBlob & { mime: string; kind: string }>();
  otps: OtpRow[] = []; access: Array<{ vendorId: string; staffId: string | null; action: string; reason: string | null; at: Date }> = []; customers = new Map<string, { rcCustomerId: string; rcContactId: string }>(); runs: RunRow[] = [];
  vendorDomains: Array<{ id: string; vendorId: string; hostname: string }> = []; audits: Array<{ action: string; entityId: string | null }> = []; clock: () => Date = () => new Date(); private n = 0;
  constructor(readonly wallets: MemoryWalletStore) { super(); wallets.sidecars.push(this); }
  capture(): () => void {
    const s = { o: this.orders.map((x) => ({ ...x })), r: this.registeredRows.map((x) => ({ ...x })), i: [...this.invoices], d: [...this.vendorDomains], c: new Map(this.customers), a: this.audits.length };
    return () => { this.orders = s.o; this.registeredRows = s.r; this.invoices = s.i; this.vendorDomains = s.d; this.customers = s.c; this.audits.length = s.a; };
  }
  private id(p: string): string { return `${p}-${++this.n}`; }
  unit<T>(vendorId: string, fn: (t: RegistrarTx, w: WalletTx) => Promise<T>): Promise<T> { return this.wallets.unit(vendorId, (wtx) => fn(this.tx(vendorId), wtx)); }
  private tx(vendorId: string): RegistrarTx {
    const own = (id: string) => this.orders.find((o) => o.id === id && o.vendorId === vendorId);
    return {
      vendorId,
      orderByKey: async (key) => { const o = this.orders.find((x) => x.vendorId === vendorId && x.idempotencyKey === key); return o ? { ...o } : null; },
      order: async (id) => { const o = own(id); return o ? { ...o } : null; },
      insertOrder: async (d: NewOrder) => {
        if (this.orders.some((o) => o.vendorId === d.vendorId && o.idempotencyKey === d.idempotencyKey)) throw new DuplicateOrderError('KEY');
        if (d.openKey && this.orders.some((o) => o.openKey === d.openKey)) throw new DuplicateOrderError('NAME');
        const now = this.clock(); const row: OrderRow = { ...d, status: 'CREATED', holdLedgerId: null, chargeLedgerId: null, releaseLedgerId: null, rcOrderId: null, fundedBy: 'WALLET', failureCode: null, createdAt: now, updatedAt: now };
        this.orders.push(row); return { ...row };
      },
      updateOrder: async (id, expected: OrderStatus[], patch: OrderPatch) => { const o = own(id); if (!o || !expected.includes(o.status)) return null; Object.assign(o, patch, { updatedAt: this.clock() }); return { ...o }; },
      registeredByDomain: async (domain) => { const r = this.registeredRows.find((x) => x.domain === domain && x.vendorId === vendorId); return r ? { ...r } : null; },
      registered: async (id) => { const r = this.registeredRows.find((x) => x.id === id && x.vendorId === vendorId); return r ? { ...r } : null; },
      insertRegistered: async (d: NewRegistered) => { const row: RegisteredRow = { ...d, id: this.id('reg'), status: 'ACTIVE', dnsStatus: 'PENDING', alertsSent: [], registeredAt: this.clock(), lastRenewedAt: null }; this.registeredRows.push(row); return { ...row }; },
      updateRegistered: async (id, patch: RegisteredPatch) => { const r = this.registeredRows.find((x) => x.id === id && x.vendorId === vendorId); if (!r) return null; Object.assign(r, patch); return { ...r }; },
      adoptDomain: async (host) => { const ex = this.vendorDomains.find((d) => d.hostname === host); if (ex) return ex.vendorId === vendorId ? ex.id : null; const row = { id: this.id('dom'), vendorId, hostname: host }; this.vendorDomains.push(row); return row.id; },
      customer: async () => this.customers.get(vendorId) ?? null,
      invoiceForOrder: async (orderId) => this.invoices.find((i) => i.vendorId === vendorId && i.orderId === orderId) ?? null,
      insertInvoice: async (d) => { if (this.invoices.some((i) => i.orderId === d.orderId)) throw new Error('unique: one invoice per order'); const row = { ...d, id: this.id('inv') }; this.invoices.push(row); return row; },
      audit: async (_a: Actor, action, entityId) => { this.audits.push({ action, entityId }); },
    };
  }
  // price book
  async margins() { return this.marginRows.map((m) => ({ ...m })); }
  async getMargin(id: string) { const m = this.marginRows.find((x) => x.id === id); return m ? { ...m } : null; }
  async insertMargin(d: Pick<MarginDbRow, 'tld' | 'kind' | 'value' | 'note' | 'createdBy'>) { const row: MarginDbRow = { ...d, id: this.id('mar'), status: 'PROPOSED', effectiveFrom: null, approvedBy: null, approvedAt: null, createdAt: this.clock() }; this.marginRows.push(row); return { ...row }; }
  async updateMargin(id: string, expected: MarginDbRow['status'][], patch: Partial<Pick<MarginDbRow, 'status' | 'effectiveFrom' | 'approvedBy' | 'approvedAt'>>) {
    const m = this.marginRows.find((x) => x.id === id); if (!m || !expected.includes(m.status)) return null;
    if (patch.effectiveFrom && this.marginRows.some((x) => x.id !== id && x.tld === m.tld && x.effectiveFrom?.getTime() === patch.effectiveFrom!.getTime())) return null;
    Object.assign(m, patch); return { ...m };
  }
  // registrant
  async registrant(vendorId: string) { const r = this.registrants.get(vendorId); return r ? { ...r } : null; }
  async saveRegistrant(vendorId: string, f: RegistrantFields, resetEmail: boolean, resetPhone: boolean) {
    const prior = this.registrants.get(vendorId);
    const row: RegistrantRow = { vendorId, ...f, emailVerifiedAt: resetEmail ? null : prior?.emailVerifiedAt ?? null, phoneVerifiedAt: resetPhone ? null : prior?.phoneVerifiedAt ?? null, docKind: prior?.docKind ?? null, docLast4: prior?.docLast4 ?? null, docMime: prior?.docMime ?? null, docBytes: prior?.docBytes ?? null, docUploadedAt: prior?.docUploadedAt ?? null, docPurgedAt: prior?.docPurgedAt ?? null, status: prior?.status ?? 'INCOMPLETE', reviewedBy: prior?.reviewedBy ?? null, reviewedAt: prior?.reviewedAt ?? null, reviewNote: prior?.reviewNote ?? null, consentAt: prior?.consentAt ?? null, updatedAt: this.clock() };
    this.registrants.set(vendorId, row); return { ...row };
  }
  async patchRegistrant(vendorId: string, expected: RegistrantStatus[] | null, patch: RegistrantPatch) { const r = this.registrants.get(vendorId); if (!r || (expected && !expected.includes(r.status))) return null; Object.assign(r, patch, { updatedAt: this.clock() }); return { ...r }; }
  async storeDocument(vendorId: string, blob: DocBlob, meta: { kind: string; last4: string | null; mime: string; bytes: number; at: Date }) {
    const r = this.registrants.get(vendorId); if (!r) return null;
    this.docs.set(vendorId, { ...blob, mime: meta.mime, kind: meta.kind }); Object.assign(r, { docKind: meta.kind, docLast4: meta.last4, docMime: meta.mime, docBytes: meta.bytes, docUploadedAt: meta.at, docPurgedAt: null }); return { ...r };
  }
  async readDocument(vendorId: string) { return this.docs.get(vendorId) ?? null; }
  async purgeDocument(vendorId: string, at: Date) { const r = this.registrants.get(vendorId); if (!r || !this.docs.has(vendorId)) return false; this.docs.delete(vendorId); r.docPurgedAt = at; return true; }
  async insertOtp(d: Omit<OtpRow, 'id' | 'attempts' | 'consumedAt' | 'createdAt'> & { createdAt: Date }) { const row: OtpRow = { ...d, id: this.id('otp'), attempts: 0, consumedAt: null }; this.otps.push(row); return { ...row }; }
  async latestOtp(vendorId: string, channel: 'EMAIL' | 'PHONE') { const x = this.otps.filter((o) => o.vendorId === vendorId && o.channel === channel).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]; return x ? { ...x } : null; }
  async updateOtp(vendorId: string, id: string, patch: { attempts?: number; consumedAt?: Date }) { const o = this.otps.find((x) => x.id === id && x.vendorId === vendorId); if (o) Object.assign(o, patch); }
  async logAccess(vendorId: string, staffId: string | null, action: AccessAction, reason: string | null, at: Date) { this.access.push({ vendorId, staffId, action, reason, at }); }
  async accessLog(vendorId: string, skip: number, take: number) { const all = this.access.filter((a) => a.vendorId === vendorId).sort((a, b) => b.at.getTime() - a.at.getTime()); return { items: all.slice(skip, skip + take).map((a) => ({ staffId: a.staffId, action: a.action, reason: a.reason, at: a.at })), total: all.length }; }
  async reviewQueue(status: RegistrantStatus | undefined, skip: number, take: number) { const all = [...this.registrants.values()].filter((r) => !status || r.status === status); return { items: all.slice(skip, skip + take).map((r) => ({ ...r })), total: all.length }; }
  async documentsDueForPurge(decidedBefore: Date, limit: number) { return [...this.registrants.values()].filter((r) => (r.status === 'APPROVED' || r.status === 'REJECTED') && r.reviewedAt && r.reviewedAt < decidedBefore && this.docs.has(r.vendorId)).slice(0, limit).map((r) => r.vendorId); }
  // customer, orders, registered
  async customer(vendorId: string) { return this.customers.get(vendorId) ?? null; }
  async saveCustomer(vendorId: string, rcCustomerId: string, rcContactId: string) { const v = { rcCustomerId, rcContactId }; this.customers.set(vendorId, v); return v; }
  async orderByKey(vendorId: string, key: string) { const o = this.orders.find((x) => x.vendorId === vendorId && x.idempotencyKey === key); return o ? { ...o } : null; }
  async order(vendorId: string, id: string) { const o = this.orders.find((x) => x.vendorId === vendorId && x.id === id); return o ? { ...o } : null; }
  async ordersForVendor(vendorId: string, skip: number, take: number) { const all = this.orders.filter((o) => o.vendorId === vendorId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); return { items: all.slice(skip, skip + take).map((o) => ({ ...o })), total: all.length }; }
  async ordersForStaff(f: { vendorId?: string; status?: OrderStatus; kind?: OrderKind }, skip: number, take: number) { const all = this.orders.filter((o) => (!f.vendorId || o.vendorId === f.vendorId) && (!f.status || o.status === f.status) && (!f.kind || o.kind === f.kind)); return { items: all.slice(skip, skip + take).map((o) => ({ ...o })), total: all.length }; }
  async unsettledOrders(before: Date, limit: number) { return this.orders.filter((o) => ['CREATED', 'HELD', 'SUBMITTED', 'UNKNOWN'].includes(o.status) && o.updatedAt.getTime() <= before.getTime()).slice(0, limit).map((o) => ({ ...o })); }
  async registeredForVendor(vendorId: string) { return this.registeredRows.filter((r) => r.vendorId === vendorId).map((r) => ({ ...r })); }
  async registeredOne(vendorId: string, id: string) { const r = this.registeredRows.find((x) => x.vendorId === vendorId && x.id === id); return r ? { ...r } : null; }
  async registeredByName(domain: string) { const r = this.registeredRows.find((x) => x.domain === domain); return r ? { ...r } : null; }
  async activeRegistered(limit: number) { return this.registeredRows.filter((r) => r.status === 'ACTIVE').slice(0, limit).map((r) => ({ ...r })); }
  async patchRegistered(vendorId: string, id: string, patch: RegisteredPatch) { const r = this.registeredRows.find((x) => x.vendorId === vendorId && x.id === id); if (!r) return null; Object.assign(r, patch); return { ...r }; }
  async invoiceForOrder(vendorId: string, orderId: string) { return this.invoices.find((i) => i.vendorId === vendorId && i.orderId === orderId) ?? null; }
  async insertRun(at: Date) { const r: RunRow = { id: this.id('run'), startedAt: at, finishedAt: null, checked: 0, settled: 0, mismatches: [], balancePaise: null, status: 'RUNNING', note: null }; this.runs.push(r); return { ...r }; }
  async finishRun(id: string, patch: Partial<RunRow>) { const r = this.runs.find((x) => x.id === id); if (r) Object.assign(r, patch); }
  async lastRuns(take: number) { return this.runs.slice(-take).reverse().map((r) => ({ ...r })); }
}

/** The fake registrar of the tests (never in the product): a small catalogue, a reseller balance, scripted failures, and a record of every call. */
export class FakeRegistrar extends RegistrarPort {
  calls: string[] = []; taken = new Set<string>(); balanceValue = 5_000_000; costTable: Record<string, CostRow> = { com: { registerPaise: 70_000, renewPaise: 75_000, transferPaise: 80_000 }, in: { registerPaise: 60_000, renewPaise: 65_000 } };
  registered = new Map<string, { orderId: string; expiresAt: Date; privacy: boolean }>(); customers = 0; contacts = 0; nextOrder = 9000;
  /** the next register call: 'ok', 'refuse' (a definite refusal), 'timeout' (it may have happened: not recorded), 'timeout-but-done' (it happened but we were not told) */
  registerMode: 'ok' | 'refuse' | 'timeout' | 'timeout-but-done' = 'ok'; renewMode: 'ok' | 'refuse' | 'timeout' | 'timeout-but-done' = 'ok'; lookupFails = false; customerFails = false;
  now: () => Date = () => new Date('2026-11-12T10:00:00Z');
  async search(sld: string, tlds: readonly string[]): Promise<SearchHit[]> { this.calls.push('search'); return tlds.map((t) => ({ domain: `${sld}.${t}`, status: this.taken.has(`${sld}.${t}`) || this.registered.has(`${sld}.${t}`) ? 'TAKEN' : 'AVAILABLE' })); }
  async costs(tlds: readonly string[]) { this.calls.push('costs'); return Object.fromEntries(tlds.filter((t) => this.costTable[t]).map((t) => [t, this.costTable[t]])); }
  async createCustomer(_d: RegistrantDetails) { this.calls.push('createCustomer'); if (this.customerFails) throw new RegistrarError('REGISTRAR_REFUSED', false); this.customers++; return `cust-${this.customers}`; }
  async createContact(_c: string, _d: RegistrantDetails) { this.calls.push('createContact'); this.contacts++; return `cont-${this.contacts}`; }
  async register(r: RegisterRequest) {
    this.calls.push(`register:${r.domain}`);
    if (this.registerMode === 'refuse') throw new RegistrarError('DOMAIN_NOT_AVAILABLE', false);
    if (this.registerMode === 'timeout') throw new RegistrarError('REGISTRAR_UNREACHABLE', false, true);
    if (this.registered.has(r.domain)) throw new RegistrarError('DOMAIN_NOT_AVAILABLE', false);
    const orderId = String(++this.nextOrder); this.registered.set(r.domain, { orderId, expiresAt: new Date(this.now().getTime() + r.years * 365 * 86_400_000), privacy: r.privacy });
    if (this.registerMode === 'timeout-but-done') throw new RegistrarError('REGISTRAR_UNREACHABLE', false, true);
    return { orderId };
  }
  async renew(orderId: string, years: number, currentExpiry: Date) {
    this.calls.push(`renew:${orderId}`);
    if (this.renewMode === 'refuse') throw new RegistrarError('REGISTRAR_REFUSED', false);
    if (this.renewMode === 'timeout') throw new RegistrarError('REGISTRAR_UNREACHABLE', false, true);
    const e = [...this.registered.values()].find((x) => x.orderId === orderId); const next = new Date(currentExpiry.getTime() + years * 365 * 86_400_000); if (e) e.expiresAt = next;
    if (this.renewMode === 'timeout-but-done') throw new RegistrarError('REGISTRAR_UNREACHABLE', false, true);
    return { expiresAt: next };
  }
  async setPrivacy() { this.calls.push('setPrivacy'); } async setNameServers() { this.calls.push('setNameServers'); }
  async orderInfo(domain: string): Promise<OrderInfo> {
    this.calls.push(`orderInfo:${domain}`); if (this.lookupFails) throw new RegistrarError('REGISTRAR_SERVER_ERROR', true);
    const r = this.registered.get(domain); return r ? { orderId: r.orderId, status: r.expiresAt.getTime() <= this.now().getTime() ? 'EXPIRED' : 'ACTIVE', expiresAt: r.expiresAt, privacy: r.privacy } : { orderId: null, status: 'NOT_FOUND', expiresAt: null, privacy: null };
  }
  async balance() { this.calls.push('balance'); return this.balanceValue; }
  // transfer-in (slice 5.6e)
  eligibility = new Map<string, TransferEligibility>(); transfers = new Map<string, { orderId: string; status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'; expiresAt: Date | null }>();
  transferMode: 'ok' | 'refuse' | 'timeout' | 'timeout-but-started' = 'ok';
  async transferEligibility(domain: string): Promise<TransferEligibility> { this.calls.push(`transferEligibility:${domain}`); return this.eligibility.get(domain) ?? { eligible: true, reason: 'OK' }; }
  async transferIn(r: TransferRequest) {
    this.calls.push(`transferIn:${r.domain}`);
    if (this.transferMode === 'refuse') throw new RegistrarError('REGISTRAR_REFUSED', false);
    if (this.transferMode === 'timeout') throw new RegistrarError('REGISTRAR_UNREACHABLE', false, true);
    const orderId = String(++this.nextOrder); this.transfers.set(r.domain, { orderId, status: 'PENDING', expiresAt: null });
    if (this.transferMode === 'timeout-but-started') throw new RegistrarError('REGISTRAR_UNREACHABLE', false, true);
    return { orderId };
  }
  async transferStatus(domain: string, _orderId: string | null): Promise<TransferState> {
    this.calls.push(`transferStatus:${domain}`); if (this.lookupFails) throw new RegistrarError('REGISTRAR_SERVER_ERROR', true);
    const t = this.transfers.get(domain); return t ? { status: t.status, orderId: t.orderId, expiresAt: t.expiresAt, reason: null } : { status: 'NOT_FOUND', orderId: null, expiresAt: null, reason: null };
  }
  finishTransfer(domain: string): void { const t = this.transfers.get(domain)!; t.status = 'COMPLETED'; t.expiresAt = new Date(this.now().getTime() + 365 * 86_400_000); this.registered.set(domain, { orderId: t.orderId, expiresAt: t.expiresAt, privacy: false }); }
  failTransfer(domain: string, status: 'FAILED' | 'CANCELLED'): void { this.transfers.get(domain)!.status = status; }
}

export class RecordingOtpSender extends IdentityOtpSender {
  sent: Array<{ channel: 'EMAIL' | 'PHONE'; to: string; code: string; vendorId: string }> = []; fail = false;
  async send(channel: 'EMAIL' | 'PHONE', to: string, code: string, vendorId: string) { if (this.fail) throw new Error('provider down'); this.sent.push({ channel, to, code, vendorId }); }
}
/** Reversible, readable "encryption" for tests only: proves the service stores what the crypto gave it and never the clear bytes. */
export class FakeCrypto extends DocCrypto {
  fail: 'none' | 'config' | 'read' = 'none';
  encrypt(plain: Buffer): DocBlob { if (this.fail === 'config') { const { DocCryptoError } = jest.requireActual('../../src/v3-registrar/doc-crypto'); throw new DocCryptoError('IDENTITY_STORAGE_NOT_CONFIGURED'); } return { cipher: Buffer.from([...plain].map((b) => b ^ 0x5a)), iv: Buffer.alloc(12, 1), tag: Buffer.alloc(16, 2) }; }
  decrypt(b: DocBlob): Buffer { if (this.fail === 'read') { const { DocCryptoError } = jest.requireActual('../../src/v3-registrar/doc-crypto'); throw new DocCryptoError('IDENTITY_DOCUMENT_UNREADABLE'); } return Buffer.from([...b.cipher].map((x) => x ^ 0x5a)); }
}

export const V1 = { type: 'VENDOR' as const, id: 'u1', ip: null }; export const V2 = { type: 'VENDOR' as const, id: 'u2', ip: null };
export const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
export const SETTINGS_READY: Partial<RegistrarSettings> = { registrarNameServers: ['ns1.example.com', 'ns2.example.com'], registrarMinBalancePaise: 100_000, identityOtpTtlSeconds: 600, identityOtpMaxAttempts: 3, identityOtpMinIntervalSeconds: 30, identityDocMaxBytes: 1_000_000 };

export interface RegistrarWorld extends WalletWorld {
  rstore: MemoryRegistrarStore; port: FakeRegistrar; reg: RegistrarService; identity: IdentityService; sender: RecordingOtpSender; crypto: FakeCrypto; rsettings: { v: Partial<RegistrarSettings> };
  plan: { level: 'PRO' | 'FREE'; status: 'ACTIVE' | 'GRACE' | 'EXPIRED' | null; suspended: boolean };
  /** a Pro vendor with an open wallet holding `amount` paise, a billing state, an APPROVED identity, and approved prices for com and in */
  vendor(vendorId: string, amount: number): Promise<void>; approve(vendorId: string): Promise<void>; price(tld: string, kind: 'PERCENT_BP' | 'FIXED_PAISE', value: number): Promise<void>;
  rEvents(): ActivityEvent[]; advance(ms: number): void; key(): string;
}

/** GST at 18 percent in tax-table rows (CGST 9 plus SGST 9, IGST 18), the seller in state 33. Wallet twin default has ZERO rates. */
export function registrarWorld(): RegistrarWorld {
  const w = walletWorld();
  const rstore = new MemoryRegistrarStore(w.store); rstore.clock = () => new Date(w.now.t);
  const port = new FakeRegistrar(); port.now = () => new Date(w.now.t);
  const t0 = new Date('2026-01-01T00:00:00Z');
  w.store.taxes = [{ name: 'IGST', ratePercent: 18, appliesTo: 'ALL', active: true, validFrom: t0 }, { name: 'CGST', ratePercent: 9, appliesTo: 'ALL', active: true, validFrom: t0 }, { name: 'SGST', ratePercent: 9, appliesTo: 'ALL', active: true, validFrom: t0 }];
  const rsettings = { v: { ...SETTINGS_READY } as Partial<RegistrarSettings> };
  const settings = { get: async (): Promise<RegistrarSettings> => ({ ...DEFAULT_REGISTRAR_SETTINGS, ...rsettings.v }) } as never;
  const plan: RegistrarWorld['plan'] = { level: 'PRO', status: 'ACTIVE', suspended: false };
  const ents = { resolve: async () => ({ level: plan.level, subscriptionStatus: plan.status, suspended: plan.suspended, features: { 'site.custom_domain': { state: plan.level === 'PRO' ? 'ACTIVE' : 'LOCKED_PREVIEW', upsellText: plan.level === 'PRO' ? null : 'Pro only' } } }) } as never;
  const svc = new RegistrarService(rstore, port, settings, w.svc, w.store, w.settingsService, ents, undefined, w.bus); svc.clock = () => new Date(w.now.t);
  const sender = new RecordingOtpSender(); const crypto = new FakeCrypto();
  const identity = new IdentityService(rstore, sender, settings, new OtpPepper(), crypto, w.bus); identity.clock = () => new Date(w.now.t);
  let kn = 0;
  const price = async (tld: string, kind: 'PERCENT_BP' | 'FIXED_PAISE', value: number) => { const m = await svc.proposeMargin({ tld, kind, value }, STAFF); await svc.approveMargin(m.id, new Date(w.now.t.getTime() - 86_400_000).toISOString(), STAFF); };
  const approve = async (vendorId: string) => {
    await identity.saveDetails(vendorId, { legalName: 'Meena Ravi', company: 'Sri Ganesh Traders', email: `${vendorId}@example.in`, phoneCc: '91', phone: '9876543210', addressLine1: '12 Main Road', city: 'Madurai', state: 'Tamil Nadu', zipcode: '625001' }, V1);
    await rstore.patchRegistrant(vendorId, null, { emailVerifiedAt: w.now.t, phoneVerifiedAt: w.now.t, docKind: 'PAN', docUploadedAt: w.now.t, status: 'APPROVED', consentAt: w.now.t, reviewedAt: w.now.t, reviewedBy: 'staff-1' });
  };
  const vendor = async (vendorId: string, amount: number) => {
    await w.open(vendorId); if (amount > 0) await w.fund(vendorId, amount);
    await approve(vendorId);
  };
  return { ...w, rstore, port, reg: svc, identity, sender, crypto, rsettings, plan, vendor, approve, price, rEvents: () => w.events, advance: (ms) => { w.now.t = new Date(w.now.t.getTime() + ms); }, key: () => `dom-key-${String(++kn).padStart(6, '0')}` };
}
