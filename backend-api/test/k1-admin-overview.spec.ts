import { AdminOverviewService } from '../src/v3-admin-overview/admin-overview.service';
import { AdminOverviewController } from '../src/v3-admin-overview/admin-overview.controller';
import { fillSeries, istMonthEdges, sectionsFor, seriesStart } from '../src/v3-admin-overview/overview-core';
import { effectiveRolesFor } from '../src/auth/guards/admin-role-matrix';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';

type Mode = 'off' | 'test' | 'live';
const NOW = new Date('2026-11-19T10:00:00.000Z');

/** An empty database: every count is 0, every aggregate has no rows, every grouped read returns nothing. */
function fakePrisma(over: { plans?: unknown[]; byPlan?: unknown[]; raw?: (sql: string) => unknown[] } = {}) {
  const count = jest.fn().mockResolvedValue(0);
  const agg = jest.fn().mockResolvedValue({ _count: { _all: 0 }, _sum: {}, _min: {} });
  const model = () => ({ count, aggregate: agg, groupBy: jest.fn().mockResolvedValue(over.byPlan ?? []), findMany: jest.fn().mockResolvedValue(over.plans ?? []) });
  const names = ['vendor', 'v3PlanSubscription', 'v3Plan', 'v3SitePublication', 'v3ProvisioningJob', 'v3WalletTopup', 'v3PlanOrder', 'v3Request', 'v3InboxMessage', 'v3DuplicateReview', 'v3Ticket', 'v3DomainOrder', 'v3ServiceRequest', 'referralPartner', 'commissionLedger'];
  const prisma: Record<string, unknown> = {}; for (const n of names) prisma[n] = model();
  const queryRaw = jest.fn((strings: TemplateStringsArray) => Promise.resolve(over.raw ? over.raw(strings.join('?')) : []));
  prisma.$queryRaw = queryRaw;
  return { prisma, count, agg, queryRaw };
}

function service(mode: Mode, over: Parameters<typeof fakePrisma>[0] = {}) {
  const f = fakePrisma(over);
  const settings = { get: jest.fn().mockResolvedValue({ paymentsMode: mode }) };
  const s = new AdminOverviewService(f.prisma as never, settings as never);
  let t = NOW.getTime(); s.clock = () => new Date(t);
  return { s, settings, advance: (ms: number) => { t += ms; }, ...f };
}

describe('K1.1 role filtering: a section a role may not see is absent, not zero', () => {
  const keysOf = (b: Record<string, unknown>) => Object.keys(b).filter((k) => !['generatedAt', 'cacheSeconds', 'sections', 'dailySeries'].includes(k)).sort();
  it.each([
    ['SUPER_ADMIN', ['domainsServices', 'enquiries', 'referrals', 'revenue', 'support', 'vendors']],
    ['ADMIN', ['domainsServices', 'enquiries', 'referrals', 'revenue', 'support', 'vendors']],
    ['OPERATIONS', ['domainsServices', 'enquiries', 'referrals', 'revenue', 'support', 'vendors']],
    ['MARKETING', ['enquiries', 'referrals', 'vendors']],
    ['FINANCE', ['revenue']],
  ])('%s gets exactly its sections', async (role, expected) => {
    const { s } = service('test');
    const body = await s.overview(role);
    expect(keysOf(body)).toEqual(expected);
    expect([...(body.sections as string[])].sort()).toEqual(expected);
  });
  it('SALES (MARKETING) never receives money, tickets or the paid-orders series', async () => {
    const { s, queryRaw } = service('test');
    const body = await s.overview('MARKETING');
    for (const k of ['revenue', 'support', 'domainsServices']) expect(k in body).toBe(false);
    expect(Object.keys(body.dailySeries as object).sort()).toEqual(['enquiries', 'vendors']);
    expect(queryRaw.mock.calls.map((c) => (c[0] as unknown as string[]).join('?')).join(' ')).not.toContain('g4d_plan_orders');
  });
  it('FINANCE gets only the revenue series; an unknown role or none gets no sections at all', async () => {
    const { s } = service('test');
    expect(Object.keys(((await s.overview('FINANCE')).dailySeries as object))).toEqual(['paidOrders']);
    for (const r of ['SUPPORT', 'TELECALLER', undefined]) { const b = await s.overview(r); expect(b.sections).toEqual([]); expect('dailySeries' in b).toBe(false); }
  });
  it('the route matrix lets SUPER_ADMIN, OPERATIONS, ADMIN and SALES in, and keeps SUPPORT out', () => {
    expect([...effectiveRolesFor('GET /v3/admin/overview')].sort()).toEqual(['ADMIN', 'MARKETING', 'OPERATIONS', 'SUPER_ADMIN']);
  });
  it('sectionsFor gives nothing to a role it does not know', () => { expect(sectionsFor('NOPE')).toEqual([]); expect(sectionsFor(undefined)).toEqual([]); });
});

describe('K1.3 an empty database answers with real zeros, never invented numbers', () => {
  it('every count is 0, ages are null, the series are 30 zero days', async () => {
    const { s } = service('test', { plans: [
      { id: 'p1', key: 'handyman_free', name: 'Handyman Free', level: 'FREE', track: 'HANDYMAN' },
      { id: 'p2', key: 'handyman_pro', name: 'Handyman Pro', level: 'PRO', track: 'HANDYMAN' },
    ] });
    const b = await s.overview('SUPER_ADMIN') as Record<string, any>;
    expect(b.vendors).toMatchObject({ total: 0, new7Days: 0, new30Days: 0, sites: { live: 0, failed: 0, provisioning: 0 }, byPlan: { free: 0, noPlan: 0 } });
    expect(b.vendors.byPlan.pro).toEqual([{ planKey: 'handyman_pro', name: 'Handyman Pro', track: 'HANDYMAN', level: 'PRO', vendors: 0 }]);
    expect(b.revenue.thisMonth).toMatchObject({ paidOrders: 0, invoices: 0, grossPaise: 0, gstPaise: 0, netOfGstPaise: 0, walletTopups: { count: 0, paise: 0 }, refunds: { count: 0, paise: 0 } });
    expect(b.enquiries).toEqual({ captured7Days: 0, captured30Days: 0, held: 0, heldDuplicatesWaitingReview: 0 });
    expect(b.support).toEqual({ openTickets: 0, oldestOpenAgeMinutes: null });
    expect(b.domainsServices.domainOrders).toEqual({ pending: 0, failed: 0 });
    expect(b.domainsServices.serviceQueue.oldestWaitingAgeMinutes).toBeNull();
    expect(b.referrals).toEqual({ partners: { active: 0, new7Days: 0, new30Days: 0 }, commissionsPending: { count: 0, amountPaise: 0 } });
    for (const k of ['vendors', 'enquiries', 'paidOrders']) { expect(b.dailySeries[k]).toHaveLength(30); expect(b.dailySeries[k].every((d: { count: number }) => d.count === 0)).toBe(true); }
    expect(b.dailySeries.vendors[29].date).toBe('2026-11-19');
    expect(b.generatedAt).toBe(NOW.toISOString());
  });
  it('real rows flow through: revenue is split before and after GST, and a plan with vendors is counted', async () => {
    const { s } = service('test', {
      plans: [{ id: 'p1', key: 'handyman_free', name: 'Handyman Free', level: 'FREE', track: 'HANDYMAN' }, { id: 'p2', key: 'handyman_pro', name: 'Handyman Pro', level: 'PRO', track: 'HANDYMAN' }],
      byPlan: [{ planId: 'p1', _count: { _all: 7 } }, { planId: 'p2', _count: { _all: 2 } }],
      raw: (sql) => (sql.includes('g4d_plan_invoices') ? [{ m: 'this', orders: 2n, invoices: 2n, gross: 11800n, tax: 1800n }] : sql.includes('"Vendor"') ? [{ day: '2026-11-18', n: 3n }] : []),
    });
    const b = await s.overview('SUPER_ADMIN') as Record<string, any>;
    expect(b.revenue.thisMonth).toMatchObject({ paidOrders: 2, invoices: 2, grossPaise: 11800, gstPaise: 1800, netOfGstPaise: 10000 });
    expect(b.revenue.lastMonth.paidOrders).toBe(0);
    expect(b.vendors.byPlan.free).toBe(7);
    expect(b.vendors.byPlan.pro[0].vendors).toBe(2);
    expect(b.dailySeries.vendors.find((d: { date: string }) => d.date === '2026-11-18').count).toBe(3);
  });
});

describe('K1.3 payments off', () => {
  it('revenue and the paid-orders series are null, the money tables are not read, and other sections still answer', async () => {
    const { s, queryRaw } = service('off');
    const b = await s.overview('SUPER_ADMIN') as Record<string, any>;
    expect(b.revenue).toBeNull(); expect('revenue' in b).toBe(true);
    expect(b.dailySeries.paidOrders).toBeNull();
    expect(b.vendors.total).toBe(0);
    expect(queryRaw.mock.calls.map((c) => (c[0] as unknown as string[]).join('?')).join(' ')).not.toContain('g4d_plan_orders');
  });
  it('switching payments on shows real figures at once (the off answer is never kept)', async () => {
    const f = fakePrisma(); let mode: Mode = 'off';
    const s = new AdminOverviewService(f.prisma as never, { get: async () => ({ paymentsMode: mode }) } as never); s.clock = () => NOW;
    expect(((await s.overview('SUPER_ADMIN')) as Record<string, unknown>).revenue).toBeNull();
    mode = 'test';
    expect(((await s.overview('SUPER_ADMIN')) as Record<string, any>).revenue.thisMonth.paidOrders).toBe(0);
  });
});

describe('K1.2 short cache and generatedAt', () => {
  it('a second call inside 60 seconds reads nothing new and keeps the first generatedAt; after 60 seconds it reads again', async () => {
    const { s, count, advance } = service('test');
    const first = await s.overview('SUPER_ADMIN'); const reads = count.mock.calls.length;
    advance(30_000);
    const second = await s.overview('SUPER_ADMIN');
    expect(count.mock.calls.length).toBe(reads); expect(second.generatedAt).toBe(first.generatedAt);
    advance(31_000);
    const third = await s.overview('SUPER_ADMIN');
    expect(count.mock.calls.length).toBeGreaterThan(reads); expect(third.generatedAt).not.toBe(first.generatedAt);
    expect(third.cacheSeconds).toBe(60);
  });
  it('different roles share the same section reads', async () => {
    const { s, count } = service('test');
    await s.overview('SUPER_ADMIN'); const reads = count.mock.calls.length;
    await s.overview('MARKETING');
    expect(count.mock.calls.length).toBe(reads);
  });
  it('a failed read is not kept: the next call tries again', async () => {
    const f = fakePrisma(); const s = new AdminOverviewService(f.prisma as never, { get: async () => ({ paymentsMode: 'test' }) } as never); s.clock = () => NOW;
    (f.prisma.referralPartner as { count: jest.Mock }).count.mockRejectedValueOnce(new Error('db down'));
    await expect(s.overview('MARKETING')).rejects.toThrow('db down');
    await expect(s.overview('MARKETING')).resolves.toMatchObject({ referrals: { partners: { active: 0 } } });
  });
  it('no per-row loops: each section is a fixed number of queries whatever the data (series use one grouped query each)', async () => {
    const { s, queryRaw } = service('test', { raw: () => Array.from({ length: 500 }, (_, i) => ({ day: `2026-11-${String((i % 19) + 1).padStart(2, '0')}`, n: 1n })) });
    await s.overview('SUPER_ADMIN');
    expect(queryRaw).toHaveBeenCalledTimes(4);   // revenue, and one grouped query for each of the three series
  });
});

describe('K1 series SQL labels the stored UTC time before converting to India time (found by the staging check)', () => {
  it('all three day-grouping queries use (col AT TIME ZONE \'UTC\') AT TIME ZONE \'Asia/Kolkata\'', async () => {
    const { s, queryRaw } = service('test');
    await s.overview('SUPER_ADMIN');
    const sqls = queryRaw.mock.calls.map((c) => (c[0] as unknown as string[]).join('?')).filter((q) => q.includes('to_char'));
    expect(sqls).toHaveLength(3);
    for (const q of sqls) { expect(q).toMatch(/AT TIME ZONE 'UTC'\) AT TIME ZONE 'Asia\/Kolkata'/); expect(q).not.toMatch(/"(createdAt|paidAt)" AT TIME ZONE 'Asia/); }
  });
});

describe('K1 India-time helpers', () => {
  it('month edges follow India time (a payment at 01:00 IST on the 1st belongs to the new month)', () => {
    const e = istMonthEdges(new Date('2026-10-31T19:30:00.000Z'));   // 01:00 IST on 1 November
    expect(e.thisStart.toISOString()).toBe('2026-10-31T18:30:00.000Z'); expect(e.lastStart.toISOString()).toBe('2026-09-30T18:30:00.000Z'); expect(e.nextStart.toISOString()).toBe('2026-11-30T18:30:00.000Z');
  });
  it('month edges roll over the year', () => { expect(istMonthEdges(new Date('2026-01-10T00:00:00Z')).lastStart.toISOString()).toBe('2025-11-30T18:30:00.000Z'); });
  it('the series is 30 days, oldest first, ends today and fills gaps with 0', () => {
    const s = fillSeries([{ day: '2026-11-10', n: 4 }], NOW);
    expect(s).toHaveLength(30); expect(s[0].date).toBe('2026-10-21'); expect(s[29].date).toBe('2026-11-19'); expect(s.find((d) => d.date === '2026-11-10')?.count).toBe(4);
    expect(seriesStart(NOW).toISOString()).toBe('2026-10-20T18:30:00.000Z');
  });
});

describe('K1 controller', () => {
  it('passes the caller\'s staff role (a SUPER_ADMIN vendor row counts as SUPER_ADMIN)', async () => {
    const overview = jest.fn().mockResolvedValue({ ok: true });
    const c = new AdminOverviewController({ overview } as never);
    await c.overview({ sub: 'u1', role: 'ADMIN', adminRole: 'MARKETING' } as unknown as AuthenticatedUser);
    await c.overview({ sub: 'u2', role: 'SUPER_ADMIN' } as unknown as AuthenticatedUser);
    expect(overview.mock.calls.map((x) => x[0])).toEqual(['MARKETING', 'SUPER_ADMIN']);
  });
});
