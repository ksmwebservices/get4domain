import { PrismaDirectoryRepository } from '../src/directory/prisma-directory.repository';

/**
 * The visit counter is one INSERT ... ON CONFLICT ("businessId","day"). A fixed row id made the primary key a second unique index the same row could violate, so the request that lost
 * the race for the first row of the day failed instead of updating (staging: 39 counted of 40). The id must be random per statement, and a unique violation is retried once.
 */
function fake(failures: Array<unknown>) {
  const ids: string[] = []; let calls = 0;
  const prisma = { $executeRaw: async (_s: TemplateStringsArray, ...v: unknown[]) => { calls++; ids.push(String(v[0])); const f = failures.shift(); if (f) throw f; return 1; } };
  return { repo: new PrismaDirectoryRepository(prisma as never), ids, calls: () => calls };
}

describe('PrismaDirectoryRepository.incrementVisit', () => {
  it('uses a different row id for every statement (the same business and day never share an id)', async () => {
    const f = fake([]);
    await Promise.all(Array.from({ length: 40 }, () => f.repo.incrementVisit('biz1', '2026-11-05', false)));
    expect(new Set(f.ids).size).toBe(40);
    expect(f.ids.every((i) => !i.includes('2026-11-05') && !i.includes('biz1'))).toBe(true);
  });

  it('retries once on a unique violation (raw P2010 / 23505) and succeeds', async () => {
    const f = fake([{ code: 'P2010', meta: { code: '23505' }, message: 'x' }]);
    await expect(f.repo.incrementVisit('biz1', '2026-11-05', true)).resolves.toBeUndefined();
    expect(f.calls()).toBe(2); expect(new Set(f.ids).size).toBe(2);
  });

  it('does not retry a different error, and gives up after one retry', async () => {
    const other = fake([new Error('connection reset')]);
    await expect(other.repo.incrementVisit('b', 'd', false)).rejects.toThrow('connection reset'); expect(other.calls()).toBe(1);
    const dup = { code: 'P2010', meta: { code: '23505' } };
    const twice = fake([dup, dup]);
    await expect(twice.repo.incrementVisit('b', 'd', false)).rejects.toBe(dup); expect(twice.calls()).toBe(2);
  });
});
