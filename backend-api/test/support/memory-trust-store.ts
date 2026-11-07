import { OtpPepper } from '../../src/directory/pepper';
import { BlockKind, ProofKind, ProofStatus, ReportStatus, ReportSubject } from '../../src/v3-trust/core/trust-core';
import { BlocklistService, FakePayeeNameCheck, ProofsService, ReportsService, TakedownService, TermsService, TrustScanService } from '../../src/v3-trust/trust.service';
import { BlockRow, CreateTakedownResult, Paged, ProofRow, ReportRow, TakedownRow, TermRow, TrustStore } from '../../src/v3-trust/trust.store';
import { ActivityWorld, activityWorld } from './memory-activity-store';

export interface MemListing { id: string; vendorId: string | null; status: string; indexable: boolean; removedAt: Date | null }

/**
 * In-memory twin of the Prisma trust store. It mirrors the rules the unit tests rely on: one proof per vendor and kind (a new submission resets to SUBMITTED), a block list unique on kind and hash, a term unique
 * on its folded text, a takedown created or reversed TOGETHER with the change to the listing (one unit), a reversed takedown never changes again, and nothing deletes a takedown.
 */
export class MemoryTrustStore extends TrustStore {
  proofs: ProofRow[] = []; blocks: BlockRow[] = []; reports: ReportRow[] = []; terms: TermRow[] = []; takedowns: TakedownRow[] = [];
  listings: MemListing[] = []; vendors = new Map<string, { businessName: string; name: string }>();
  clock: () => Date = () => new Date(); private n = 0;
  private id(p: string): string { return `${p}-${++this.n}`; }
  private page<T>(all: T[], skip: number, take: number): Paged<T> { return { items: all.slice(skip, skip + take).map((x) => ({ ...x })), total: all.length }; }

  async upsertProof(vendorId: string, d: { kind: ProofKind; number: string; documentRef: string | null }): Promise<ProofRow> {
    const now = this.clock(); const cur = this.proofs.find((p) => p.vendorId === vendorId && p.kind === d.kind);
    if (cur) { Object.assign(cur, { number: d.number, documentRef: d.documentRef, status: 'SUBMITTED', checkedBy: null, checkedAt: null, note: null, updatedAt: now }); return { ...cur }; }
    const row: ProofRow = { id: this.id('proof'), vendorId, kind: d.kind, number: d.number, documentRef: d.documentRef, status: 'SUBMITTED', checkedBy: null, checkedAt: null, note: null, createdAt: now, updatedAt: now };
    this.proofs.push(row); return { ...row };
  }
  async proofsOfVendor(vendorId: string): Promise<ProofRow[]> { return this.proofs.filter((p) => p.vendorId === vendorId).map((p) => ({ ...p })); }
  async listProofs(f: { status?: ProofStatus; vendorId?: string }, skip: number, take: number): Promise<Paged<ProofRow>> { return this.page(this.proofs.filter((p) => (!f.status || p.status === f.status) && (!f.vendorId || p.vendorId === f.vendorId)), skip, take); }
  async getProof(id: string): Promise<ProofRow | null> { const p = this.proofs.find((x) => x.id === id); return p ? { ...p } : null; }
  async reviewProof(id: string, expected: ProofStatus, patch: { status: ProofStatus; checkedBy: string; note: string | null; checkedAt: Date }): Promise<ProofRow | null> {
    const p = this.proofs.find((x) => x.id === id && x.status === expected); if (!p) return null;
    Object.assign(p, patch, { updatedAt: this.clock() }); return { ...p };
  }

  async createBlock(d: { kind: BlockKind; valueHash: string; reason: string; staffId: string | null }): Promise<BlockRow | null> {
    if (this.blocks.some((b) => b.kind === d.kind && b.valueHash === d.valueHash)) return null;
    const row: BlockRow = { id: this.id('block'), kind: d.kind, valueHash: d.valueHash, reason: d.reason, createdByStaffId: d.staffId, at: this.clock() }; this.blocks.push(row); return { ...row };
  }
  async listBlocks(f: { kind?: BlockKind }, skip: number, take: number): Promise<Paged<BlockRow>> { return this.page(this.blocks.filter((b) => !f.kind || b.kind === f.kind), skip, take); }
  async deleteBlock(id: string): Promise<BlockRow | null> { const i = this.blocks.findIndex((b) => b.id === id); if (i < 0) return null; return this.blocks.splice(i, 1)[0]; }
  async findBlock(kind: BlockKind, valueHash: string): Promise<BlockRow | null> { const b = this.blocks.find((x) => x.kind === kind && x.valueHash === valueHash); return b ? { ...b } : null; }

  async createReport(d: { subjectType: ReportSubject; subject: string; reporterContact: string | null; reason: string; ipHash: string | null }): Promise<ReportRow> {
    const now = this.clock(); const row: ReportRow = { id: this.id('report'), ...d, status: 'NEW', handledByStaffId: null, note: null, createdAt: now, updatedAt: now }; this.reports.push(row); return { ...row };
  }
  async listReports(f: { status?: ReportStatus }, skip: number, take: number): Promise<Paged<ReportRow>> { return this.page(this.reports.filter((r) => !f.status || r.status === f.status), skip, take); }
  async getReport(id: string): Promise<ReportRow | null> { const r = this.reports.find((x) => x.id === id); return r ? { ...r } : null; }
  async updateReport(id: string, expected: ReportStatus, patch: { status?: ReportStatus; note?: string | null; handledByStaffId: string | null }): Promise<ReportRow | null> {
    const r = this.reports.find((x) => x.id === id && x.status === expected); if (!r) return null; Object.assign(r, patch, { updatedAt: this.clock() }); return { ...r };
  }

  async listTerms(): Promise<TermRow[]> { return this.terms.map((t) => ({ ...t })); }
  async createTerm(d: { term: string; category: string; enabled: boolean; editedBy: string | null }): Promise<TermRow | null> {
    if (this.terms.some((t) => t.term === d.term)) return null;
    const now = this.clock(); const row: TermRow = { id: this.id('term'), ...d, createdAt: now, updatedAt: now }; this.terms.push(row); return { ...row };
  }
  async updateTerm(id: string, patch: { term?: string; category?: string; enabled?: boolean; editedBy: string | null }): Promise<TermRow | null | 'DUPLICATE'> {
    const t = this.terms.find((x) => x.id === id); if (!t) return null;
    if (patch.term !== undefined && this.terms.some((x) => x.id !== id && x.term === patch.term)) return 'DUPLICATE';
    Object.assign(t, patch, { updatedAt: this.clock() }); return { ...t };
  }
  async deleteTerm(id: string): Promise<TermRow | null> { const i = this.terms.findIndex((t) => t.id === id); return i < 0 ? null : this.terms.splice(i, 1)[0]; }

  async createTakedown(d: { vendorId: string | null; listingId: string | null; reason: string; documentRef: string | null; decidedBy: string; now: Date }): Promise<CreateTakedownResult> {
    if (!d.reason.trim()) throw new Error('database check: reason');
    const listing = d.listingId ? this.listings.find((l) => l.id === d.listingId) : d.vendorId ? this.listings.find((l) => l.vendorId === d.vendorId) : undefined;
    const vendorId = d.vendorId ?? listing?.vendorId ?? null;
    if (d.listingId && !listing) return { ok: false, why: 'TARGET_UNKNOWN' };
    if (vendorId && !this.vendors.has(vendorId)) return { ok: false, why: 'TARGET_UNKNOWN' };
    if (this.takedowns.some((t) => t.status === 'ACTIVE' && ((vendorId && t.vendorId === vendorId) || (listing && t.listingId === listing.id)))) return { ok: false, why: 'ALREADY_ACTIVE' };
    const row: TakedownRow = { id: this.id('td'), vendorId, listingId: listing?.id ?? null, reason: d.reason, documentRef: d.documentRef, decidedBy: d.decidedBy, at: d.now, status: 'ACTIVE', priorListingStatus: listing?.status ?? null, priorIndexable: listing?.indexable ?? null, reversedBy: null, reversedAt: null, reverseReason: null };
    this.takedowns.push(row);
    if (listing && listing.status !== 'REMOVED') Object.assign(listing, { status: 'REMOVED', indexable: false, removedAt: d.now });
    return { ok: true, row: { ...row } };
  }
  async reverseTakedown(id: string, d: { reversedBy: string; reverseReason: string; now: Date }): Promise<TakedownRow | null> {
    const t = this.takedowns.find((x) => x.id === id); if (!t || t.status !== 'ACTIVE') return null;
    Object.assign(t, { status: 'REVERSED', reversedBy: d.reversedBy, reversedAt: d.now, reverseReason: d.reverseReason });
    const l = t.listingId ? this.listings.find((x) => x.id === t.listingId) : undefined;
    if (l && l.status === 'REMOVED' && t.priorListingStatus && t.priorListingStatus !== 'REMOVED') Object.assign(l, { status: t.priorListingStatus, indexable: t.priorIndexable ?? false, removedAt: null });
    return { ...t };
  }
  async getTakedown(id: string): Promise<TakedownRow | null> { const t = this.takedowns.find((x) => x.id === id); return t ? { ...t } : null; }
  async listTakedowns(f: { status?: 'ACTIVE' | 'REVERSED'; vendorId?: string }, skip: number, take: number): Promise<Paged<TakedownRow>> { return this.page(this.takedowns.filter((t) => (!f.status || t.status === f.status) && (!f.vendorId || t.vendorId === f.vendorId)), skip, take); }
  async activeTakedownOfVendor(vendorId: string): Promise<TakedownRow | null> { const t = this.takedowns.find((x) => x.vendorId === vendorId && x.status === 'ACTIVE'); return t ? { ...t } : null; }
  async namesOfVendor(vendorId: string): Promise<string[]> { const v = this.vendors.get(vendorId); return v ? [v.businessName, v.name] : []; }
}

export interface TrustWorld extends ActivityWorld {
  trust: MemoryTrustStore; proofs: ProofsService; blocks: BlocklistService; reports: ReportsService; terms: TermsService; takedowns: TakedownService; scan: TrustScanService; payee: FakePayeeNameCheck;
}
/** The trust services over the in-memory stores, sharing one activity log with the alert rules (so a scan match can be seen to raise an alert). */
export function trustWorld(): TrustWorld {
  const a = activityWorld(); const trust = new MemoryTrustStore(); const pepper = new OtpPepper();
  trust.vendors.set('v1', { businessName: 'Murugan Stores', name: 'K Raman' }); trust.vendors.set('v2', { businessName: 'Other Traders', name: 'S Devi' });
  trust.listings.push({ id: 'l1', vendorId: 'v1', status: 'CLAIMED', indexable: true, removedAt: null }, { id: 'l2', vendorId: 'v2', status: 'CLAIMED', indexable: true, removedAt: null }, { id: 'l3', vendorId: null, status: 'UNCLAIMED', indexable: false, removedAt: null });
  const takedowns = new TakedownService(trust, a.activity);
  return { ...a, trust, proofs: new ProofsService(trust), blocks: new BlocklistService(trust, pepper), reports: new ReportsService(trust, pepper), terms: new TermsService(trust), takedowns, scan: new TrustScanService(trust, a.activity), payee: new FakePayeeNameCheck(trust, a.activity) };
}
