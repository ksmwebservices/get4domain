import { buildProfileSeed, PROFILE_PACKS } from '../core/profile-core';
import { ProfileFieldStore } from '../profile.store';

export interface ProfileLoadReport { applied: boolean; refused: boolean; packs: number; categoriesWithOwnFields: number; fields: number; fieldsToCreate: number; maps: number; mapsToCreate: number; problems: string[] }

/**
 * Loads the profile field sets and the map into the site content (Wave 2 Part E): the pack fields of all 16 packs, and a category field only where the catalog gave that category field hints. A DRY RUN unless told to
 * apply. Creates what is missing and never touches a row that exists (a staff edit is never overwritten); deletes nothing. An apply is refused while the seed has a problem.
 */
export async function loadProfileFields(store: ProfileFieldStore, categories: ReadonlyArray<{ categoryKey: string; packKey: string; fieldHints: readonly string[] }>, o: { apply: boolean }): Promise<ProfileLoadReport> {
  const seed = buildProfileSeed(categories);
  const [haveF, haveM] = await Promise.all([store.listFields(), store.listMaps()]);
  const fk = (f: { packKey: string; categorySlug: string; fieldKey: string }): string => `${f.packKey}|${f.categorySlug}|${f.fieldKey}`;
  const fHave = new Set(haveF.map(fk)); const mHave = new Set(haveM.map(fk));
  const newF = seed.fields.filter((f) => !fHave.has(fk(f))); const newM = seed.maps.filter((m) => !mHave.has(fk(m)));
  const report: ProfileLoadReport = {
    applied: false, refused: false, packs: PROFILE_PACKS.length, categoriesWithOwnFields: new Set(seed.fields.filter((f) => f.categorySlug !== '').map((f) => f.categorySlug)).size,
    fields: seed.fields.length, fieldsToCreate: newF.length, maps: seed.maps.length, mapsToCreate: newM.length, problems: seed.problems,
  };
  if (!o.apply) return report;
  if (seed.problems.length) { report.refused = true; return report; }
  await store.createFields(newF); await store.createMaps(newM);
  report.applied = true;
  return report;
}

/** An empty store: the offline dry run counts what a first load creates, with no database and no environment. */
export function emptyProfileStoreForDryRun(): ProfileFieldStore {
  return { listFields: async () => [], listMaps: async () => [] } as unknown as ProfileFieldStore;
}
