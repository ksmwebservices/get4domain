import {
  AliasFile, LegacyCategory, LegacyMatch, MasterFile, matchLegacy, RelatedFile, sourceTag, validateAliases, validateMaster, validateRelated,
} from './taxonomy-core';

/** Everything the loader needs from storage, in slugs (never ids), so it runs the same against Prisma and against memory. There is NO method that writes the existing registration categories (g4d_pack_categories): the loader cannot change them. */
export abstract class TaxonomyStore {
  abstract listFamilies(): Promise<Array<{ slug: string; name: string; sortOrder: number; plannedPackKey: string }>>;
  abstract listCategories(): Promise<Array<{ slug: string; name: string }>>;
  abstract listLinks(): Promise<Array<{ family: string; category: string }>>;
  /** each existing pair once, as the two family slugs in alphabetical order */
  abstract listRelated(): Promise<Array<{ a: string; b: string }>>;
  abstract listLegacyMaps(): Promise<Array<{ legacyKey: string }>>;
  abstract listLegacyCategories(): Promise<LegacyCategory[]>;
  abstract createFamilies(rows: Array<{ slug: string; name: string; sortOrder: number; plannedPackKey: string; sourceTag: string }>): Promise<void>;
  abstract createCategories(rows: Array<{ slug: string; name: string; sourceTag: string }>): Promise<void>;
  abstract createLinks(rows: Array<{ family: string; category: string; sortOrder: number }>): Promise<void>;
  abstract createRelated(rows: Array<{ a: string; b: string; reason: string }>): Promise<void>;
  abstract createLegacyMaps(rows: Array<{ legacyKey: string; category: string; kind: LegacyMatch['kind']; sourceTag: string }>): Promise<void>;
}

export interface TableCount { total: number; toCreate: number; existing: number; created: number }
export interface TaxonomyLoadResult {
  refused: boolean; problems: string[];
  families: TableCount; categories: TableCount; links: TableCount; related: TableCount; legacy: TableCount;
  /** existing rows whose name or planned pack key differs from the file (left as they are) */
  differs: string[];
  legacyTotal: number; legacyExact: number; legacyAlias: number; legacyAlreadyMapped: number;
  unmatched: LegacyCategory[];
  needsOwnerReview: { aliasTable: boolean; relatedMap: boolean };
}
export interface TaxonomyFiles { master: MasterFile; aliases: AliasFile; related: RelatedFile }

const count = (total: number, toCreate: number): TableCount => ({ total, toCreate, existing: total - toCreate, created: 0 });

/**
 * Loads the 45-family taxonomy. A DRY RUN unless told to apply. IDEMPOTENT: it creates what is missing and never changes or deletes a row that exists (a row that differs from the file is only named).
 * An apply is refused while any data file has a problem. It also maps the existing registration categories into the structure (exact name, then the reviewed alias table) and lists the ones it could not place.
 */
export async function loadTaxonomy(store: TaxonomyStore, files: TaxonomyFiles, opts: { apply: boolean }): Promise<TaxonomyLoadResult> {
  const { master, aliases, related } = files;
  const tag = sourceTag(master);
  const categorySlugs = new Set(master.categories.map((c) => c.slug));
  const problems = [
    ...validateMaster(master), ...validateRelated(related, master.families.map((f) => f.slug)), ...validateAliases(aliases, categorySlugs),
  ];

  const [haveF, haveC, haveL, haveR, haveM, legacy] = await Promise.all([
    store.listFamilies(), store.listCategories(), store.listLinks(), store.listRelated(), store.listLegacyMaps(), store.listLegacyCategories(),
  ]);
  const famHave = new Map(haveF.map((f) => [f.slug, f] as const));
  const catHave = new Map(haveC.map((c) => [c.slug, c] as const));
  const linkHave = new Set(haveL.map((l) => `${l.family}|${l.category}`));
  const relHave = new Set(haveR.map((r) => [r.a, r.b].sort().join('|')));
  const mapHave = new Set(haveM.map((m) => m.legacyKey));

  const differs: string[] = [];
  const newFamilies = master.families.filter((f) => {
    const h = famHave.get(f.slug);
    if (h && (h.name !== f.name || h.plannedPackKey !== f.plannedPackKey || h.sortOrder !== f.order)) differs.push(`family ${f.slug}`);
    return !h;
  });
  const newCategories = master.categories.filter((c) => {
    const h = catHave.get(c.slug);
    if (h && h.name !== c.name) differs.push(`category ${c.slug}`);
    return !h;
  });
  // position of a category inside its family's list = its index among that family's links in file order
  const position = new Map<string, number>();
  const newLinks = master.links.flatMap((l) => {
    const n = (position.get(l.family) ?? 0) + 1;
    position.set(l.family, n);
    return linkHave.has(`${l.family}|${l.category}`) ? [] : [{ family: l.family, category: l.category, sortOrder: n }];
  });
  const newRelated = related.pairs.filter((x) => !relHave.has([x.a, x.b].sort().join('|'))).map((x) => ({ a: x.a, b: x.b, reason: x.reason }));

  const { matched, unmatched } = matchLegacy(legacy, categorySlugs, aliases);
  const newMaps = matched.filter((m) => !mapHave.has(m.legacyKey)).map((m) => ({ legacyKey: m.legacyKey, category: m.categorySlug, kind: m.kind, sourceTag: tag }));

  const result: TaxonomyLoadResult = {
    refused: false, problems,
    families: count(master.families.length, newFamilies.length), categories: count(master.categories.length, newCategories.length),
    links: count(master.links.length, newLinks.length), related: count(related.pairs.length, newRelated.length), legacy: count(matched.length, newMaps.length),
    differs, legacyTotal: legacy.length, legacyExact: matched.filter((m) => m.kind === 'EXACT').length, legacyAlias: matched.filter((m) => m.kind === 'ALIAS').length,
    legacyAlreadyMapped: matched.length - newMaps.length, unmatched,
    needsOwnerReview: { aliasTable: aliases.needsOwnerReview, relatedMap: related.needsOwnerReview },
  };
  if (!opts.apply) return result;
  if (problems.length) { result.refused = true; return result; }

  // parents before children, so a stopped run can simply be run again
  await store.createFamilies(newFamilies.map((f) => ({ slug: f.slug, name: f.name, sortOrder: f.order, plannedPackKey: f.plannedPackKey, sourceTag: tag })));
  result.families.created = newFamilies.length;
  await store.createCategories(newCategories.map((c) => ({ slug: c.slug, name: c.name, sourceTag: tag })));
  result.categories.created = newCategories.length;
  await store.createLinks(newLinks);
  result.links.created = newLinks.length;
  await store.createRelated(newRelated);
  result.related.created = newRelated.length;
  await store.createLegacyMaps(newMaps);
  result.legacy.created = newMaps.length;
  return result;
}

/** In memory, for tests and for the offline dry run (an empty database, with the existing categories given). */
export class MemoryTaxonomyStore extends TaxonomyStore {
  families: Array<{ slug: string; name: string; sortOrder: number; plannedPackKey: string; sourceTag: string }> = [];
  categories: Array<{ slug: string; name: string; sourceTag: string }> = [];
  links: Array<{ family: string; category: string; sortOrder: number }> = [];
  related: Array<{ a: string; b: string; reason: string }> = [];
  legacyMaps: Array<{ legacyKey: string; category: string; kind: LegacyMatch['kind']; sourceTag: string }> = [];
  constructor(readonly legacy: LegacyCategory[] = []) { super(); }
  async listFamilies() { return this.families; }
  async listCategories() { return this.categories; }
  async listLinks() { return this.links; }
  async listRelated() { return this.related.map((r) => { const [a, b] = [r.a, r.b].sort(); return { a, b }; }); }
  async listLegacyMaps() { return this.legacyMaps; }
  async listLegacyCategories() { return this.legacy; }
  async createFamilies(rows: Array<{ slug: string; name: string; sortOrder: number; plannedPackKey: string; sourceTag: string }>) { this.families.push(...rows); }
  async createCategories(rows: Array<{ slug: string; name: string; sourceTag: string }>) { this.categories.push(...rows); }
  async createLinks(rows: Array<{ family: string; category: string; sortOrder: number }>) {
    for (const r of rows) {
      if (!this.families.some((f) => f.slug === r.family) || !this.categories.some((c) => c.slug === r.category)) throw new Error(`link ${r.family}|${r.category} has no parent`);
    }
    this.links.push(...rows);
  }
  async createRelated(rows: Array<{ a: string; b: string; reason: string }>) { this.related.push(...rows); }
  async createLegacyMaps(rows: Array<{ legacyKey: string; category: string; kind: LegacyMatch['kind']; sourceTag: string }>) { this.legacyMaps.push(...rows); }
}
