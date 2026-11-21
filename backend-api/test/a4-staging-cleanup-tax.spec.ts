export {};   // a module, so its names never clash with another spec that has no imports
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cleanup = require('../scripts/staging/test-tenant-cleanup') as {
  cleanupTestTenants: (p: unknown, o?: { runId?: string }) => Promise<Record<string, number>>; countTestTaxRates: (p: unknown) => Promise<number>;
  taxRateWhere: (runId?: string) => { name: { startsWith: string; contains?: string } }; isSyntheticTaxRateName: (n: unknown, runId?: string) => boolean;
};

/**
 * Dispatch A4 Q4: test:cleanup-staging also removes the synthetic V3TEST tax-rate rows the staging suites create, matched ONLY by the synthetic name marker. Nothing here touches a database: the real cleanup runs over
 * a recording fake client, and the matching rule is applied to a list of rate names the way the database would apply it.
 */
type Call = { model: string; op: string; args: Record<string, unknown> | undefined };
function fake() {
  const calls: Call[] = [];
  const model = (name: string) => new Proxy({}, { get: (_t, op: string) => async (args?: Record<string, unknown>) => { calls.push({ model: name, op, args }); if (op === 'findMany') return []; if (op === 'count') return 3; if (op === 'findFirst' || op === 'findUnique') return null; return { count: 2 }; } });
  const prisma = new Proxy({}, { get: (_t, name: string) => (name === '$transaction' ? async (fn: unknown) => (typeof fn === 'function' ? (fn as (p: unknown) => unknown)(prisma) : []) : name.startsWith('$') ? async () => 0 : model(name)) });
  return { prisma, calls };
}
/** what the database does with `where: { name: { startsWith, contains? } }` */
const matches = (w: { name: { startsWith: string; contains?: string } }, name: string): boolean => name.startsWith(w.name.startsWith) && (w.name.contains === undefined || name.includes(w.name.contains));

const REAL = ['GST', 'GST 18%', 'GST (from 1 April)', 'Service tax', 'GST V3TEST', 'v3test GST', 'Test GST', ' V3TEST GST', 'GST 2026-11 rate', '', 'V3'];
const SYNTHETIC = ['V3TEST GST rabc123', 'V3TEST GST 1700000000', 'V3TEST', 'V3TEST x'];

describe('the synthetic tax-rate matching rule (A4 Q4)', () => {
  it('matches only a name that starts with V3TEST; no real rate name, however close, matches', () => {
    for (const n of REAL) { expect([n, cleanup.isSyntheticTaxRateName(n)]).toEqual([n, false]); expect([n, matches(cleanup.taxRateWhere(), n)]).toEqual([n, false]); }
    for (const n of SYNTHETIC) { expect([n, cleanup.isSyntheticTaxRateName(n)]).toEqual([n, true]); expect([n, matches(cleanup.taxRateWhere(), n)]).toEqual([n, true]); }
    for (const bad of [null, undefined, 5, {}, ['V3TEST']]) expect(cleanup.isSyntheticTaxRateName(bad)).toBe(false);
  });
  it('with a run id, the name must carry that run id as well; the where clause and the plain function agree on every name', () => {
    expect(cleanup.taxRateWhere('rabc123')).toEqual({ name: { startsWith: 'V3TEST', contains: 'rabc123' } });
    for (const n of [...REAL, ...SYNTHETIC]) { for (const run of [undefined, 'rabc123', '1700000000']) expect([n, run, matches(cleanup.taxRateWhere(run), n)]).toEqual([n, run, cleanup.isSyntheticTaxRateName(n, run)]); }
    expect(cleanup.isSyntheticTaxRateName('V3TEST GST rabc123', 'rother')).toBe(false);
  });
});

describe('test:cleanup-staging and its --count cover the synthetic tax rates (A4 Q4)', () => {
  it('the cleanup deletes tax rates with exactly that where clause, in a plain run and in a run-scoped one, even when no synthetic vendor exists, and reports the number', async () => {
    for (const runId of [undefined, 'rabc123']) {
      const f = fake(); const counts = await cleanup.cleanupTestTenants(f.prisma, runId ? { runId } : {});
      const del = f.calls.filter((c) => c.model === 'v3TaxRate');
      expect(del).toEqual([{ model: 'v3TaxRate', op: 'deleteMany', args: { where: cleanup.taxRateWhere(runId) } }]);
      expect(counts.v3TaxRates).toBe(2);
    }
  });
  it('it never reads or deletes a tax rate by id, by active flag or by date: the name marker is the only filter', async () => {
    const f = fake(); await cleanup.cleanupTestTenants(f.prisma, {});
    for (const c of f.calls.filter((x) => x.model === 'v3TaxRate')) expect(Object.keys((c.args as { where: Record<string, unknown> }).where)).toEqual(['name']);
  });
  it('the count uses the same rule', async () => {
    const f = fake(); expect(await cleanup.countTestTaxRates(f.prisma)).toBe(3);
    expect(f.calls).toEqual([{ model: 'v3TaxRate', op: 'count', args: { where: cleanup.taxRateWhere() } }]);
  });
});
