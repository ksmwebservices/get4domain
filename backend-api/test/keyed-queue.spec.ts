import { Prisma } from '@prisma/client';
import { KeyedQueue } from '../src/common/keyed-queue';
import { PrismaAiStudioRepository } from '../src/ai-studio/prisma-ai-studio.repository';
import { PrismaPlanBillingRepository } from '../src/plan-billing/prisma-plan-billing.repository';
import { PrismaDomainRepository } from '../src/site-domains/prisma-domain.repository';
import { PrismaSiteRepository } from '../src/site-publish/publish/prisma-site.repository';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('KeyedQueue', () => {
  it('runs one key at a time, in arrival order, and different keys in parallel', async () => {
    const q = new KeyedQueue(); const log: string[] = []; let active = 0; let maxActive = 0;
    const job = (name: string, ms: number) => () => { active++; maxActive = Math.max(maxActive, active); log.push(`start ${name}`); return sleep(ms).then(() => { active--; log.push(`end ${name}`); return name; }); };
    const same = await Promise.all([q.run('a', job('a1', 20)), q.run('a', job('a2', 5)), q.run('a', job('a3', 1))]);
    expect(same).toEqual(['a1', 'a2', 'a3']); expect(maxActive).toBe(1); expect(log).toEqual(['start a1', 'end a1', 'start a2', 'end a2', 'start a3', 'end a3']);
    maxActive = 0; await Promise.all([q.run('x', job('x', 20)), q.run('y', job('y', 20))]); expect(maxActive).toBe(2);
  });
  it('a failing item does not block or poison the next one, and the map empties', async () => {
    const q = new KeyedQueue();
    const bad = q.run('k', async () => { throw new Error('boom'); }); const good = q.run('k', async () => 'ok');
    await expect(bad).rejects.toThrow('boom'); await expect(good).resolves.toBe('ok');
    await sleep(5); expect(q.size()).toBe(0);
  });
  it('a flood beyond the cap is refused with 503 BUSY instead of growing without limit', async () => {
    const q = new KeyedQueue(3); const hold = sleep(30);
    const ok = [1, 2, 3].map(() => q.run('k', () => hold));
    await expect(q.run('k', async () => 1)).rejects.toMatchObject({ status: 503 });
    await Promise.all(ok); expect(await q.run('k', async () => 'again')).toBe('again');
  });
});

/**
 * Pool starvation, reproduced with a fake database that has a small connection pool and a real per-key lock held until the transaction ends (exactly how an advisory
 * transaction lock behaves). Before the fix every waiter held a connection while it waited for the lock; the rest could not start a transaction within maxWait and
 * failed with Prisma's P2028 "Unable to start a transaction in the given time".
 */
class FakePool {
  private free: number; private waiters: Array<() => void> = []; private lockTails = new Map<string, Promise<void>>();
  maxConcurrent = 0; inUse = 0; failed = 0; ok = 0;
  constructor(size: number, private readonly defaultMaxWait: number, private readonly extras: Record<string, unknown> = {}) { this.free = size; Object.assign(this, extras); }
  private async acquire(maxWait: number): Promise<void> {
    if (this.free > 0) { this.free--; return; }
    await new Promise<void>((resolve, reject) => {
      const go = () => { clearTimeout(t); resolve(); };
      const t = setTimeout(() => { this.waiters = this.waiters.filter((w) => w !== go); reject(new Prisma.PrismaClientKnownRequestError('Transaction API error: Unable to start a transaction in the given time.', { code: 'P2028', clientVersion: 'test' })); }, maxWait);
      this.waiters.push(go);
    });
  }
  private release(): void { const n = this.waiters.shift(); if (n) n(); else this.free++; }
  async $transaction<T>(fn: (tx: unknown) => Promise<T>, opts?: { maxWait?: number }): Promise<T> {
    try { await this.acquire(opts?.maxWait ?? this.defaultMaxWait); } catch (e) { this.failed++; throw e; }
    this.inUse++; this.maxConcurrent = Math.max(this.maxConcurrent, this.inUse);
    let releaseLock: () => void = () => undefined; const mine = new Promise<void>((r) => { releaseLock = r; });
    const tx = {
      ...this.extras,
      $executeRaw: async (_s: TemplateStringsArray, key: string) => { const prev = this.lockTails.get(key) ?? Promise.resolve(); this.lockTails.set(key, prev.then(() => mine)); await prev; return 0; },
    };
    try { const r = await fn(tx); this.ok++; return r; } finally { releaseLock(); this.inUse--; this.release(); }
  }
}

describe('pool starvation: many parallel requests for ONE vendor with a small pool', () => {
  const N = 20;
  type Repo = { transaction: <T>(v: string, fn: (tx: never) => Promise<T>) => Promise<T> };
  const run = async (make: (p: FakePool) => Repo) => {
    const pool = new FakePool(3, 1000);   // 3 connections; a transaction that cannot start within 1 s fails, as Prisma's maxWait does
    const repo = make(pool);
    const results = await Promise.allSettled(Array.from({ length: N }, () => repo.transaction('vendor-1', async () => { await sleep(80); return 'done'; })));
    return { pool, results };
  };
  const audits = {} as never;
  it('AI credits: all N succeed, one transaction at a time, none starve', async () => {
    const { pool, results } = await run((p) => new PrismaAiStudioRepository(p as never, audits) as unknown as Repo);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0); expect(pool.failed).toBe(0); expect(pool.maxConcurrent).toBe(1);
  }, 20_000);
  it('plan billing: all N succeed', async () => {
    const { pool, results } = await run((p) => new PrismaPlanBillingRepository(p as never, audits, {} as never) as unknown as Repo);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0); expect(pool.failed).toBe(0); expect(pool.maxConcurrent).toBe(1);
  }, 20_000);
  it('domains: all N succeed', async () => {
    const { pool, results } = await run((p) => new PrismaDomainRepository(p as never, audits) as unknown as Repo);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0); expect(pool.failed).toBe(0); expect(pool.maxConcurrent).toBe(1);
  }, 20_000);
});

/** B3.0b: the slice 5.4 site build, publish and rollback took the lock inside the transaction. Same simulated small pool, same assertions. */
describe('pool starvation: site build, publish and rollback for ONE vendor', () => {
  const N = 20;
  const draft = { id: 'p1', vendorId: 'vendor-1', version: 1, status: 'DRAFT_PREVIEW', themeId: 't', themeHash: 'h', contentHash: 'c', settingsHash: 's', indexable: false, indexHeader: '', missingFieldsJson: [], warningsJson: [], languages: 'en', totalBytes: 1, rolledBackFromVersion: null, createdByType: 'STAFF', createdById: null, createdAt: new Date(), publishedAt: new Date(), currentVendorId: null };
  const extras = {
    v3SitePublication: {
      aggregate: async () => ({ _max: { version: 1 } }), create: async ({ data }: { data: object }) => ({ ...draft, ...data }), findUnique: async () => draft,
      findFirst: async () => null, update: async () => ({ ...draft, status: 'PUBLISHED' }),
    },
    v3SitePublicationPage: { createMany: async () => ({ count: 0 }), findMany: async () => [] },
    v3SiteEvent: { create: async () => ({}) },
  };
  const ev = { type: 'BUILT' as const, actorType: 'STAFF' as const, actorId: null, detail: {} };
  const slow = async () => { await sleep(80); };
  const run = async (call: (r: PrismaSiteRepository) => Promise<unknown>) => {
    const pool = new FakePool(3, 1000, extras); const repo = new PrismaSiteRepository(pool as never);
    const results = await Promise.allSettled(Array.from({ length: N }, () => call(repo)));
    return { pool, results };
  };
  const expectClean = ({ pool, results }: { pool: FakePool; results: PromiseSettledResult<unknown>[] }) => {
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0); expect(pool.failed).toBe(0); expect(pool.maxConcurrent).toBe(1);
  };
  const newPub = { vendorId: 'vendor-1', themeId: 't', themeHash: 'h', contentHash: 'c', settingsHash: 's', indexable: false, indexHeader: '', missingFieldsJson: [], warningsJson: [], languages: 'en', totalBytes: 1, createdByType: 'STAFF' as const, createdById: null };
  it('build (createPublication): all N succeed, one at a time', async () => { expectClean(await run((r) => r.createPublication(newPub, [], ev, slow))); }, 20_000);
  it('publish: all N succeed, one at a time', async () => {
    expectClean(await run((r) => r.publish('vendor-1', 'p1', { now: new Date(), validate: async () => undefined, event: ev, audit: slow })));
  }, 20_000);
  it('rollback: all N succeed, one at a time', async () => {
    expectClean(await run((r) => r.rollback('vendor-1', 1, { now: new Date(), validate: async () => undefined, actor: { type: 'STAFF', id: null }, event: () => ev, audit: slow })));
  }, 20_000);
  it('build and publish for different vendors still run in parallel', async () => {
    const pool = new FakePool(6, 1000, extras); const repo = new PrismaSiteRepository(pool as never);
    await Promise.all(['a', 'b', 'c'].map((v) => repo.createPublication({ ...newPub, vendorId: v }, [], ev, slow)));
    expect(pool.maxConcurrent).toBe(3);
  }, 20_000);
});
