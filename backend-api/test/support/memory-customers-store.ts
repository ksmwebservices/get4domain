import { CustomerFields, CustomerSource } from '../../src/v3-customers/core/customer-core';
import { CustomerKeyTaken, CustomerPatch, CustomerRow, CustomersStore, ListQuery, SourceRow } from '../../src/v3-customers/customers.store';

/** In-memory twin of the customer store: the same uniqueness (vendor + phone key, vendor + e-mail key), the same vendor scoping, the same idempotent source rows. */
export class MemoryCustomersStore extends CustomersStore {
  rows: CustomerRow[] = []; sources: Array<SourceRow & { vendorId: string }> = []; private n = 0;
  private clone(r: CustomerRow): CustomerRow { return { ...r, tags: [...r.tags] }; }
  async findByKeys(vendorId: string, phoneKey: string | null, emailKey: string | null) {
    const a = phoneKey ? this.rows.find((r) => r.vendorId === vendorId && r.phoneKey === phoneKey) : undefined;
    const b = emailKey ? this.rows.find((r) => r.vendorId === vendorId && r.emailKey === emailKey) : undefined;
    const r = a ?? b; return r ? this.clone(r) : null;
  }
  async create(vendorId: string, f: CustomerFields & { firstSource: CustomerSource }) {
    // check and insert with no await in between, like the database's unique index: of parallel creates exactly one wins
    const hit = this.rows.find((r) => r.vendorId === vendorId && ((f.phoneKey && r.phoneKey === f.phoneKey) || (f.emailKey && r.emailKey === f.emailKey))); if (hit) return { row: this.clone(hit), created: false };
    const row: CustomerRow = { id: `c${++this.n}`, vendorId, ...f, consent: 'UNKNOWN', consentAt: null, notes: null, tags: [], archivedAt: null, createdAt: new Date(2026, 10, 12, 0, 0, this.n), updatedAt: new Date() };
    this.rows.push(row); return { row: this.clone(row), created: true };
  }
  async update(vendorId: string, id: string, p: CustomerPatch) {
    const r = this.rows.find((x) => x.id === id && x.vendorId === vendorId); if (!r) return null;
    const other = this.rows.find((x) => x.vendorId === vendorId && x.id !== id && ((p.phoneKey && x.phoneKey === p.phoneKey) || (p.emailKey && x.emailKey === p.emailKey)));
    if (other) throw new CustomerKeyTaken(other.id);
    Object.assign(r, Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)), { updatedAt: new Date() });
    return this.clone(r);
  }
  async addSource(vendorId: string, customerId: string, s: { source: CustomerSource; refType: string; refId: string; at: Date }) {
    if (!this.rows.some((r) => r.id === customerId && r.vendorId === vendorId)) return false;
    if (this.sources.some((x) => x.customerId === customerId && x.source === s.source && x.refType === s.refType && x.refId === s.refId)) return false;
    this.sources.push({ id: `s${this.sources.length + 1}`, vendorId, customerId, ...s }); return true;
  }
  async get(vendorId: string, id: string) {
    const r = this.rows.find((x) => x.id === id && x.vendorId === vendorId); if (!r) return null;
    return { row: this.clone(r), sources: this.sources.filter((s) => s.customerId === id && s.vendorId === vendorId) };
  }
  async list(vendorId: string, q: ListQuery) {
    let items = this.rows.filter((r) => r.vendorId === vendorId && (q.includeArchived || !r.archivedAt));
    if (q.source) items = items.filter((r) => this.sources.some((s) => s.customerId === r.id && s.vendorId === vendorId && s.source === q.source));
    if (q.q) { const t = q.q.toLowerCase(); const d = q.q.replace(/[^\d]/g, ''); items = items.filter((r) => r.name.toLowerCase().includes(t) || (r.emailKey ?? '').includes(t) || (d.length >= 3 && (r.phoneKey ?? '').includes(d))); }
    items = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: items.slice(q.skip, q.skip + q.take).map((r) => this.clone(r)), total: items.length };
  }
  async summary(vendorId: string) {
    const live = this.rows.filter((r) => r.vendorId === vendorId && !r.archivedAt);
    const bySource: Record<string, number> = {};
    for (const s of ['SEARCH', 'DIRECTORY', 'BOT', 'CAMPAIGN', 'PAYMENT', 'MANUAL']) bySource[s] = live.filter((r) => this.sources.some((x) => x.customerId === r.id && x.source === s)).length;
    return { total: live.length, bySource };
  }
}
