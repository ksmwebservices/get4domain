import { ListingFacts } from '../../src/vendor-lifecycle/core/lifecycle-core';
import {
  AuditEntry, DeletionRequestRow, DeletionStatus, LifecycleStore, LifecycleSubscription, LifecycleVendor, RemovalArgs,
} from '../../src/vendor-lifecycle/lifecycle.store';

/**
 * In-memory twin of the Prisma lifecycle store. It keeps the rules the database enforces: one open deletion request per vendor, removal is idempotent, the register never loses a row,
 * and an audit row is written with every change. `kept` is the vendor's stored Pro data (theme, content, products...) which NO action here may touch.
 */
export class MemoryLifecycleStore extends LifecycleStore {
  vendors = new Map<string, LifecycleVendor>();
  subs = new Map<string, LifecycleSubscription[]>();   // newest last
  facts = new Map<string, ListingFacts>();
  removals = new Map<string, { kind: string; reason: string; phoneHash: string | null }>();
  register = new Map<string, { reason: string; addedBy: string | null }>();
  deletions = new Map<string, DeletionRequestRow>();
  audits: AuditEntry[] = [];
  directoryRemoved = new Set<string>();
  /** the vendor's kept Pro data: a snapshot proves no lifecycle action changes it */
  kept = new Map<string, Record<string, unknown>>();
  private seq = 0;
  clock: () => Date = () => new Date();

  addVendor(v: Partial<LifecycleVendor> & { id: string }): void { this.vendors.set(v.id, { status: 'ACTIVE', businessName: 'Acme', phone: '+919876543210', email: 'a@x.invalid', ...v }); }

  async vendor(id: string) { const v = this.vendors.get(id); return v ? { ...v } : null; }
  async setVendorStatus(id: string, status: 'ACTIVE' | 'SUSPENDED', audit: AuditEntry) { this.vendors.get(id)!.status = status; this.audits.push(audit); }
  async currentSubscription(id: string) { const l = this.subs.get(id) ?? []; return l.length ? { ...l[l.length - 1] } : null; }
  async latestProSubscription(id: string) { const l = [...(this.subs.get(id) ?? [])].reverse().find((s) => s.level === 'PRO'); return l ? { ...l } : null; }
  async setGraceEnd(subId: string, graceEndsAt: Date, audit: AuditEntry) { for (const l of this.subs.values()) { const s = l.find((x) => x.id === subId); if (s) s.graceEndsAt = graceEndsAt; } this.audits.push(audit); }
  async listingFacts(id: string): Promise<ListingFacts> { return this.facts.get(id) ?? { hasListing: false, phone: null, addressDetail: false, description: null, services: 0, media: 0 }; }
  async isRemoved(id: string) { return this.removals.has(id); }
  async recordAudit(a: AuditEntry) { this.audits.push(a); }

  async pendingDeletion(vendorId: string) { const r = [...this.deletions.values()].find((d) => d.vendorId === vendorId && d.status === 'PENDING'); return r ? { ...r } : null; }
  async createDeletion(d: { vendorId: string; requestedById: string | null; verifiedAt: Date; audit: AuditEntry }) {
    const open = await this.pendingDeletion(d.vendorId); if (open) return open;
    const row: DeletionRequestRow = { id: `del-${++this.seq}`, vendorId: d.vendorId, status: 'PENDING', requestedById: d.requestedById, verifiedAt: d.verifiedAt, executedAt: null, executedById: null, note: null, createdAt: this.clock() };
    this.deletions.set(row.id, row); this.audits.push({ ...d.audit, entityId: row.id });
    return { ...row };
  }
  async getDeletion(id: string) { const r = this.deletions.get(id); return r ? { ...r } : null; }
  async listDeletions(f: { status?: DeletionStatus; skip: number; take: number }) {
    const all = [...this.deletions.values()].filter((d) => !f.status || d.status === f.status);
    return { items: all.slice(f.skip, f.skip + f.take).map((d) => ({ ...d })), total: all.length };
  }
  async executeRemoval(a: RemovalArgs) {
    if (a.deletionRequestId) { const d = this.deletions.get(a.deletionRequestId); if (d && d.status === 'PENDING') { d.status = 'EXECUTED'; d.executedAt = this.clock(); d.executedById = a.executedBy; d.note = a.reason; } }
    if (this.removals.has(a.vendorId)) return { alreadyRemoved: true };
    this.removals.set(a.vendorId, { kind: a.kind, reason: a.reason, phoneHash: a.phoneHash });
    if (a.phoneHash && !this.register.has(a.phoneHash)) this.register.set(a.phoneHash, { reason: a.reason, addedBy: a.executedBy });
    this.directoryRemoved.add(a.vendorId); this.audits.push(a.audit);
    return { alreadyRemoved: false };
  }
}
