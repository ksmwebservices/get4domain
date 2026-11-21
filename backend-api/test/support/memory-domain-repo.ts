import { Actor } from '../../src/plans/admin/audit.service';
import {
  DomainListQuery, DomainPatch, DomainRecord, DomainRepository, DomainTx, DuplicateHostError, NewDomain, RedirectRecord, VendorInfo, VerificationRecord,
} from '../../src/site-domains/domain.repository';

/** In-memory twin of the Prisma domain repository. It enforces the same rules as the database: unique host name, one primary per vendor, one free subdomain per vendor. */
export class MemoryDomainRepo extends DomainRepository implements DomainTx {
  rows = new Map<string, DomainRecord>();
  primarySlot = new Map<string, string>();     // vendorId -> domainId
  subdomainSlot = new Map<string, string>();   // vendorId -> domainId
  verifications = new Map<string, VerificationRecord>();
  redirects: RedirectRecord[] = [];
  vendors = new Map<string, VendorInfo>();
  audits: Array<{ actor: Actor; action: string; entityId: string | null; before: unknown; after: unknown }> = [];
  clock: () => Date = () => new Date();
  private seq = 0;
  private chains = new Map<string, Promise<unknown>>();
  failNextCreate = false;

  addVendor(id: string, subdomain: string | null = null, status = 'ACTIVE'): void { this.vendors.set(id, { id, status, subdomain }); }

  private cp(r: DomainRecord | undefined | null): DomainRecord | null { return r ? { ...r } : null; }
  private seqOf(r: DomainRecord): number { return Number(r.id.split('-')[1]); }
  async findByHostname(h: string): Promise<DomainRecord | null> { return this.cp([...this.rows.values()].find((r) => r.hostname === h)); }
  async findById(id: string): Promise<DomainRecord | null> { return this.cp(this.rows.get(id)); }
  async listForVendor(v: string): Promise<DomainRecord[]> { return [...this.rows.values()].filter((r) => r.vendorId === v).sort((a, b) => this.seqOf(a) - this.seqOf(b)).map((r) => ({ ...r })); }
  async list(q: DomainListQuery): Promise<{ items: DomainRecord[]; total: number }> {
    const all = [...this.rows.values()].filter((r) => (!q.vendorId || r.vendorId === q.vendorId) && (!q.status || r.status === q.status) && (!q.kind || r.kind === q.kind) && (!q.q || r.hostname.includes(q.q.toLowerCase())));
    return { items: all.slice(q.skip, q.skip + q.take).map((r) => ({ ...r })), total: all.length };
  }
  async countNonRemovedCustom(v: string): Promise<number> { return [...this.rows.values()].filter((r) => r.vendorId === v && r.kind === 'CUSTOM' && r.status !== 'REMOVED').length; }
  async countSubdomainChangesSince(v: string, since: Date): Promise<number> { return [...this.rows.values()].filter((r) => r.vendorId === v && r.kind === 'SUBDOMAIN' && r.status === 'REMOVED' && r.removedAt && r.removedAt >= since).length; }
  async getVerification(id: string): Promise<VerificationRecord | null> { return this.verifications.get(id) ?? null; }
  async vendorInfo(v: string): Promise<VendorInfo | null> { return this.vendors.get(v) ?? null; }
  async vendorBySubdomain(s: string): Promise<VendorInfo | null> { return [...this.vendors.values()].find((v) => v.subdomain === s) ?? null; }
  async findRedirect(fromHost: string, fromPath: string): Promise<RedirectRecord | null> { return this.redirects.find((r) => r.active && r.fromHost === fromHost && r.fromPath === fromPath) ?? null; }

  async transaction<T>(vendorId: string, fn: (tx: DomainTx) => Promise<T>): Promise<T> {
    const prev = this.chains.get('*') ?? Promise.resolve();   // one global queue: the twin snapshots the whole state, so transactions must not interleave
    const run = prev.catch(() => undefined).then(() => this.atomic(fn));
    this.chains.set('*', run.catch(() => undefined));
    return run;
  }
  /** all-or-nothing: a throw restores the state from before the callback */
  private async atomic<T>(fn: (tx: DomainTx) => Promise<T>): Promise<T> {
    const snap = { rows: new Map([...this.rows].map(([k, v]) => [k, { ...v }])), p: new Map(this.primarySlot), s: new Map(this.subdomainSlot), ver: new Map([...this.verifications].map(([k, v]) => [k, { ...v }])), red: this.redirects.map((r) => ({ ...r })), ven: new Map([...this.vendors].map(([k, v]) => [k, { ...v }])), au: this.audits.length };
    try { return await fn(this); } catch (e) {
      this.rows = snap.rows; this.primarySlot = snap.p; this.subdomainSlot = snap.s; this.verifications = snap.ver; this.redirects = snap.red; this.vendors = snap.ven; this.audits.length = snap.au;
      throw e;
    }
  }

  async create(d: NewDomain): Promise<DomainRecord> {
    if (this.failNextCreate) { this.failNextCreate = false; throw new DuplicateHostError(); }
    if ([...this.rows.values()].some((r) => r.hostname === d.hostname)) throw new DuplicateHostError();
    const now = this.clock();
    const r: DomainRecord = { id: `dom-${++this.seq}`, vendorId: d.vendorId, hostname: d.hostname, kind: d.kind, status: d.status, isPrimary: false, verifiedAt: d.verifiedAt ?? null, sslStatus: 'NONE', createdByType: d.createdByType, createdById: d.createdById, createdAt: now, updatedAt: now, removedAt: null };
    this.rows.set(r.id, r);
    return { ...r };
  }
  async update(id: string, p: DomainPatch): Promise<DomainRecord> {
    const r = this.rows.get(id); if (!r) throw new Error('no row');
    if (p.status === 'REMOVED') { if (this.primarySlot.get(r.vendorId) === id) this.primarySlot.delete(r.vendorId); if (this.subdomainSlot.get(r.vendorId) === id) this.subdomainSlot.delete(r.vendorId); r.isPrimary = false; }
    Object.assign(r, p, { updatedAt: this.clock() });
    return { ...r };
  }
  async setPrimary(vendorId: string, domainId: string | null): Promise<void> {
    const cur = this.primarySlot.get(vendorId); if (cur) { const c = this.rows.get(cur); if (c) c.isPrimary = false; this.primarySlot.delete(vendorId); }
    if (domainId) { const r = this.rows.get(domainId); if (!r || r.vendorId !== vendorId) throw new Error('not this vendor'); r.isPrimary = true; this.primarySlot.set(vendorId, domainId); }
  }
  async setSubdomainSlot(domainId: string, on: boolean): Promise<void> {
    const r = this.rows.get(domainId); if (!r) throw new Error('no row');
    if (on) { const cur = this.subdomainSlot.get(r.vendorId); if (cur && cur !== domainId) throw new DuplicateHostError(); this.subdomainSlot.set(r.vendorId, domainId); } else if (this.subdomainSlot.get(r.vendorId) === domainId) this.subdomainSlot.delete(r.vendorId);
  }
  async upsertVerification(domainId: string, vendorId: string, patch: Partial<Omit<VerificationRecord, 'domainId' | 'vendorId'>>): Promise<VerificationRecord> {
    const cur = this.verifications.get(domainId) ?? { domainId, vendorId, method: 'TXT', expectedValue: '', lastCheckedAt: null, attempts: 0, result: 'PENDING' };
    const next = { ...cur, ...patch, vendorId }; this.verifications.set(domainId, next); return next;
  }
  async setVendorSubdomain(vendorId: string, subdomain: string): Promise<void> {
    if ([...this.vendors.values()].some((v) => v.id !== vendorId && v.subdomain === subdomain)) throw new DuplicateHostError();
    const v = this.vendors.get(vendorId); if (v) v.subdomain = subdomain;
  }
  async addRedirect(r: Omit<RedirectRecord, 'id' | 'active'>): Promise<void> {
    const existing = this.redirects.find((x) => x.fromHost === r.fromHost && x.fromPath === r.fromPath);
    if (existing) Object.assign(existing, r, { active: true }); else this.redirects.push({ ...r, id: `red-${++this.seq}`, active: true });
  }
  async audit(actor: Actor, action: string, entityId: string | null, before: unknown, after: unknown): Promise<void> { this.audits.push({ actor, action, entityId, before, after }); }
}
