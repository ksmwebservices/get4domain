export {};   // a module, so its names never clash with another spec that has no imports
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cleanup = require('../scripts/staging/test-tenant-cleanup') as { cleanupTestTenants: (p: unknown, o?: { runId?: string }) => Promise<Record<string, number>>; TEST_EMAIL_SUFFIX: string };

/**
 * Wave 3: test:cleanup-staging must be able to remove every row the Wave 3 integration tests create. This runs the real cleanup over a recording fake client (no database) and checks which Wave 3 rows it deletes,
 * by which marker, and in which order (the ledger points at a payout, links and payouts point at a partner).
 */
type Call = { model: string; op: string; args: Record<string, unknown> | undefined };

function fake(answers: { vendors?: string[]; staff?: string[]; partners?: string[] }) {
  const calls: Call[] = [];
  const rows: Record<string, unknown[]> = { vendor: (answers.vendors ?? []).map((id) => ({ id })), adminTeamMember: (answers.staff ?? []).map((id) => ({ id })), referralPartner: (answers.partners ?? []).map((id) => ({ id })) };
  const model = (name: string) => new Proxy({}, { get: (_t, op: string) => async (args?: Record<string, unknown>) => {
    calls.push({ model: name, op, args });
    if (op === 'findMany') return rows[name] ?? [];
    if (op === 'findFirst' || op === 'findUnique') return null;
    if (op === 'count') return 0;
    return { count: 1 };
  } });
  const prisma = new Proxy({}, { get: (_t, name: string) => (name === '$transaction' ? async (fn: unknown) => (typeof fn === 'function' ? (fn as (p: unknown) => unknown)(prisma) : []) : name.startsWith('$') ? async () => 0 : model(name)) });
  return { prisma, calls };
}
const deletes = (calls: Call[], m: string): Call[] => calls.filter((c) => c.model === m && c.op === 'deleteMany');
const firstIndex = (calls: Call[], m: string): number => calls.findIndex((c) => c.model === m && c.op === 'deleteMany');

describe('staging cleanup removes the Wave 3 rows', () => {
  it('finds the synthetic partners by the test e-mail and the run id, and deletes their ledger, attributions, payouts, links and the partners themselves, children first', async () => {
    const f = fake({ vendors: ['v1'], staff: ['s1'], partners: ['p1', 'p2'] });
    const counts = await cleanup.cleanupTestTenants(f.prisma, { runId: 'rabc123' });
    const find = f.calls.find((c) => c.model === 'referralPartner' && c.op === 'findMany')!;
    expect(find.args).toMatchObject({ where: { email: { endsWith: cleanup.TEST_EMAIL_SUFFIX, contains: 'rabc123' } } });
    expect(deletes(f.calls, 'commissionLedger')[0].args).toEqual({ where: { OR: [{ partnerId: { in: ['p1', 'p2'] } }, { vendorId: { in: ['v1'] } }] } });
    expect(deletes(f.calls, 'referralAttribution')[0].args).toEqual({ where: { OR: [{ partnerId: { in: ['p1', 'p2'] } }, { vendorId: { in: ['v1'] } }] } });
    expect(deletes(f.calls, 'commissionPayout')[0].args).toEqual({ where: { partnerId: { in: ['p1', 'p2'] } } });
    expect(deletes(f.calls, 'referralLink')[0].args).toEqual({ where: { partnerId: { in: ['p1', 'p2'] } } });
    expect(deletes(f.calls, 'commissionSlab')[0].args).toEqual({ where: { createdById: { in: ['s1'] } } });
    expect(deletes(f.calls, 'referralPartner')[0].args).toEqual({ where: { id: { in: ['p1', 'p2'] } } });
    expect(Object.keys(counts)).toEqual(expect.arrayContaining(['commissionLedger', 'referralAttributions', 'commissionPayouts', 'referralLinks', 'commissionSlabs', 'referralPartners']));
    // the order: the ledger (which points at a payout) before the payouts, and every child before the partners
    const order = ['commissionLedger', 'commissionPayout', 'referralLink', 'referralPartner'].map((m) => firstIndex(f.calls, m));
    expect(order).toEqual([...order].sort((a, b) => a - b)); expect(order.every((i) => i >= 0)).toBe(true);
    expect(firstIndex(f.calls, 'referralAttribution')).toBeLessThan(firstIndex(f.calls, 'referralPartner'));
  });

  it('with no synthetic partner it deletes no partner, link or payout, but still clears the ledger and attribution rows of the synthetic vendors and the slabs of synthetic staff', async () => {
    const f = fake({ vendors: ['v1'], staff: ['s1'], partners: [] });
    await cleanup.cleanupTestTenants(f.prisma, { runId: 'rabc123' });
    expect(deletes(f.calls, 'referralPartner')).toEqual([]); expect(deletes(f.calls, 'referralLink')).toEqual([]); expect(deletes(f.calls, 'commissionPayout')).toEqual([]);
    expect(deletes(f.calls, 'commissionLedger')[0].args).toEqual({ where: { OR: [{ vendorId: { in: ['v1'] } }] } });
    expect(deletes(f.calls, 'commissionSlab')[0].args).toEqual({ where: { createdById: { in: ['s1'] } } });
  });

  it('never deletes a slab when no synthetic staff member exists (a real slab has a real author)', async () => {
    const f = fake({ vendors: [], staff: [], partners: [] });
    await cleanup.cleanupTestTenants(f.prisma, { runId: 'rabc123' });
    expect(deletes(f.calls, 'commissionSlab')).toEqual([]); expect(deletes(f.calls, 'commissionLedger')).toEqual([]);
  });
});
