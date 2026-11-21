// eslint-disable-next-line @typescript-eslint/no-require-imports
const cleanup = require('../scripts/staging/test-tenant-cleanup') as { findTestVendorIds: (p: unknown, runId?: string) => Promise<string[]>; SEEDED_EMAIL_SUFFIX: string; TEST_EMAIL_SUFFIX: string };

/** The staging cleanup (and its --count) must find seeded V3TEST vendors too (placeholder e-mail, run id in the NAME), and only when BOTH markers match. */
type Where = { OR: Array<{ AND: Array<Record<string, unknown>> }> };
const capture = async (runId?: string): Promise<Where> => { let w: Where | undefined; await cleanup.findTestVendorIds({ vendor: { findMany: async (a: { where: Where }) => { w = a.where; return []; } } }, runId); return w!; };

describe('staging cleanup: which vendors count as synthetic', () => {
  it('without a run id: test tenants (test e-mail + V3TEST name) OR seeded ones (placeholder e-mail + V3TEST name); nothing else', async () => {
    const w = await capture();
    expect(w.OR).toHaveLength(2);
    expect(w.OR[0].AND).toEqual([{ email: { endsWith: cleanup.TEST_EMAIL_SUFFIX } }, { businessName: { startsWith: 'V3TEST' } }]);
    expect(w.OR[1].AND).toEqual([{ email: { endsWith: cleanup.SEEDED_EMAIL_SUFFIX } }, { businessName: { startsWith: 'V3TEST' } }]);
  });
  it('with a run id: tenants by the id in the e-mail, seeded vendors by the id in the NAME', async () => {
    const w = await capture('rabc123');
    expect(w.OR[0].AND).toContainEqual({ email: { contains: 'rabc123' } });
    expect(w.OR[1].AND).toContainEqual({ businessName: { startsWith: 'V3TEST', contains: 'rabc123' } });
  });
  it('a seeded vendor is never matched on the placeholder e-mail alone', async () => {
    const w = await capture();
    for (const branch of w.OR) expect(branch.AND.some((c) => 'businessName' in c)).toBe(true);
  });
});
