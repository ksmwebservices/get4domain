import { LedgerStatus } from '../../src/v3-referrals/core/referral-core';
import { PartnerFields } from '../../src/v3-partners/core/partner-core';
import { PartnerRow, PartnersStore, StaffMemberRef } from '../../src/v3-partners/partners.store';
import { AttributionRow, LedgerRow, LinkRow, PayoutRow, ReferralsStore, SlabRow, VendorFacts } from '../../src/v3-referrals/referrals.store';

/** In-memory partners and referral tables for the unit tests, with the same uniqueness rules as the database (one attribution and one ledger line per vendor, one payout per partner and month, unique codes). */
export class MemoryPartnersStore extends PartnersStore {
  rows: PartnerRow[] = []; staff = new Map<string, StaffMemberRef>(); n = 0;
  add(f: Partial<PartnerFields> & { name: string; email: string }): PartnerRow { const r: PartnerRow = { id: `p${++this.n}`, type: 'FREELANCER', phone: null, status: 'ACTIVE', staffUserId: null, ...f, createdById: null, createdAt: new Date(), updatedAt: new Date() }; this.rows.push(r); return r; }
  async list(i: { status?: string; type?: string; skip: number; take: number }) { const all = this.rows.filter((r) => (!i.status || r.status === i.status) && (!i.type || r.type === i.type)); return { items: all.slice(i.skip, i.skip + i.take), total: all.length }; }
  async get(id: string) { return this.rows.find((r) => r.id === id) ?? null; }
  async getByStaffUser(s: string) { return this.rows.find((r) => r.staffUserId === s) ?? null; }
  async getByEmail(e: string) { return this.rows.find((r) => r.email === e) ?? null; }
  async create(f: PartnerFields, by: string | null) { const r = this.add({ ...f }); r.createdById = by; return r; }
  async update(id: string, patch: Partial<PartnerFields>) { const r = this.rows.find((x) => x.id === id); if (!r) return null; Object.assign(r, patch); return r; }
  async staffMember(id: string) { return this.staff.get(id) ?? null; }
}

export class MemoryReferralsStore extends ReferralsStore {
  links: LinkRow[] = []; attributions: AttributionRow[] = []; slabs: SlabRow[] = []; lines: LedgerRow[] = []; payouts: PayoutRow[] = []; vendors = new Map<string, VendorFacts>();
  failNext = false; private n = 0; private id(p: string): string { return `${p}${++this.n}`; }
  private boom(): void { if (this.failNext) { this.failNext = false; throw new Error('db down'); } }
  addVendor(v: Partial<VendorFacts> & { id: string }): VendorFacts { const f: VendorFacts = { email: `${v.id}@x.invalid`, phone: null, businessName: `Business ${v.id}`, state: null, ...v }; this.vendors.set(f.id, f); return f; }

  async createLink(partnerId: string, code: string, createdById: string | null) { if (this.links.some((l) => l.code === code)) return null; const r: LinkRow = { id: this.id('lnk'), partnerId, code, active: true, createdById, disabledAt: null, createdAt: new Date() }; this.links.push(r); return { ...r }; }
  async getLinkByCode(code: string) { const r = this.links.find((l) => l.code === code); return r ? { ...r } : null; }
  async getLink(id: string) { const r = this.links.find((l) => l.id === id); return r ? { ...r } : null; }
  async listLinks(partnerId: string) { return this.links.filter((l) => l.partnerId === partnerId).map((l) => ({ ...l })).reverse(); }
  async setLinkActive(id: string, active: boolean, at: Date) { const r = this.links.find((l) => l.id === id); if (!r) return null; r.active = active; r.disabledAt = active ? null : at; return { ...r }; }

  async getAttribution(vendorId: string) { this.boom(); const r = this.attributions.find((a) => a.vendorId === vendorId); return r ? { ...r } : null; }
  async createAttribution(r: Omit<AttributionRow, 'id' | 'createdAt'>) { const ex = this.attributions.find((a) => a.vendorId === r.vendorId); if (ex) return { created: false, row: { ...ex } }; const row: AttributionRow = { ...r, id: this.id('att'), createdAt: new Date() }; this.attributions.push(row); return { created: true, row: { ...row } }; }
  async replaceAttribution(vendorId: string, patch: { partnerId: string; linkId: string | null; source: 'ADMIN_CHANGE'; setById: string | null; reason: string | null }) { const r = this.attributions.find((a) => a.vendorId === vendorId); if (!r) return null; Object.assign(r, patch); return { ...r }; }
  async attributionsOfPartner(partnerId: string, skip: number, take: number) { const all = this.attributions.filter((a) => a.partnerId === partnerId); return { items: all.slice(skip, skip + take).map((a) => ({ ...a, vendor: this.vendors.get(a.vendorId) ?? null })), total: all.length }; }
  async vendorFacts(vendorId: string) { const v = this.vendors.get(vendorId); return v ? { ...v } : null; }

  async listSlabs() { return [...this.slabs].sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime() || a.minVendors - b.minVendors).map((s) => ({ ...s })); }
  async getSlab(id: string) { const r = this.slabs.find((s) => s.id === id); return r ? { ...r } : null; }
  async createSlab(r: Omit<SlabRow, 'id'>) { const row: SlabRow = { ...r, id: this.id('slab') }; this.slabs.push(row); return { ...row }; }
  async updateSlab(id: string, r: Partial<Omit<SlabRow, 'id'>>) { const row = this.slabs.find((s) => s.id === id); if (!row) return null; Object.assign(row, r); return { ...row }; }

  async getLineByVendor(vendorId: string) { const r = this.lines.find((l) => l.vendorId === vendorId); return r ? { ...r } : null; }
  async createLine(r: Parameters<ReferralsStore['createLine']>[0]) { this.boom(); const ex = this.lines.find((l) => l.vendorId === r.vendorId); if (ex) return { created: false, row: { ...ex } }; const row: LedgerRow = { ...r, id: this.id('led'), amountMinor: null, status: 'ACCRUED', flagged: false, flagReason: null, approvedAt: null, payoutId: null, createdAt: new Date() }; this.lines.push(row); return { created: true, row: { ...row } }; }
  async linesOfMonth(month: string) { return this.lines.filter((l) => l.month === month).map((l) => ({ ...l })); }
  async linesOfPartnerMonth(partnerId: string, month: string) { return this.lines.filter((l) => l.partnerId === partnerId && l.month === month).map((l) => ({ ...l })); }
  async listLines(q: { month?: string; partnerId?: string; status?: LedgerStatus; skip: number; take: number }) { const all = this.lines.filter((l) => (!q.month || l.month === q.month) && (!q.partnerId || l.partnerId === q.partnerId) && (!q.status || l.status === q.status)).sort((a, b) => b.month.localeCompare(a.month) || a.id.localeCompare(b.id)); return { items: all.slice(q.skip, q.skip + q.take).map((l) => ({ ...l })), total: all.length }; }
  async approveLines(items: Array<{ id: string; amountMinor: number }>, at: Date) { let n = 0; for (const i of items) { const l = this.lines.find((x) => x.id === i.id); if (l && l.status === 'ACCRUED') { l.status = 'APPROVED'; l.amountMinor = i.amountMinor; l.approvedAt = at; n++; } } return n; }
  async reverseLine(vendorId: string, reason: string) { const l = this.lines.find((x) => x.vendorId === vendorId); if (!l) return null; if (l.status !== 'REVERSED') { l.status = 'REVERSED'; l.flagged = true; l.flagReason = reason; } return { ...l }; }

  async getPayout(partnerId: string, month: string) { const r = this.payouts.find((p) => p.partnerId === partnerId && p.month === month); return r ? { ...r } : null; }
  async createPayout(p: { partnerId: string; month: string; totalMinor: number; reference: string; paidById: string | null; paidAt: Date }, lineIds: string[]) {
    if (this.payouts.some((x) => x.partnerId === p.partnerId && x.month === p.month)) return null;
    const row: PayoutRow = { ...p, id: this.id('pay'), status: 'PAID', createdAt: new Date() };
    for (const id of lineIds) { const l = this.lines.find((x) => x.id === id); if (!l || l.status !== 'APPROVED') throw new Error('the ledger changed while the payout was being recorded'); }
    for (const id of lineIds) { const l = this.lines.find((x) => x.id === id)!; l.status = 'PAID'; l.payoutId = row.id; }
    this.payouts.push(row); return { ...row };
  }
  async listPayouts(q: { partnerId?: string; month?: string; skip: number; take: number }) { const all = this.payouts.filter((p) => (!q.partnerId || p.partnerId === q.partnerId) && (!q.month || p.month === q.month)); return { items: all.slice(q.skip, q.skip + q.take).map((p) => ({ ...p })), total: all.length }; }
}
