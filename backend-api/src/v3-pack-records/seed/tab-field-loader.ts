import { PackTabFieldStore } from '../pack-records.store';
import { buildFieldSeed, SeedField } from './tab-field-seed';

export interface FieldLoadReport { applied: boolean; refused: boolean; tabs: number; total: number; toCreate: number; existing: number; problems: string[] }

/**
 * Loads the starting field set of every record tab (Wave 2 Part A). A DRY RUN unless told to apply. Creates what is missing and never touches a row that exists (a staff edit is never overwritten);
 * deletes nothing. An apply is refused while the seed has a problem.
 */
export async function loadTabFields(store: PackTabFieldStore, tabs: ReadonlyArray<{ scope: string; ownerKey: string; key: string }>, o: { apply: boolean }): Promise<FieldLoadReport> {
  const seed = buildFieldSeed(tabs);
  const have = new Set((await store.listAll()).map((r) => `${r.ownerKey}|${r.tabKey}|${r.fieldKey}`));
  const missing: SeedField[] = seed.fields.filter((f) => !have.has(`${f.ownerKey}|${f.tabKey}|${f.fieldKey}`));
  const report: FieldLoadReport = {
    applied: false, refused: false, tabs: new Set(seed.fields.map((f) => `${f.ownerKey}|${f.tabKey}`)).size, total: seed.fields.length, toCreate: missing.length, existing: seed.fields.length - missing.length, problems: seed.problems,
  };
  if (!o.apply) return report;
  if (seed.problems.length) { report.refused = true; return report; }
  await store.createFields(missing);
  report.applied = true;
  return report;
}

/** An empty store: the offline dry run counts what a first load creates, with no database and no environment. */
export function emptyFieldStoreForDryRun(): PackTabFieldStore {
  return { listAll: async () => [] } as unknown as PackTabFieldStore;
}
