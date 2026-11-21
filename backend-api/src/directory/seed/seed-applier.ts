import { DirectorySeed } from './seed-file';

/** The writes the seed loader needs. A Prisma implementation and an in-memory twin (tests) implement it. */
export interface DirectorySeedStore {
  findLocation(parentKey: string, slug: string): Promise<{ id: string; name: string; sortOrder: number; proposed: boolean } | null>;
  createLocation(d: { parentId: string | null; parentKey: string; kind: string; name: string; slug: string; sortOrder: number; proposed: boolean }): Promise<string>;
  updateLocation(id: string, d: { name: string; sortOrder: number }): Promise<void>;
  findCategory(parentKey: string, slug: string): Promise<{ id: string; name: string; themeCategoryId: string | null; family: string | null; sortOrder: number; proposed: boolean } | null>;
  createCategory(d: { parentId: string | null; parentKey: string; name: string; slug: string; themeCategoryId: string | null; family: string | null; sortOrder: number; proposed: boolean }): Promise<string>;
  updateCategory(id: string, d: { name: string; themeCategoryId: string | null; family: string | null; sortOrder: number }): Promise<void>;
}

export interface SeedCounts { created: number; updated: number; unchanged: number; keptReviewed: number }
export interface DirectorySeedReport { locations: SeedCounts; categories: SeedCounts }
const zero = (): SeedCounts => ({ created: 0, updated: 0, unchanged: 0, keptReviewed: 0 });

/**
 * Idempotent loader. A DRY RUN (apply: false) reads but never writes. A row the owner has reviewed (proposed = false) is never overwritten; a proposed row
 * is brought up to date with the file. Rows are matched by (parent, slug), never deleted.
 */
export async function applyDirectorySeed(store: DirectorySeedStore, seed: DirectorySeed, o: { apply: boolean }): Promise<DirectorySeedReport> {
  const report: DirectorySeedReport = { locations: zero(), categories: zero() };
  const locId = new Map<string, string>(); const catId = new Map<string, string>();

  for (const l of seed.locations) {
    const parentId = l.parent ? locId.get(l.parent) ?? null : null;
    const parentKey = l.parent ? (parentId ?? `dry:${l.parent}`) : 'ROOT';
    const existing = parentId || !l.parent ? await store.findLocation(parentKey, l.slug) : null;
    if (!existing) {
      report.locations.created++;
      locId.set(l.key, o.apply ? await store.createLocation({ parentId, parentKey, kind: l.kind, name: l.name, slug: l.slug, sortOrder: l.sortOrder, proposed: true }) : `dry:${l.key}`);
    } else {
      locId.set(l.key, existing.id);
      if (!existing.proposed) report.locations.keptReviewed++;
      else if (existing.name !== l.name || existing.sortOrder !== l.sortOrder) { report.locations.updated++; if (o.apply) await store.updateLocation(existing.id, { name: l.name, sortOrder: l.sortOrder }); }
      else report.locations.unchanged++;
    }
  }

  for (const c of seed.categories) {
    const parentId = c.parent ? catId.get(c.parent) ?? null : null;
    const parentKey = c.parent ? (parentId ?? `dry:${c.parent}`) : 'ROOT';
    const existing = parentId || !c.parent ? await store.findCategory(parentKey, c.slug) : null;
    if (!existing) {
      report.categories.created++;
      catId.set(c.key, o.apply ? await store.createCategory({ parentId, parentKey, name: c.name, slug: c.slug, themeCategoryId: c.themeCategoryId, family: c.family, sortOrder: c.sortOrder, proposed: true }) : `dry:${c.key}`);
    } else {
      catId.set(c.key, existing.id);
      if (!existing.proposed) report.categories.keptReviewed++;
      else if (existing.name !== c.name || existing.themeCategoryId !== c.themeCategoryId || existing.family !== c.family || existing.sortOrder !== c.sortOrder) {
        report.categories.updated++; if (o.apply) await store.updateCategory(existing.id, { name: c.name, themeCategoryId: c.themeCategoryId, family: c.family, sortOrder: c.sortOrder });
      } else report.categories.unchanged++;
    }
  }
  return report;
}
