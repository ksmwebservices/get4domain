import * as fs from 'fs';
import * as path from 'path';
import { PlansAdminService } from '../src/plans/admin/plans-admin.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lib = require('../scripts/live/withdraw-future-prices-lib.js') as {
  REASON: string; OLD_RUPEES: Record<string, number[]>;
  planWithdrawals: (plans: unknown[], prices: unknown[], now: Date) => { withdraw: Array<{ planKey: string; termMonths: number; amountPaise: number; priceId: string }>; leftAlone: number; missingPlans: string[] };
  summarise: (plans: unknown[], prices: unknown[], now: Date) => Array<{ planKey: string; termMonths: number; inForce: number | null; proposed: number[] }>;
};

/** B4: the withdraw-future-prices script: only an approved, not-started row with exactly one of the nine old amounts; through the audited service; safe twice. */
const NOW = new Date('2026-11-18T10:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const PLANS = [{ id: 'H', key: 'handyman_pro' }, { id: 'P', key: 'professional_pro' }, { id: 'E', key: 'ecommerce_pro' }];
const ACTOR = { type: 'SYSTEM', id: null, ip: null } as never;

interface Row { id: string; planId: string; termMonths: number; amountPaise: number; currency: string; taxInclusive: boolean; status: string; effectiveFrom: Date; createdAt: Date }
let n = 0;
const row = (planId: string, termMonths: number, rupees: number, over: Partial<Row> = {}): Row => ({ id: `r${++n}`, planId, termMonths, amountPaise: rupees * 100, currency: 'INR', taxInclusive: false, status: 'APPROVED', effectiveFrom: day(3), createdAt: day(-5), ...over });

/** the nine old amounts, each approved with a start in the future: the live situation */
const futureNine = (): Row[] => [['H', 'handyman_pro'], ['P', 'professional_pro'], ['E', 'ecommerce_pro']].flatMap(([id, key]) => [3, 6, 12].map((t, i) => row(id, t, lib.OLD_RUPEES[key][i])));

function service(initial: Row[]) {
  const rows = initial.map((r) => ({ ...r }));
  const audit = { record: jest.fn(async () => undefined) };
  const tx = {
    v3PlanPrice: {
      findUnique: async ({ where }: { where: { id: string } }) => { const r = rows.find((x) => x.id === where.id); return r ? { ...r } : null; },
      findMany: async ({ where }: { where: { planId: string; termMonths: number; status: string; currency: string } }) => rows.filter((r) => r.planId === where.planId && r.termMonths === where.termMonths && r.status === where.status && r.currency === where.currency).map((r) => ({ ...r })),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => { const r = rows.find((x) => x.id === where.id)!; Object.assign(r, data); return { ...r }; },
    },
  };
  const svc = new PlansAdminService({ $transaction: async (fn: (t: unknown) => unknown) => fn(tx) } as never, audit as never, { invalidateAll: jest.fn() } as never);
  return { svc, rows, audit };
}

/** what the script does: plan, then withdraw each planned row through the audited service */
async function run(rows: Row[], svc: PlansAdminService, now = NOW) {
  const plan = lib.planWithdrawals(PLANS, rows, now);
  for (const r of plan.withdraw) await svc.withdrawPrice(r.priceId, lib.REASON, ACTOR, now);
  return plan;
}

describe('which rows are withdrawn', () => {
  it('the nine approved, not-started rows with exactly the old amounts, and nothing else', () => {
    const plan = lib.planWithdrawals(PLANS, futureNine(), NOW);
    expect(plan.withdraw.map((w) => `${w.planKey}:${w.termMonths}:${w.amountPaise / 100}`)).toEqual([
      'ecommerce_pro:3:4497', 'ecommerce_pro:6:8095', 'ecommerce_pro:12:14390', 'handyman_pro:3:1497', 'handyman_pro:6:2695', 'handyman_pro:12:4790', 'professional_pro:3:2997', 'professional_pro:6:5395', 'professional_pro:12:9590']);
    expect(plan.leftAlone).toBe(0); expect(plan.missingPlans).toEqual([]);
  });
  it('a price already in force, one that started, a PROPOSED row, a WITHDRAWN row and another currency are left alone even with an old amount', () => {
    const rows = [
      row('H', 3, 1497, { effectiveFrom: day(-1) }),                  // started: in force
      row('H', 6, 2695, { effectiveFrom: new Date(NOW.getTime() - 1) }),
      row('H', 12, 4790, { status: 'PROPOSED' }),
      row('P', 3, 2997, { status: 'WITHDRAWN' }),
      row('P', 6, 5395, { currency: 'USD' }),
    ];
    const plan = lib.planWithdrawals(PLANS, rows, NOW);
    expect(plan.withdraw).toEqual([]); expect(plan.leftAlone).toBe(5);
  });
  it('an unrelated amount is left alone, and so is an old amount of ANOTHER plan or term', () => {
    const rows = [
      row('H', 3, 2247), row('H', 6, 3774), row('E', 12, 15588),     // the new owner prices, future dated: not touched
      row('H', 3, 2997), row('P', 12, 1497), row('E', 6, 4497),      // an old amount, but not this plan's amount for this term
      row('H', 3, 1497.5 as never as number),                        // not exactly the amount
      row('H', 1, 1497),                                             // a term that is not one of 3, 6, 12
    ];
    expect(lib.planWithdrawals(PLANS, rows, NOW).withdraw).toEqual([]);
  });
  it('a plan that is not one of the three (or a missing one) is never touched', () => {
    const rows = [row('X', 3, 1497)];
    expect(lib.planWithdrawals([{ id: 'X', key: 'some_other_pro' }], rows, NOW)).toMatchObject({ withdraw: [], missingPlans: ['handyman_pro', 'professional_pro', 'ecommerce_pro'] });
  });
});

describe('through the audited service', () => {
  it('withdraws the nine, one audit row each with the reason, rows and history kept, and leaves the in-force prices and proposals alone', async () => {
    const inForce = [row('H', 3, 3000, { effectiveFrom: day(-10) }), row('P', 3, 6000, { effectiveFrom: day(-10) })];
    const proposed = [row('H', 3, 2247, { status: 'PROPOSED' }), row('P', 3, 4497, { status: 'PROPOSED' })];
    const { svc, rows, audit } = service([...futureNine(), ...inForce, ...proposed]);
    const plan = await run(rows, svc);
    expect(plan.withdraw).toHaveLength(9);
    expect(audit.record).toHaveBeenCalledTimes(9);
    for (const call of (audit.record as jest.Mock).mock.calls) { expect(call[2]).toBe('price.withdraw'); expect(call[6]).toMatchObject({ status: 'WITHDRAWN', reason: 'Wrong amount, replaced by owner decision of 18 Nov 2026', wasInForce: false }); }
    expect(rows.filter((r) => r.status === 'WITHDRAWN')).toHaveLength(9);
    for (const r of rows.filter((x) => x.status === 'WITHDRAWN')) expect([r.effectiveFrom.getTime(), r.createdAt.getTime()]).toEqual([day(3).getTime(), day(-5).getTime()]);   // history not edited
    expect(rows.filter((r) => r.status === 'APPROVED').map((r) => r.id).sort()).toEqual(inForce.map((r) => r.id).sort());
    expect(rows.filter((r) => r.status === 'PROPOSED')).toHaveLength(2);
    const sum = lib.summarise(PLANS, rows, NOW);
    expect(sum.find((s) => s.planKey === 'handyman_pro' && s.termMonths === 3)).toEqual({ planKey: 'handyman_pro', termMonths: 3, inForce: 300_000, proposed: [224_700] });
    expect(sum.find((s) => s.planKey === 'handyman_pro' && s.termMonths === 6)).toEqual({ planKey: 'handyman_pro', termMonths: 6, inForce: null, proposed: [] });
  });
  it('safe to run twice: the second run finds nothing and writes nothing', async () => {
    const { svc, rows, audit } = service(futureNine());
    await run(rows, svc);
    const again = await run(rows, svc);
    expect(again.withdraw).toEqual([]); expect(audit.record).toHaveBeenCalledTimes(9);
  });
  it('a row that has started by the time of the second look is never withdrawn (the script re-checks; the service also records wasInForce)', async () => {
    const { svc, rows } = service([row('H', 3, 1497, { effectiveFrom: day(1) })]);
    const plan = lib.planWithdrawals(PLANS, rows, NOW);
    expect(plan.withdraw).toHaveLength(1);
    expect(lib.planWithdrawals(PLANS, rows, day(2)).withdraw).toEqual([]);   // two days later it is in force: the planner leaves it alone
    void svc;
  });
});

describe('the script file', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts/live/withdraw-future-prices.js'), 'utf8');
  it('is a dry run by default, asks for LIVE in a terminal, goes through the audited service and writes no SQL', () => {
    expect(src).toMatch(/const apply = flags\.includes\('--apply'\)/);
    expect(src).toMatch(/Type LIVE to continue/); expect(src).toMatch(/process\.stdin\.isTTY/); expect(src).toMatch(/service\.withdrawPrice\(/);
    expect(src).not.toMatch(/\$executeRaw|\$queryRaw|\.updateMany\(|\.deleteMany\(|\.delete\(|\.update\(|\.create\(/);
  });
});
