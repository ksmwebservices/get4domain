import { CatalogueCategory } from '../core/catalogue-categories';
import { familySlug } from '../core/listable-categories';

/** The two things the loader needs from the directory category table. A Prisma implementation and an in-memory twin (tests) implement it. */
export interface CatalogueCategoryRow { id: string; slug: string; parentId: string | null; name: string }
export interface CatalogueCategoryStore {
  listCategories(): Promise<CatalogueCategoryRow[]>;
  /** creates a row marked proposed (the owner reviews it) and returns its id */
  createCategory(d: { parentId: string | null; name: string; slug: string; themeCategoryId: string | null; family: string | null; sortOrder: number }): Promise<string>;
}

export interface CatalogueLoadReport {
  families: { total: number; created: number; existing: number };
  categories: { total: number; created: number; existing: number };
  /** the catalogue keys that were (or, in a dry run, would be) created */
  createdKeys: string[];
}

/** "Healthcare (disclaimer)" -> "Healthcare". The parenthesis is a note for staff in the sheet, not part of the family. */
export const familyLabel = (name: string): string => String(name ?? '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Creates the directory category rows for the catalogue (Wave 2 job K1). IDEMPOTENT and a DRY RUN unless told to apply. It only CREATES: a category that already has a row (a leaf with the same slug
 * anywhere in the tree, such as the 41 the theme kit seed made) is left exactly as it is, never moved, renamed or switched, so a staff edit is never overwritten and a second run creates nothing.
 * A family (the top level the catalogue groups by) is reused when a top level row has its slug (for example `healthcare`), else created. Every row it creates is marked proposed and has the catalogue
 * key as its slug and no theme kit mapping (the kit mapping of a listing is worked out from its pack, see listable-categories.ts). Nothing is deleted.
 */
export async function loadCatalogueCategories(store: CatalogueCategoryStore, catalogue: readonly CatalogueCategory[], o: { apply: boolean; kitIds: readonly string[] }): Promise<CatalogueLoadReport> {
  const rows = await store.listCategories();
  const leaves = new Set(rows.filter((r) => r.parentId !== null).map((r) => r.slug));
  const familyId = new Map(rows.filter((r) => r.parentId === null).map((r) => [r.slug, r.id] as const));
  const report: CatalogueLoadReport = { families: { total: 0, created: 0, existing: 0 }, categories: { total: catalogue.length, created: 0, existing: 0 }, createdKeys: [] };
  const kit = new Set(o.kitIds); const perFamily = new Map<string, number>();

  const ensureFamily = async (label: string, slug: string, index: number): Promise<string> => {
    const have = familyId.get(slug); if (have) { report.families.existing++; return have; }
    report.families.created++;
    const id = o.apply ? await store.createCategory({ parentId: null, name: label, slug, themeCategoryId: null, family: slug, sortOrder: 100 + index }) : `dry:${slug}`;
    familyId.set(slug, id); return id;
  };

  const families = [...new Map(catalogue.map((c) => [familySlug(c.family), familyLabel(c.family)] as const))];
  report.families.total = families.length;
  const need = catalogue.filter((c) => !leaves.has(c.id));
  report.categories.existing = catalogue.length - need.length;
  const usedFamilies = new Set(need.map((c) => familySlug(c.family)));
  let fi = 0;
  for (const [slug, label] of families) { if (usedFamilies.has(slug)) await ensureFamily(label, slug, fi); else if (familyId.has(slug)) report.families.existing++; fi++; }
  report.families.total = report.families.created + report.families.existing;

  for (const c of need) {
    const slug = familySlug(c.family); const parentId = familyId.get(slug) as string; const n = perFamily.get(slug) ?? 0; perFamily.set(slug, n + 1);
    report.categories.created++; report.createdKeys.push(c.id);
    if (o.apply) await store.createCategory({ parentId, name: c.name, slug: c.id, themeCategoryId: kit.has(c.id) ? c.id : null, family: slug, sortOrder: n });
  }
  return report;
}
