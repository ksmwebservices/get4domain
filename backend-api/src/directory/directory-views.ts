import { BusinessRow, CategoryRow, LocationRow, MediaRow, PlacementRow, ServiceRow } from './directory.repository';

/** Tree helpers and the views a caller is allowed to see (slice 5.7). The public view NEVER carries an email, an owner name, an internal id, a vendor id or a staff field. */
export interface TreeNode { slug: string; name: string; kind?: string; children: TreeNode[] }

function tree<T extends { id: string; parentId: string | null; slug: string; name: string; sortOrder: number; kind?: string }>(rows: readonly T[]): TreeNode[] {
  const by = new Map<string | null, T[]>();
  for (const r of rows) by.set(r.parentId, [...(by.get(r.parentId) ?? []), r]);
  const build = (parent: string | null): TreeNode[] => (by.get(parent) ?? []).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)).map((r) => ({ slug: r.slug, name: r.name, ...(r.kind ? { kind: r.kind } : {}), children: build(r.id) }));
  return build(null);
}
export const locationTree = (rows: readonly LocationRow[]): TreeNode[] => tree(rows);
export const categoryTree = (rows: readonly CategoryRow[]): TreeNode[] => tree(rows);

export function descendantIds<T extends { id: string; parentId: string | null }>(rows: readonly T[], id: string): string[] {
  const out = [id]; const queue = [id];
  while (queue.length) { const cur = queue.shift()!; for (const r of rows) if (r.parentId === cur && !out.includes(r.id)) { out.push(r.id); queue.push(r.id); } }
  return out;
}

export function locationPath(rows: readonly LocationRow[], id: string | null): Array<{ slug: string; name: string }> {
  const out: Array<{ slug: string; name: string }> = []; let cur = id ? rows.find((r) => r.id === id) : undefined; let guard = 0;
  while (cur && guard++ < 10) { out.unshift({ slug: cur.slug, name: cur.name }); cur = cur.parentId ? rows.find((r) => r.id === cur!.parentId) : undefined; }
  return out;
}

/** A location by path ("tamil-nadu/chennai/chennai") or by a slug (the shallowest match wins when several places share it). */
export function resolveLocation(rows: readonly LocationRow[], input: string): LocationRow | null {
  const parts = String(input ?? '').split('/').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 4);
  if (!parts.length) return null;
  let cur: LocationRow | undefined;
  for (const p of parts) { cur = rows.find((r) => r.slug === p && (cur ? r.parentId === cur.id : r.parentId === null)); if (!cur) break; }
  if (cur) return cur;
  if (parts.length === 1) {
    const depth = (r: LocationRow): number => locationPath(rows, r.id).length;
    return [...rows].filter((r) => r.slug === parts[0]).sort((a, b) => depth(a) - depth(b))[0] ?? null;
  }
  return null;
}
export const resolveCategory = (rows: readonly CategoryRow[], slug: string): CategoryRow | null => rows.find((r) => r.slug === String(slug ?? '').trim().toLowerCase()) ?? null;

export interface ViewContext { category: Pick<CategoryRow, 'slug' | 'name'> | null; location: Array<{ slug: string; name: string }>; services: ServiceRow[]; media: MediaRow[]; /** the business own site (slice 5.7b) */ site?: { siteUrl: string | null; siteState: 'SEEDED' | 'CLAIMED_FREE' | 'PRO'; badges: string[] } }

export interface PublicBusinessView {
  slug: string; name: string; claimed: boolean; category: { slug: string; name: string } | null; location: { slug: string; name: string; path: Array<{ slug: string; name: string }> } | null;
  description: string; phone: string | null; address: { line1?: string; line2?: string; pin?: string; city?: string }; hours: Record<string, unknown>; geo: { lat: number; lng: number } | null;
  services: Array<{ name: string; description: string }>; media: Array<{ url: string; altText: string }>; indexable: boolean; updatedAt: string; sponsored?: false;
  /** the business own subdomain site: the ONLY place a visitor is sent (owner rule 1); the directory has no form and delivers no lead */
  siteUrl: string | null; siteState: 'SEEDED' | 'CLAIMED_FREE' | 'PRO'; badges: string[];
}

/** An UNCLAIMED business shows only what identifies it in the directory (name, category, area, description). Phone, street address, hours, map position, services and media
 * appear only after the owner has claimed the profile: their consent. */
export function publicBusinessView(b: BusinessRow, c: ViewContext): PublicBusinessView {
  const claimed = b.status === 'CLAIMED';
  const loc = c.location.length ? c.location[c.location.length - 1] : null;
  return {
    slug: b.slug, name: b.name, claimed, category: c.category ? { slug: c.category.slug, name: c.category.name } : null,
    location: loc ? { slug: loc.slug, name: loc.name, path: c.location } : null, description: b.descriptionText,
    phone: claimed ? b.phoneE164 : null, address: claimed ? { ...b.address } : b.address.city ? { city: b.address.city } : {}, hours: claimed ? { ...b.hours } : {}, geo: claimed ? b.geo : null,
    services: claimed ? c.services.map((s) => ({ name: s.name, description: s.description })) : [], media: claimed ? c.media.map((m) => ({ url: m.url, altText: m.altText })) : [],
    indexable: b.indexable, updatedAt: b.updatedAt.toISOString(), sponsored: false,
    siteUrl: c.site?.siteUrl ?? null, siteState: c.site?.siteState ?? (claimed ? 'CLAIMED_FREE' : 'SEEDED'), badges: c.site?.badges ?? [],
  };
}
export type PublicSponsoredItem = Omit<PublicBusinessView, 'sponsored'> & { sponsored: true; label: string };
export type PublicListItem = PublicBusinessView | PublicSponsoredItem;

export const sponsoredItem = (v: PublicBusinessView, p: PlacementRow): PublicSponsoredItem => { const { sponsored: _s, ...rest } = v; return { ...rest, sponsored: true, label: p.label }; };

/** What staff see. MARKETING gets everything except the personal fields (phone, address, hours, map position, masked email). */
export function staffBusinessView(b: BusinessRow, c: ViewContext, redactPersonal: boolean) {
  const base = {
    id: b.id, slug: b.slug, name: b.name, status: b.status, indexable: b.indexable, source: b.source, vendorLinked: !!b.vendorId, categoryId: b.categoryId, locationId: b.locationId,
    category: c.category, location: c.location, description: b.descriptionText, claimedAt: b.claimedAt, removedAt: b.removedAt, createdAt: b.createdAt, updatedAt: b.updatedAt,
  };
  return redactPersonal ? base : { ...base, phone: b.phoneE164, emailMasked: b.emailMasked, address: b.address, hours: b.hours, geo: b.geo, services: c.services, media: c.media };
}
