import { NameCandidate, normaliseArea, normaliseBusinessName, trigramSimilarity } from '../../src/v3-duplicates/core/duplicate-core';
import { DuplicateStore, Hit, HostHit, NameQuery, OverrideRecord, PublicListing, ReviewRow } from '../../src/v3-duplicates/duplicate.store';

export interface MemVendor { id: string; email: string; phone: string | null; phoneKey: string | null; name: string; businessName: string; industry: string | null; address: string | null; subdomain: string | null; customDomain: string | null; sandboxExpiring?: boolean; gstin?: string }
export interface MemListing { id: string; slug: string; name: string; vendorId: string | null; status: 'UNCLAIMED' | 'CLAIMED' | 'REMOVED'; phoneE164: string | null; pincode: string | null; line1?: string; line2?: string; city?: string; category: string }

/** In-memory twin of PrismaDuplicateStore: the same rules (demo sandboxes never count, a row without a phoneKey is found by its raw phone, the medium judgments) over plain arrays. */
export class MemoryDuplicateStore extends DuplicateStore {
  vendors: MemVendor[] = []; listings: MemListing[] = []; hosts: Array<{ hostname: string; vendorId: string }> = [];
  overrides: Array<OverrideRecord & { id: string }> = []; reviews: ReviewRow[] = [];
  private real = (v: MemVendor): boolean => !v.sandboxExpiring;

  async vendorsByEmail(email: string, ex: string | null) { return this.vendors.filter((v) => this.real(v) && v.id !== ex && v.email.toLowerCase() === email).map((v) => v.id); }
  async byPhone(key: string, e164: string | null, ex: string | null): Promise<Hit[]> {
    const out: Hit[] = [];
    for (const v of this.vendors) if (this.real(v) && v.id !== ex && (v.phoneKey === key || (v.phoneKey === null && (v.phone ?? '').replace(/\D/g, '').slice(-10) === key))) out.push({ vendorId: v.id, businessId: null, attachable: false });
    if (e164) for (const l of this.listings) if (l.status !== 'REMOVED' && l.phoneE164 === e164 && (ex === null || l.vendorId !== ex)) out.push({ vendorId: l.vendorId, businessId: l.id, attachable: l.vendorId === null && l.status === 'UNCLAIMED' });
    return out;
  }
  async vendorsByGstin(g: string, ex: string | null) { return this.vendors.filter((v) => v.gstin?.toUpperCase() === g && v.id !== ex).map((v) => v.id); }
  async byHosts(hs: string[], ex: string | null): Promise<HostHit[]> {
    const out: HostHit[] = [];
    for (const h of this.hosts) if (hs.includes(h.hostname) && h.vendorId !== ex) out.push({ vendorId: h.vendorId, via: 'WEBSITE' });
    for (const v of this.vendors) if (v.id !== ex && v.customDomain && hs.some((h) => [h, `www.${h}`].includes(v.customDomain!.toLowerCase()))) out.push({ vendorId: v.id, via: 'CUSTOM_DOMAIN' });
    return out;
  }
  async nameCandidates(q: NameQuery): Promise<NameCandidate[]> {
    const area = normaliseArea(q.area); const owner = normaliseBusinessName(q.ownerName ?? ''); const out: NameCandidate[] = [];
    const withListing = new Set(this.listings.map((l) => l.vendorId).filter(Boolean));
    for (const l of this.listings) {
      if (l.status === 'REMOVED' || (l.vendorId !== null && l.vendorId === q.excludeVendorId)) continue;
      const v = this.vendors.find((x) => x.id === l.vendorId); if (v && !this.real(v)) continue;
      const sim = trigramSimilarity(normaliseBusinessName(l.name), normaliseBusinessName(q.name)); if (sim < 0.4) continue;
      out.push({ vendorId: l.vendorId, businessId: l.id, attachable: l.vendorId === null && l.status === 'UNCLAIMED', similarity: sim, locationMatch: (!!q.pincode && l.pincode === q.pincode) || (!!area && normaliseArea(l.line2) === area), categoryMatch: !!q.category && l.category === q.category, ownerMatch: !!owner && !!v && normaliseBusinessName(v.name) === owner, addressMatch: !!q.address && !!l.line1 && trigramSimilarity(l.line1, q.address) >= 0.5 });
    }
    for (const v of this.vendors) {
      if (!this.real(v) || v.id === q.excludeVendorId || withListing.has(v.id)) continue;
      const sim = trigramSimilarity(normaliseBusinessName(v.businessName), normaliseBusinessName(q.name)); if (sim < 0.4) continue;
      const addr = (v.address ?? '').toLowerCase();
      out.push({ vendorId: v.id, businessId: null, attachable: false, similarity: sim, locationMatch: (!!q.pincode && addr.includes(q.pincode)) || (!!area && normaliseArea(addr).includes(area)), categoryMatch: !!q.category && v.industry === q.category, ownerMatch: !!owner && normaliseBusinessName(v.name) === owner, addressMatch: !!q.address && addr !== '' && trigramSimilarity(addr, q.address) >= 0.5 });
    }
    return out;
  }
  async subdomainsNear(slug: string) { const half = Math.max(3, Math.ceil(slug.length / 2)); return this.vendors.flatMap((v) => (v.subdomain && (v.subdomain.includes(slug.slice(0, half)) || v.subdomain.includes(slug.slice(-half))) ? [v.subdomain] : [])); }
  async publicListings(bIds: string[], vIds: string[]): Promise<PublicListing[]> {
    return this.listings.filter((l) => l.status !== 'REMOVED' && (bIds.includes(l.id) || (l.vendorId && vIds.includes(l.vendorId)))).map((l) => ({ businessId: l.id, slug: l.slug, name: l.name, category: l.category, city: l.city ?? null, area: l.line2 ?? null, claimable: l.status === 'UNCLAIMED' }));
  }
  async vendorBasics(ids: string[]) { return this.vendors.filter((v) => ids.includes(v.id)).map((v) => ({ id: v.id, businessName: v.businessName, subdomain: v.subdomain, industry: v.industry, createdAt: new Date('2026-11-01T00:00:00Z') })); }
  async recordOverride(o: OverrideRecord) { const id = `ov${this.overrides.length + 1}`; this.overrides.push({ ...o, id }); return { id }; }
  async isHeld(vendorId: string) { return this.reviews.some((r) => r.vendorId === vendorId && r.status !== 'CLEARED'); }
  async listReviews(status: string | null, skip: number, take: number) { const all = this.reviews.filter((r) => !status || r.status === status); return { items: all.slice(skip, skip + take), total: all.length }; }
  async getReview(id: string) { return this.reviews.find((r) => r.id === id) ?? null; }
  async decideReview(id: string, d: { status: 'CLEARED' | 'REJECTED'; staffId: string; reason: string; now: Date }) {
    const r = this.reviews.find((x) => x.id === id && x.status === 'PENDING'); if (!r) return false;
    Object.assign(r, { status: d.status, decidedByStaffId: d.staffId, decisionReason: d.reason, decidedAt: d.now }); return true;
  }
  /** what the vendor-create transaction writes (the real one passes the same data to `tx.v3DuplicateReview.create`) */
  addReview(data: { path: string; vendorId: string; matchedVendorId: string | null; matchedBusinessId: string | null; matchedSignals: string[]; score: number | null }) {
    this.reviews.push({ id: `rv${this.reviews.length + 1}`, status: 'PENDING', decidedByStaffId: null, decisionReason: null, decidedAt: null, createdAt: new Date(), ...data });
  }
}
