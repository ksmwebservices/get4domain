/** The directory seed file (prisma/seed/v3-directory.seed.json): PROPOSED data the owner reviews and extends. Validation only; no database. */
export type LocationKind = 'STATE' | 'DISTRICT' | 'CITY';
export interface SeedLocation { key: string; parent: string | null; kind: LocationKind; name: string; slug: string; sortOrder: number; proposed: boolean }
export interface SeedCategory { key: string; parent: string | null; name: string; slug: string; themeCategoryId: string | null; family: string | null; sortOrder: number; proposed: boolean }
export interface DirectorySeed { schemaVersion: number; status: string; note: string; missing: string[]; locations: SeedLocation[]; categories: SeedCategory[] }

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PARENT_KIND: Record<LocationKind, LocationKind | null> = { STATE: null, DISTRICT: 'STATE', CITY: 'DISTRICT' };

/** Every problem found, in plain words (empty = valid). A child must come after its parent, every row must be marked proposed, and slugs are unique per parent. */
export function validateDirectorySeed(seed: DirectorySeed, knownThemeCategories: readonly string[]): string[] {
  const errors: string[] = [];
  if (seed.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!Array.isArray(seed.missing)) errors.push('missing must be a list');

  const seenLoc = new Map<string, SeedLocation>(); const slugsLoc = new Set<string>();
  for (const l of seed.locations ?? []) {
    if (seenLoc.has(l.key)) errors.push(`location ${l.key}: duplicate key`);
    if (l.proposed !== true) errors.push(`location ${l.key}: must be marked proposed`);
    if (!SLUG.test(l.slug)) errors.push(`location ${l.key}: slug must be lowercase words joined by hyphens`);
    if (!l.name || !l.name.trim()) errors.push(`location ${l.key}: name is empty`);
    const wantParentKind = PARENT_KIND[l.kind];
    if (wantParentKind === undefined) errors.push(`location ${l.key}: unknown kind`);
    else if (l.parent === null) { if (wantParentKind !== null) errors.push(`location ${l.key}: a ${l.kind} needs a parent`); }
    else {
      const p = seenLoc.get(l.parent);
      if (!p) errors.push(`location ${l.key}: parent ${l.parent} must appear earlier in the file`);
      else if (p.kind !== wantParentKind) errors.push(`location ${l.key}: kind ${l.kind} cannot sit under a ${p.kind}`);
    }
    const slugKey = `${l.parent ?? 'ROOT'}/${l.slug}`;
    if (slugsLoc.has(slugKey)) errors.push(`location ${l.key}: slug ${l.slug} is used twice under the same parent`);
    slugsLoc.add(slugKey); seenLoc.set(l.key, l);
  }

  const seenCat = new Map<string, SeedCategory>(); const slugsCat = new Set<string>(); const themeUsed = new Set<string>();
  for (const c of seed.categories ?? []) {
    if (seenCat.has(c.key)) errors.push(`category ${c.key}: duplicate key`);
    if (c.proposed !== true) errors.push(`category ${c.key}: must be marked proposed`);
    if (!SLUG.test(c.slug)) errors.push(`category ${c.key}: slug must be lowercase words joined by hyphens`);
    if (!c.name || !c.name.trim()) errors.push(`category ${c.key}: name is empty`);
    if (c.parent !== null && !seenCat.has(c.parent)) errors.push(`category ${c.key}: parent ${c.parent} must appear earlier in the file`);
    if (c.themeCategoryId !== null) {
      if (!knownThemeCategories.includes(c.themeCategoryId)) errors.push(`category ${c.key}: theme category ${c.themeCategoryId} is not a theme kit category`);
      if (themeUsed.has(c.themeCategoryId)) errors.push(`category ${c.key}: theme category ${c.themeCategoryId} is mapped twice`);
      themeUsed.add(c.themeCategoryId);
    }
    const slugKey = `${c.parent ?? 'ROOT'}/${c.slug}`;
    if (slugsCat.has(slugKey)) errors.push(`category ${c.key}: slug ${c.slug} is used twice under the same parent`);
    slugsCat.add(slugKey); seenCat.set(c.key, c);
  }
  return errors;
}
