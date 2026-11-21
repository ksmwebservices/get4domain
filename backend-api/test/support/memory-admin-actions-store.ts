import { MergeCustomer } from '../../src/v3-admin-actions/core/admin-actions-core';
import { AdminActionsStore, MergeRow, NameHistoryRow, NewPlanChange, PlanChangeRow, VendorLite, VisitRow } from '../../src/v3-admin-actions/admin-actions.store';

export class MemoryAdminActionsStore extends AdminActionsStore {
  vendors = new Map<string, VendorLite>(); plans = new Set<string>(['pro_plan', 'free_plan']); history: NameHistoryRow[] = []; changes: PlanChangeRow[] = []; merges: MergeRow[] = [];
  customers = new Map<string, MergeCustomer & { vendorId: string }>(); payees = new Map<string, string[]>(); visits: Array<{ vendorId: string; host: string; day: string; count: number }> = [];
  failMerge = false; private n = 0;
  async vendor(id: string) { return this.vendors.get(id) ?? null; }
  async planExists(key: string) { return this.plans.has(key); }
  async rename(vendorId: string, oldName: string, newName: string, reason: string, actorId: string | null, at: Date) { this.history.push({ id: `h${++this.n}`, vendorId, oldName, newName, reason, actorId, createdAt: at }); this.vendors.get(vendorId)!.businessName = newName; }
  async nameHistory(vendorId: string, skip: number, take: number) { const all = this.history.filter((h) => h.vendorId === vendorId).reverse(); return { items: all.slice(skip, skip + take), total: all.length }; }
  async payeeNames(vendorId: string) { return this.payees.get(vendorId) ?? []; }
  async createPlanChange(d: NewPlanChange) { const r: PlanChangeRow = { id: `c${++this.n}`, vendorId: d.vendorId, planKey: d.planKey, termMonths: d.termMonths, effectiveAt: d.effectiveAt, reason: d.reason, requestedBy: d.requestedBy, status: d.status, appliedAt: d.appliedAt, error: null, createdAt: new Date() }; this.changes.push(r); return r; }
  async listPlanChanges(vendorId: string, skip: number, take: number) { const all = this.changes.filter((c) => c.vendorId === vendorId).reverse(); return { items: all.slice(skip, skip + take), total: all.length }; }
  async getPlanChange(id: string) { return this.changes.find((c) => c.id === id) ?? null; }
  async duePlanChanges(now: Date, limit: number) { return this.changes.filter((c) => c.status === 'PENDING' && c.effectiveAt <= now).slice(0, limit); }
  async claimPlanChange(id: string) { const c = this.changes.find((x) => x.id === id); if (!c || c.status !== 'PENDING') return false; c.status = 'APPLYING'; return true; }
  async finishPlanChange(id: string, status: 'APPLIED' | 'FAILED', at: Date, error: string | null) { const c = this.changes.find((x) => x.id === id); if (c && c.status === 'APPLYING') { c.status = status; c.appliedAt = status === 'APPLIED' ? at : null; c.error = error; } }
  async cancelPlanChange(id: string) { const c = this.changes.find((x) => x.id === id); if (!c || c.status !== 'PENDING') return false; c.status = 'CANCELLED'; return true; }
  async customersOf(vendorId: string) { return [...this.customers.values()].filter((c) => c.vendorId === vendorId); }
  async applyMerge(d: { keepVendorId: string; mergedVendorId: string; reason: string; actorId: string | null; customerIds: string[]; conflicts: Array<{ id: string; because: string }>; reversibleUntil: Date }) {
    if (this.failMerge) throw new Error('unique clash');
    for (const id of d.customerIds) { const c = this.customers.get(id); if (c && c.vendorId === d.mergedVendorId) c.vendorId = d.keepVendorId; }
    const m: MergeRow = { id: `m${++this.n}`, keepVendorId: d.keepVendorId, mergedVendorId: d.mergedVendorId, reason: d.reason, actorId: d.actorId, status: 'APPLIED', moved: { customerIds: d.customerIds }, conflicts: d.conflicts, reversibleUntil: d.reversibleUntil, reversedAt: null, reversedBy: null, reverseReason: null, createdAt: new Date() };
    this.merges.push(m); return m;
  }
  async getMerge(id: string) { return this.merges.find((m) => m.id === id) ?? null; }
  async listMerges(vendorId: string | null, skip: number, take: number) { const all = this.merges.filter((m) => !vendorId || m.keepVendorId === vendorId || m.mergedVendorId === vendorId).reverse(); return { items: all.slice(skip, skip + take), total: all.length }; }
  async reverseMerge(id: string, actorId: string | null, reason: string, at: Date) {
    const m = this.merges.find((x) => x.id === id); if (!m || m.status !== 'APPLIED') return null;
    let restored = 0; for (const cid of m.moved.customerIds) { const c = this.customers.get(cid); if (c && c.vendorId === m.keepVendorId) { c.vendorId = m.mergedVendorId; restored++; } }
    m.status = 'REVERSED'; m.reversedAt = at; m.reversedBy = actorId; m.reverseReason = reason; return { restored, left: m.moved.customerIds.length - restored };
  }
  async addVisits(vendorId: string, rows: ReadonlyArray<VisitRow>) { for (const r of rows) { const e = this.visits.find((v) => v.host === r.host && v.day === r.day); if (e) e.count += r.count; else this.visits.push({ vendorId, ...r }); } }
  async visitsOf(vendorId: string, fromDay: string, toDay: string) { return this.visits.filter((v) => v.vendorId === vendorId && v.day >= fromDay && v.day <= toDay).sort((a, b) => (a.day + a.host).localeCompare(b.day + b.host)).map(({ host, day, count }) => ({ host, day, count })); }
}
