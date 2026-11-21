import { ExpandedSeed } from './seed-file';

/** The loader, written against a tiny store so it can be tested without a database and run against Prisma on staging. */
export type SeedEntity = 'plans' | 'features' | 'planFeatures' | 'settings' | 'taxRates' | 'discountRules' | 'prices';
export type UpsertResult = 'created' | 'updated';

export interface SeedStore {
  /** The stored row in the SAME shape as the desired row (extra columns are ignored), or null. */
  find(entity: SeedEntity, key: string): Promise<Record<string, unknown> | null>;
  write(entity: SeedEntity, key: string, row: Record<string, unknown>): Promise<UpsertResult>;
}

export interface SeedReport {
  applied: boolean;
  created: number;
  updated: number;
  unchanged: number;
  /** price rows an admin has already APPROVED: the seed never overwrites an approval */
  skippedApproved: string[];
  byEntity: Record<string, { created: number; updated: number; unchanged: number }>;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export async function applySeed(store: SeedStore, seed: ExpandedSeed, opts: { apply: boolean }): Promise<SeedReport> {
  const report: SeedReport = { applied: opts.apply, created: 0, updated: 0, unchanged: 0, skippedApproved: [], byEntity: {} };
  const plan: [SeedEntity, [string, Record<string, unknown>][]][] = [
    ['plans', seed.plans.map((p) => [p.key, { key: p.key, track: p.track, level: p.level, name: p.name, description: p.description ?? null, status: p.status, isPublic: p.isPublic, sortOrder: p.sortOrder }])],
    ['features', seed.features.map((f) => [f.key, { ...f }])],
    ['planFeatures', seed.planFeatures.map((c) => [`${c.planKey}|${c.featureKey}`, { ...c }])],
    ['settings', seed.settings.map((s) => [s.key, { ...s }])],
    ['taxRates', seed.taxRates.map((t) => [t.name, { ...t }])],
    ['discountRules', seed.discountRules.map((d) => [`${d.type}|${d.name}`, { ...d }])],
    ['prices', seed.prices.map((p) => [`${p.planKey}|${p.termMonths}|${p.effectiveFrom}`, { ...p }])],
  ];
  for (const [entity, rows] of plan) {
    const e = (report.byEntity[entity] = { created: 0, updated: 0, unchanged: 0 });
    for (const [key, row] of rows) {
      const existing = await store.find(entity, key);
      if (entity === 'prices' && existing?.status === 'APPROVED') { report.skippedApproved.push(key); e.unchanged += 1; report.unchanged += 1; continue; }
      if (!existing) {
        if (opts.apply) await store.write(entity, key, row);
        e.created += 1; report.created += 1;
      } else if (Object.keys(row).some((k) => !same(existing[k], row[k]))) {
        if (opts.apply) await store.write(entity, key, row);
        e.updated += 1; report.updated += 1;
      } else {
        e.unchanged += 1; report.unchanged += 1;
      }
    }
  }
  return report;
}
