import { SeedEntity, SeedStore, UpsertResult } from '../../src/plans/seed/seed-applier';

/** An in-memory SeedStore for unit tests: same contract as the Prisma store, no database. */
export class MemorySeedStore implements SeedStore {
  private data: Record<SeedEntity, Map<string, Record<string, unknown>>> = {
    plans: new Map(), features: new Map(), planFeatures: new Map(), settings: new Map(), taxRates: new Map(), discountRules: new Map(), prices: new Map(),
  };
  writes = 0;

  async find(entity: SeedEntity, key: string): Promise<Record<string, unknown> | null> {
    return this.data[entity].get(key) ?? null;
  }

  async write(entity: SeedEntity, key: string, row: Record<string, unknown>): Promise<UpsertResult> {
    const before = this.data[entity].get(key);
    this.data[entity].set(key, { ...row });
    this.writes += 1;
    return before ? 'updated' : 'created';
  }

  get(entity: SeedEntity, key: string): Record<string, unknown> | undefined { return this.data[entity].get(key); }
  patch(entity: SeedEntity, key: string, patch: Record<string, unknown>): void { this.data[entity].set(key, { ...this.data[entity].get(key), ...patch }); }
  dump(): Record<string, [string, Record<string, unknown>][]> {
    return Object.fromEntries(Object.entries(this.data).map(([k, m]) => [k, [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1))]));
  }
}
