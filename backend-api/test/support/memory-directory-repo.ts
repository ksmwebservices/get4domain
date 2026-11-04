import { RemovalStatus } from '../../src/directory/core/removal';
import { scoreMatch } from '../../src/directory/core/search';
import {
  BusinessPatch, BusinessRow, CategoryRow, ChallengeRow, DirectoryRepository, GrantRow, LocationKind, LocationRow, MediaRow, NewBusiness, OtpStatus, OverrideRow, PlacementRow, RemovalRow,
  SearchQuery, ServiceRow, StaffBusinessQuery,
} from '../../src/directory/directory.repository';
import { Actor } from '../../src/plans/admin/audit.service';
import { DirectoryAudit } from '../../src/directory/directory-audit';

/** In-memory twin of the Prisma directory repository: the same unique rules (slugs, one business per vendor, token hashes), compare-and-set where the database has it. */
export class MemoryDirectoryRepo extends DirectoryRepository {
  locations = new Map<string, LocationRow>(); categories = new Map<string, CategoryRow>(); businesses = new Map<string, BusinessRow>();
  services = new Map<string, ServiceRow[]>(); media = new Map<string, MediaRow[]>(); placements = new Map<string, PlacementRow>(); challenges = new Map<string, ChallengeRow>();
  removals = new Map<string, RemovalRow>(); overrides: OverrideRow[] = []; grants = new Map<string, GrantRow>(); vendors = new Map<string, { id: string; name: string; phone: string | null; email: string }>();
  clock: () => Date = () => new Date();
  private n = 0;
  private id(p: string): string { return `${p}-${++this.n}`; }

  // tree
  async listLocations() { return [...this.locations.values()].filter((l) => l.active).map((l) => ({ ...l })); }
  async getLocation(id: string) { const l = this.locations.get(id); return l ? { ...l } : null; }
  async createLocation(d: { parentId: string | null; kind: LocationKind; name: string; slug: string; sortOrder: number }) {
    const parentKey = d.parentId ?? 'ROOT';
    if ([...this.locations.values()].some((l) => l.parentKey === parentKey && l.slug === d.slug)) throw new Error('duplicate slug');
    const r: LocationRow = { id: this.id('loc'), parentId: d.parentId, parentKey, kind: d.kind, name: d.name, slug: d.slug, sortOrder: d.sortOrder, proposed: false, active: true };
    this.locations.set(r.id, r); return { ...r };
  }
  async updateLocation(id: string, p: Partial<Pick<LocationRow, 'name' | 'slug' | 'sortOrder' | 'active' | 'proposed'>>) {
    const r = this.locations.get(id)!;
    if (p.slug && [...this.locations.values()].some((l) => l.id !== id && l.parentKey === r.parentKey && l.slug === p.slug)) throw new Error('duplicate slug');
    Object.assign(r, p); return { ...r };
  }
  async listCategories() { return [...this.categories.values()].filter((c) => c.active).map((c) => ({ ...c })); }
  async getCategory(id: string) { const c = this.categories.get(id); return c ? { ...c } : null; }
  async createCategory(d: { parentId: string | null; name: string; slug: string; themeCategoryId: string | null; family: string | null; sortOrder: number }) {
    const parentKey = d.parentId ?? 'ROOT';
    if ([...this.categories.values()].some((c) => c.parentKey === parentKey && c.slug === d.slug)) throw new Error('duplicate slug');
    const r: CategoryRow = { id: this.id('cat'), parentId: d.parentId, parentKey, name: d.name, slug: d.slug, themeCategoryId: d.themeCategoryId, family: d.family, sortOrder: d.sortOrder, proposed: false, active: true };
    this.categories.set(r.id, r); return { ...r };
  }
  async updateCategory(id: string, p: Partial<Pick<CategoryRow, 'name' | 'slug' | 'sortOrder' | 'active' | 'proposed' | 'themeCategoryId' | 'family'>>) {
    const r = this.categories.get(id)!;
    if (p.slug && [...this.categories.values()].some((c) => c.id !== id && c.parentKey === r.parentKey && c.slug === p.slug)) throw new Error('duplicate slug');
    Object.assign(r, p); return { ...r };
  }

  // businesses
  private cp(b: BusinessRow | undefined | null): BusinessRow | null { return b ? { ...b, address: { ...b.address } } : null; }
  async getBusiness(id: string) { return this.cp(this.businesses.get(id)); }
  async getBusinessBySlug(slug: string) { return this.cp([...this.businesses.values()].find((b) => b.slug === slug)); }
  async getBusinessByVendor(vendorId: string) { return this.cp([...this.businesses.values()].find((b) => b.vendorId === vendorId)); }
  async slugTaken(slug: string) { return [...this.businesses.values()].some((b) => b.slug === slug); }
  async createBusiness(d: NewBusiness) {
    if ([...this.businesses.values()].some((b) => b.slug === d.slug)) throw new Error('duplicate slug');
    if (d.vendorId && [...this.businesses.values()].some((b) => b.vendorId === d.vendorId)) throw new Error('duplicate vendor');
    const now = this.clock();
    const r: BusinessRow = { ...d, id: this.id('biz'), claimedAt: d.claimedAt ?? null, removedAt: null, createdAt: now, updatedAt: now };
    this.businesses.set(r.id, r); return this.cp(r)!;
  }
  async updateBusiness(id: string, p: BusinessPatch) {
    const r = this.businesses.get(id)!;
    if (p.vendorId && [...this.businesses.values()].some((b) => b.id !== id && b.vendorId === p.vendorId)) throw new Error('duplicate vendor');
    Object.assign(r, p, { updatedAt: this.clock() }); return this.cp(r)!;
  }
  async getServices(id: string) { return (this.services.get(id) ?? []).map((s) => ({ ...s })); }
  async getMedia(id: string) { return (this.media.get(id) ?? []).map((s) => ({ ...s })); }
  async replaceServices(id: string, items: Array<{ name: string; description: string }>) { this.services.set(id, items.map((s, i) => ({ id: this.id('svc'), businessId: id, name: s.name, description: s.description, sortOrder: i }))); }
  async replaceMedia(id: string, items: Array<{ url: string; altText: string; kind?: string }>) { this.media.set(id, items.map((m, i) => ({ id: this.id('med'), businessId: id, url: m.url, altText: m.altText, kind: m.kind ?? 'IMAGE', sortOrder: i }))); }

  private visible(b: BusinessRow): boolean { return b.status === 'CLAIMED' || b.status === 'UNCLAIMED'; }
  private inScope(b: BusinessRow, s: { categoryIds?: string[]; locationIds?: string[] }): boolean {
    return (!s.categoryIds || s.categoryIds.includes(b.categoryId)) && (!s.locationIds || (b.locationId !== null && s.locationIds.includes(b.locationId)));
  }
  async search(q: SearchQuery) {
    const rows = [...this.businesses.values()].filter((b) => this.visible(b) && this.inScope(b, q));
    const scored = rows.map((b) => ({ b, s: q.tokens.length ? scoreMatch(q.tokens, { name: b.name, description: b.descriptionText, category: this.categories.get(b.categoryId)?.name ?? '' }) : 1 })).filter((x) => x.s > 0);
    scored.sort((a, b) => b.s - a.s || a.b.name.localeCompare(b.b.name) || a.b.id.localeCompare(b.b.id));
    return { items: scored.slice(q.skip, q.skip + q.take).map((x) => this.cp(x.b)!), total: scored.length };
  }
  async countPublic(scope: { categoryIds?: string[]; locationIds?: string[] }) { return [...this.businesses.values()].filter((b) => this.visible(b) && this.inScope(b, scope)).length; }
  async sitemapPage(skip: number, take: number) {
    const all = [...this.businesses.values()].filter((b) => this.visible(b) && b.indexable).sort((a, b) => a.slug.localeCompare(b.slug));
    return { items: all.slice(skip, skip + take).map((b) => ({ slug: b.slug, updatedAt: b.updatedAt })), total: all.length };
  }
  async listForStaff(q: StaffBusinessQuery) {
    const all = [...this.businesses.values()].filter((b) => (!q.status || b.status === q.status) && (!q.categoryId || b.categoryId === q.categoryId) && (!q.locationId || b.locationId === q.locationId) && (!q.q || b.name.toLowerCase().includes(q.q.toLowerCase())));
    return { items: all.slice(q.skip, q.skip + q.take).map((b) => this.cp(b)!), total: all.length };
  }

  // placements
  async createPlacement(d: { businessId: string; startsAt: Date; endsAt: Date; label: string; createdByStaffId: string | null }) {
    const r: PlacementRow = { id: this.id('pl'), businessId: d.businessId, kind: 'SPONSORED', startsAt: d.startsAt, endsAt: d.endsAt, label: d.label, createdByStaffId: d.createdByStaffId, revokedAt: null, createdAt: this.clock() };
    this.placements.set(r.id, r); return { ...r };
  }
  async getPlacement(id: string) { const p = this.placements.get(id); return p ? { ...p } : null; }
  async listPlacements(businessId: string) { return [...this.placements.values()].filter((p) => p.businessId === businessId).map((p) => ({ ...p })); }
  async revokePlacement(id: string, now: Date) { const p = this.placements.get(id); if (!p || p.revokedAt) return false; p.revokedAt = now; return true; }
  async activePlacements(now: Date, scope: { categoryIds?: string[]; locationIds?: string[] }, limit: number) {
    return [...this.placements.values()].filter((p) => !p.revokedAt && p.startsAt <= now && p.endsAt > now)
      .map((p) => ({ placement: { ...p }, business: this.businesses.get(p.businessId)! })).filter((x) => x.business && this.visible(x.business) && this.inScope(x.business, scope))
      .sort((a, b) => a.placement.startsAt.getTime() - b.placement.startsAt.getTime() || a.placement.id.localeCompare(b.placement.id)).slice(0, limit).map((x) => ({ placement: x.placement, business: this.cp(x.business)! }));
  }

  // OTP
  async createChallenge(d: Omit<ChallengeRow, 'id' | 'createdAt' | 'attempts' | 'usedAt' | 'status'>) {
    const r: ChallengeRow = { ...d, id: this.id('otp'), attempts: 0, usedAt: null, status: 'PENDING', createdAt: this.clock() };
    this.challenges.set(r.id, r); return { ...r };
  }
  async latestChallenge(t: string, id: string) { const all = [...this.challenges.values()].filter((c) => c.subjectType === t && c.subjectId === id); const c = all[all.length - 1]; return c ? { ...c } : null; }
  async countChallengesSince(by: { phoneHash?: string; ipHash?: string }, since: Date) {
    return [...this.challenges.values()].filter((c) => c.createdAt >= since && ((by.phoneHash && c.phoneHash === by.phoneHash) || (by.ipHash && c.requestIpHash === by.ipHash))).length;
  }
  async applyAttempt(id: string, expected: number, next: { attempts: number; status: OtpStatus; usedAt: Date | null }) {
    const c = this.challenges.get(id); if (!c || c.status !== 'PENDING' || c.attempts !== expected) return false;
    Object.assign(c, next); return true;
  }
  async revokePendingChallenges(t: string, id: string) { for (const c of this.challenges.values()) if (c.subjectType === t && c.subjectId === id && c.status === 'PENDING') c.status = 'REVOKED'; }

  // claim helpers
  async latestOverride(businessId: string) { const l = this.overrides.filter((o) => o.businessId === businessId && !o.revokedAt); return l.length ? { ...l[l.length - 1] } : null; }
  async addOverride(d: { businessId: string; phoneE164: string; phoneHash: string; reason: string; approvedByStaffId: string }) { const r: OverrideRow = { ...d, id: this.id('ovr'), revokedAt: null, createdAt: this.clock() }; this.overrides.push(r); return { ...r }; }
  async vendorBasics(vendorId: string) { const v = this.vendors.get(vendorId); return v ? { ...v } : null; }
  async createGrant(d: { vendorId: string; tokenHash: string; expiresAt: Date }) { const r: GrantRow = { ...d, id: this.id('grant'), status: 'ACTIVE', usedAt: null, createdAt: this.clock() }; this.grants.set(r.id, r); return { ...r }; }
  async findGrantByHash(h: string) { const g = [...this.grants.values()].find((x) => x.tokenHash === h); return g ? { ...g } : null; }
  async consumeGrant(id: string, now: Date) { const g = this.grants.get(id); if (!g || g.status !== 'ACTIVE' || g.expiresAt <= now) return false; g.status = 'USED'; g.usedAt = now; return true; }

  // removal
  async createRemoval(d: { businessId: string; tokenHash: string; reason: string | null; requesterContactMasked: string | null; expiresAt: Date }) {
    const r: RemovalRow = { ...d, id: this.id('rm'), status: 'REQUESTED', confirmedAt: null, handledByStaffId: null, handledAt: null, executedAt: null, createdAt: this.clock() };
    this.removals.set(r.id, r); return { ...r };
  }
  async findRemovalByHash(h: string) { const r = [...this.removals.values()].find((x) => x.tokenHash === h); return r ? { ...r } : null; }
  async getRemoval(id: string) { const r = this.removals.get(id); return r ? { ...r } : null; }
  async listRemovals(q: { status?: RemovalStatus; skip: number; take: number }) { const all = [...this.removals.values()].filter((r) => !q.status || r.status === q.status); return { items: all.slice(q.skip, q.skip + q.take).map((r) => ({ ...r })), total: all.length }; }
  async confirmRemoval(id: string, now: Date) { const r = this.removals.get(id); if (!r || r.confirmedAt || r.status !== 'REQUESTED') return false; r.confirmedAt = now; return true; }
  async moveRemoval(id: string, from: RemovalStatus, to: RemovalStatus, patch: { handledByStaffId?: string | null; handledAt?: Date; executedAt?: Date; reason?: string | null }) {
    const r = this.removals.get(id); if (!r || r.status !== from) return false;
    r.status = to; if (patch.handledByStaffId !== undefined) r.handledByStaffId = patch.handledByStaffId; if (patch.handledAt) r.handledAt = patch.handledAt; if (patch.executedAt) r.executedAt = patch.executedAt; if (patch.reason !== undefined) r.reason = patch.reason; return true;
  }
  async countRecentRemovals(businessId: string, since: Date) { return [...this.removals.values()].filter((r) => r.businessId === businessId && r.createdAt >= since).length; }
}

export class MemoryDirectoryAudit extends DirectoryAudit {
  rows: Array<{ actor: Actor; action: string; entityType: string; entityId: string | null; before: unknown; after: unknown }> = [];
  async record(actor: Actor, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown): Promise<void> { this.rows.push({ actor, action, entityType, entityId, before, after }); }
}
