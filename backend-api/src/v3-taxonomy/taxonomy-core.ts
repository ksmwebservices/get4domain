/**
 * Lane E1 taxonomy: pure rules. No file system, database or clock.
 * Vocabulary: Family = top level (the 45). Category = second level (the 1,213 unique items). Service = third level (lane E4, not here).
 */
export interface MasterFamily { order: number; slug: string; name: string; plannedPackKey: string }
export interface MasterCategory { slug: string; name: string }
export interface MasterLink { family: string; category: string }
export interface MasterFile { source: string; version: number; listedLinks: number; families: MasterFamily[]; categories: MasterCategory[]; links: MasterLink[] }
export interface AliasRow { legacyKey: string; category: string; reason: string }
export interface AliasFile { needsOwnerReview: boolean; aliases: AliasRow[] }
export interface RelatedPair { a: string; b: string; reason: string }
export interface RelatedFile { needsOwnerReview: boolean; pairs: RelatedPair[] }
export interface LegacyCategory { categoryKey: string; name: string }
export type MatchKind = 'EXACT' | 'ALIAS';
export interface LegacyMatch { legacyKey: string; categorySlug: string; kind: MatchKind }

export const EXPECTED = { families: 45, listedLinks: 1277, uniqueCategories: 1213, multiFamily: 61 } as const;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Stable slug: lowercase, "&" read as "and", every run of other characters becomes one hyphen. Same rule as scripts/lib/category-master-45-lib.js (a test keeps them equal). */
export function slugify(name: string): string {
  return name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const sourceTag = (m: Pick<MasterFile, 'source' | 'version'>): string => `${m.source}@${m.version}`;

/** How many categories are linked to more than one family. */
export function multiFamilyCount(m: MasterFile): number {
  const n = new Map<string, number>();
  for (const l of m.links) n.set(l.category, (n.get(l.category) ?? 0) + 1);
  let c = 0;
  for (const v of n.values()) if (v > 1) c += 1;
  return c;
}

/** Every problem in the master file (empty = fine). Checks the owner's counts, slug shape and uniqueness, and that every link points at a real family and category. */
export function validateMaster(m: MasterFile): string[] {
  const p: string[] = [];
  if (m.families.length !== EXPECTED.families) p.push(`families: ${m.families.length}, expected ${EXPECTED.families}`);
  if (m.links.length !== EXPECTED.listedLinks) p.push(`listed links: ${m.links.length}, expected ${EXPECTED.listedLinks}`);
  if (m.categories.length !== EXPECTED.uniqueCategories) p.push(`unique categories: ${m.categories.length}, expected ${EXPECTED.uniqueCategories}`);
  const multi = multiFamilyCount(m);
  if (multi !== EXPECTED.multiFamily) p.push(`categories in several families: ${multi}, expected ${EXPECTED.multiFamily}`);
  const fam = new Set<string>(); const cat = new Set<string>(); const orders = new Set<number>(); const packs = new Set<string>();
  for (const f of m.families) {
    if (!SLUG.test(f.slug)) p.push(`family slug "${f.slug}" is not a lowercase slug`);
    if (fam.has(f.slug)) p.push(`family slug "${f.slug}" is listed twice`);
    if (orders.has(f.order)) p.push(`family order ${f.order} is listed twice`);
    if (packs.has(f.plannedPackKey)) p.push(`planned pack key "${f.plannedPackKey}" is used twice`);
    if (!/^[A-Z][A-Z0-9_]*$/.test(f.plannedPackKey)) p.push(`planned pack key "${f.plannedPackKey}" is not UPPER_SNAKE_CASE`);
    fam.add(f.slug); orders.add(f.order); packs.add(f.plannedPackKey);
  }
  for (const c of m.categories) {
    if (!SLUG.test(c.slug)) p.push(`category slug "${c.slug}" is not a lowercase slug`);
    if (cat.has(c.slug)) p.push(`category slug "${c.slug}" is listed twice`);
    if (slugify(c.name) !== c.slug) p.push(`category "${c.name}" does not match its slug "${c.slug}"`);
    cat.add(c.slug);
  }
  const seen = new Set<string>();
  const used = new Set<string>();
  for (const l of m.links) {
    if (!fam.has(l.family)) p.push(`link names an unknown family "${l.family}"`);
    if (!cat.has(l.category)) p.push(`link names an unknown category "${l.category}"`);
    const k = `${l.family}|${l.category}`;
    if (seen.has(k)) p.push(`link ${k} is listed twice`);
    seen.add(k); used.add(l.category);
  }
  for (const c of cat) if (!used.has(c)) p.push(`category "${c}" is linked to no family`);
  return p;
}

/** Problems in the related-families map: unknown families, a family related to itself, a pair stored twice in either direction, a family with no relation at all. */
export function validateRelated(r: RelatedFile, familySlugs: readonly string[]): string[] {
  const p: string[] = [];
  const known = new Set(familySlugs);
  const seen = new Set<string>();
  const touched = new Set<string>();
  for (const x of r.pairs) {
    if (!known.has(x.a) || !known.has(x.b)) { p.push(`related pair ${x.a} / ${x.b} names an unknown family`); continue; }
    if (x.a === x.b) { p.push(`family ${x.a} is related to itself`); continue; }
    if (!x.reason || x.reason.trim().length < 5) p.push(`related pair ${x.a} / ${x.b} has no reason`);
    const k = [x.a, x.b].sort().join('|');
    if (seen.has(k)) p.push(`related pair ${k} is listed twice (the relation is symmetric, store it once)`);
    seen.add(k); touched.add(x.a); touched.add(x.b);
  }
  for (const f of familySlugs) if (!touched.has(f)) p.push(`family ${f} has no related family`);
  return p;
}

/** The related families of one family, both directions followed. */
export function relatedOf(r: RelatedFile, family: string): Array<{ family: string; reason: string }> {
  const out: Array<{ family: string; reason: string }> = [];
  for (const x of r.pairs) { if (x.a === family) out.push({ family: x.b, reason: x.reason }); else if (x.b === family) out.push({ family: x.a, reason: x.reason }); }
  return out;
}

/** A vendor may pick categories from its own family and from the families related to it. */
export function allowedFamilies(r: RelatedFile, family: string): string[] {
  return [family, ...relatedOf(r, family).map((x) => x.family)];
}

/** Problems in the alias table: a target that is not a category of the master, a legacy key listed twice. */
export function validateAliases(a: AliasFile, categorySlugs: ReadonlySet<string>): string[] {
  const p: string[] = []; const seen = new Set<string>();
  for (const x of a.aliases) {
    if (!categorySlugs.has(x.category)) p.push(`alias ${x.legacyKey}: "${x.category}" is not a category of the master`);
    if (seen.has(x.legacyKey)) p.push(`alias ${x.legacyKey} is listed twice`);
    seen.add(x.legacyKey);
  }
  return p;
}

/** Exact name first (the slug of the existing name equals a master slug), then the reviewed alias table. Whatever is left is unmatched: the owner decides. */
export function matchLegacy(legacy: readonly LegacyCategory[], categorySlugs: ReadonlySet<string>, aliases: AliasFile): { matched: LegacyMatch[]; unmatched: LegacyCategory[] } {
  const alias = new Map(aliases.aliases.map((x) => [x.legacyKey, x.category] as const));
  const matched: LegacyMatch[] = []; const unmatched: LegacyCategory[] = [];
  for (const c of legacy) {
    const exact = slugify(c.name);
    const viaAlias = alias.get(c.categoryKey);
    if (categorySlugs.has(exact)) matched.push({ legacyKey: c.categoryKey, categorySlug: exact, kind: 'EXACT' });
    else if (viaAlias !== undefined && categorySlugs.has(viaAlias)) matched.push({ legacyKey: c.categoryKey, categorySlug: viaAlias, kind: 'ALIAS' });
    else unmatched.push(c);
  }
  return { matched, unmatched };
}
