import {
  AddonRecord, addonRecords, addonTabRecords, capabilityRecords, capabilityTabRecords, CapabilityRecord, CategoryRecord, commonTabRecords, crossCheckMap, MatrixRecord, matrixRecords, PackEngineSettings, PackRecord, parseCategoryMaster, parseCsv,
  parsePackSummary, stableJson, TabRecord, validateSettings,
} from '../core/pack-core';
import { PackReferenceStore } from '../pack-engine.store';

/**
 * The pack engine loaders (Amendment 13 Part A, A2). IDEMPOTENT and a DRY RUN unless told to apply. They create what is missing and never touch a row that already exists, so an edit staff made
 * (a tab label, a matrix cell, a pack's stages) is never overwritten by a second run; a row that differs from the sheet is only counted and named. Nothing is deleted. A problem in a sheet
 * (a copy-rule word, an unknown pack or capability, a duplicate, a bad key) stops an apply and lists every problem; a dry run lists them too.
 */
export interface SeedSources { settings: PackEngineSettings; packSummaryCsv: string; categoryMasterCsv: string; categoryMapCsv: string }
export interface BuiltSeed {
  problems: string[]; rewrites: number;
  addons: AddonRecord[]; capabilities: CapabilityRecord[]; matrix: MatrixRecord[]; packs: PackRecord[]; tabs: TabRecord[]; categories: CategoryRecord[];
  /** categories that carry no starter services yet (they stay marked as needing a blueprint wave) */
  needsBlueprint: number;
}

export function buildSeed(src: SeedSources): BuiltSeed {
  const problems = validateSettings(src.settings);
  const caps = capabilityRecords(src.settings);
  const matrix = matrixRecords(src.settings);
  const packSheet = parsePackSummary(parseCsv(src.packSummaryCsv), src.settings);
  const catSheet = parseCategoryMaster(parseCsv(src.categoryMasterCsv), new Set(packSheet.packs.map((p) => p.key)), new Set(caps.map((c) => c.key)), new Set(addonRecords(src.settings).map((a) => a.key)));
  problems.push(...packSheet.problems, ...catSheet.problems, ...crossCheckMap(parseCsv(src.categoryMapCsv), catSheet.categories));
  const tabs = [...commonTabRecords(src.settings), ...packSheet.tabs, ...capabilityTabRecords(src.settings), ...addonTabRecords(src.settings)];
  return {
    problems, rewrites: packSheet.rewrites + catSheet.rewrites, addons: addonRecords(src.settings), capabilities: caps, matrix, packs: packSheet.packs, tabs, categories: catSheet.categories,
    needsBlueprint: catSheet.categories.filter((c) => c.needsBlueprint).length,
  };
}

export interface TableReport { total: number; toCreate: number; existing: number; differs: string[]; created: number }
export interface LoadReport {
  applied: boolean; refused: boolean; problems: string[]; rewrites: number; needsBlueprint: number;
  addons: TableReport; capabilities: TableReport; matrix: TableReport; packs: TableReport; tabs: TableReport; categories: TableReport;
}
const blank = (total: number): TableReport => ({ total, toCreate: 0, existing: 0, differs: [], created: 0 });

/** Sorts rows into missing, same and differing. `same` is decided on the fields the sheet owns. */
function sort<T>(rows: T[], keyOf: (r: T) => string, have: Map<string, unknown>, shape: (r: T) => unknown, shapeHave: (v: unknown) => unknown): { missing: T[]; report: TableReport } {
  const report = blank(rows.length); const missing: T[] = [];
  for (const r of rows) {
    const k = keyOf(r);
    if (!have.has(k)) { missing.push(r); continue; }
    report.existing += 1;
    if (stableJson(shape(r)) !== stableJson(shapeHave(have.get(k)))) report.differs.push(k);
  }
  report.toCreate = missing.length;
  return { missing, report };
}

export async function loadPackEngine(store: PackReferenceStore, seed: BuiltSeed, o: { apply: boolean }): Promise<LoadReport> {
  const [packs, tabs, caps, matrix, cats, addons] = await Promise.all([store.listPacks(), store.listTabs(), store.listCapabilities(), store.listMatrix(), store.listCategories(), store.listAddons()]);
  const a = sort(seed.addons, (r) => r.key, new Map(addons.map((x) => [x.key, x])), (r) => [r.name, r.grantsCapabilities, r.config], (v) => { const x = v as AddonRecord; return [x.name, x.grantsCapabilities, x.config]; });
  const c = sort(seed.capabilities, (r) => r.key, new Map(caps.map((x) => [x.key, x])), (r) => r.name, (v) => (v as { name: string }).name);
  const m = sort(seed.matrix, (r) => `${r.tier}|${r.capabilityKey}`, new Map(matrix.map((x) => [`${x.tier}|${x.capabilityKey}`, x])), (r) => r.allowed, (v) => (v as { allowed: boolean }).allowed);
  const p = sort(seed.packs, (r) => r.key, new Map(packs.map((x) => [x.key, x])), (r) => r.config, (v) => (v as { config: unknown }).config);
  const t = sort(seed.tabs, (r) => `${r.scope}|${r.ownerKey}|${r.key}`, new Map(tabs.map((x) => [`${x.scope}|${x.ownerKey}|${x.key}`, x])), (r) => [r.label, r.route, r.minTier, r.capabilityKey, r.freeTrial], (v) => { const x = v as TabRecord; return [x.label, x.route, x.minTier, x.capabilityKey, x.freeTrial]; });
  const g = sort(seed.categories, (r) => r.categoryKey, new Map(cats.map((x) => [x.categoryKey, x])), (r) => [r.packKey, r.minTier, r.optionalCapabilities, r.starterServices, r.addonPacks], (v) => { const x = v as CategoryRecord; return [x.packKey, x.minTier, x.optionalCapabilities, x.starterServices, x.addonPacks]; });
  const report: LoadReport = {
    applied: false, refused: false, problems: seed.problems, rewrites: seed.rewrites, needsBlueprint: seed.needsBlueprint,
    addons: a.report, capabilities: c.report, matrix: m.report, packs: p.report, tabs: t.report, categories: g.report,
  };
  if (!o.apply) return report;
  if (seed.problems.length) { report.refused = true; return report; }
  // parents first: the pack, capability and category rows are what the tabs, the matrix and the category map point at
  await store.createCapabilities(c.missing); report.capabilities.created = c.missing.length;
  await store.createAddons(a.missing); report.addons.created = a.missing.length;
  await store.createPacks(p.missing); report.packs.created = p.missing.length;
  await store.createTabs(t.missing); report.tabs.created = t.missing.length;
  await store.createMatrix(m.missing); report.matrix.created = m.missing.length;
  await store.createCategories(g.missing); report.categories.created = g.missing.length;
  report.applied = true;
  return report;
}

/** An in-memory store with nothing in it: the "offline" dry run counts what a first load would create, with no database and no environment. */
export function emptyStoreForDryRun(): PackReferenceStore {
  const nothing = async (): Promise<never[]> => [];
  return { listPacks: nothing, listTabs: nothing, listCapabilities: nothing, listMatrix: nothing, listCategories: nothing, listAddons: nothing } as unknown as PackReferenceStore;
}
