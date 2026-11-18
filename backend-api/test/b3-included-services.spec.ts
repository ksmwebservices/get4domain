import { groupOfService, includedView, INCLUDED_GROUPS, validateAllowance } from '../src/v3-services/included/included-core';
import { IncludedAllowanceService } from '../src/v3-services/included/included-allowance.service';
import { effectiveRolesFor } from '../src/auth/guards/admin-role-matrix';
import { servicesWorld, ServicesWorld } from './support/services-world';

/** B3.3: plan allowances for the included services. Nothing is set by default; 'included' only when a quantity is set. */
let w: ServicesWorld;
beforeEach(async () => { w = servicesWorld(); await w.seed(); });
const ACTOR = { type: 'STAFF', id: 'super-1', ip: null } as never;
type Row = { key: string; included: { state: string; group: string | null; limit: number | null; used: number; remaining: number | null }; funding: { kind: string; remaining?: number }; allowance: unknown };
const mine = async (key: string): Promise<Row> => ((await w.catalogue.vendorServices('v1')).items as unknown as Row[]).find((s) => s.key === key)!;

describe('the six groups', () => {
  it('are the owner list, and every service of a group exists in the catalogue seed (a typo would silently never match)', async () => {
    expect(INCLUDED_GROUPS.map((g) => g.key)).toEqual(['REELS', 'POSTERS', 'POSTS', 'BLOGS_CONTENT', 'SUBDOMAIN_SPOTLIGHT', 'SEO_KEYWORD_WORK']);
    const have = new Set((await w.services.services()).map((s) => s.key));
    for (const g of INCLUDED_GROUPS) for (const k of g.serviceKeys) expect([k, have.has(k)]).toEqual([k, true]);
    expect(groupOfService('REEL_CINEMATIC')?.key).toBe('REELS'); expect(groupOfService('THEME_SWITCH')).toBeUndefined();
  });
  it('a missing limit is NOT_SET, never zero and never unlimited; a set limit is INCLUDED', () => {
    expect(includedView('REELS', null, 7)).toEqual({ state: 'NOT_SET', group: 'REELS', limit: null, used: 0, remaining: null });
    expect(includedView('REELS', 4, 1)).toEqual({ state: 'INCLUDED', group: 'REELS', limit: 4, used: 1, remaining: 3 });
  });
  it('validation: term 3, 6 or 12; a known group; a whole number from 1, or null to clear (0 is refused: clear it instead)', () => {
    expect(validateAllowance(12, 'REELS', 3)).toBeNull(); expect(validateAllowance(3, 'POSTS', null)).toBeNull();
    for (const bad of [[1, 'REELS', 3], [12, 'NOPE', 3], [12, 'REELS', 0], [12, 'REELS', 1.5], [12, 'REELS', -1], [12, 'REELS', '3']] as const) expect(validateAllowance(bad[0], bad[1], bad[2])).not.toBeNull();
  });
});

describe('what GET /v3/me/services reports', () => {
  it('by default nothing is included: every service says NOT_SET and every group says NOT_SET', async () => {
    const r = await w.catalogue.vendorServices('v1');
    for (const s of r.items as unknown as Row[]) expect([s.key, s.included.state]).toEqual([s.key, 'NOT_SET']);
    expect(r.includedServices).toHaveLength(6); for (const g of r.includedServices) expect(g.state).toBe('NOT_SET');
    expect((await mine('REEL_SLIDESHOW')).allowance).toBeNull();
  });
  it('a quantity set for the plan and term makes every service of that group INCLUDED (the count is shared) and funds from the allowance first', async () => {
    w.included.limits = { REELS: 3 }; w.usage.used.REEL_SLIDESHOW = 1; w.usage.used.REEL_CINEMATIC = 1;
    const reel = await mine('REEL_CORPORATE');
    expect(reel.included).toEqual({ state: 'INCLUDED', group: 'REELS', limit: 3, used: 2, remaining: 1 });
    expect(reel.funding).toEqual({ kind: 'INCLUDED_ALLOWANCE', remaining: 1 });
    expect((await mine('POSTER_DESIGN')).included.state).toBe('NOT_SET');   // another group stays not set
    w.usage.used.REEL_CORPORATE = 1;   // all three used
    const spent = await mine('REEL_CORPORATE');
    expect(spent.included).toMatchObject({ state: 'INCLUDED', remaining: 0 }); expect(spent.funding.kind).not.toBe('INCLUDED_ALLOWANCE');
  });
  it('a group with no request flow yet (subdomain spotlight) is still reported at the top', async () => {
    w.included.limits = { SUBDOMAIN_SPOTLIGHT: 2 };
    const g = (await w.catalogue.vendorServices('v1')).includedServices.find((x) => x.key === 'SUBDOMAIN_SPOTLIGHT')!;
    expect(g).toMatchObject({ state: 'INCLUDED', limit: 2, remaining: 2 });
  });
});

type K = { planId: string; termMonths: number; groupKey: string };
function fakeDb(plans: Array<{ id: string; key: string; level: string }>, sub: { planId: string; termMonths: number | null } | null) {
  const rows: Array<K & { quantity: number }> = [];
  const audit = { record: jest.fn(async () => undefined) };
  const at = (k: K) => rows.findIndex((r) => r.planId === k.planId && r.termMonths === k.termMonths && r.groupKey === k.groupKey);
  const allowance = {
    findUnique: async ({ where }: { where: { planId_termMonths_groupKey: K } }) => rows[at(where.planId_termMonths_groupKey)] ?? null,
    delete: async ({ where }: { where: { planId_termMonths_groupKey: K } }) => { rows.splice(at(where.planId_termMonths_groupKey), 1); },
    upsert: async ({ where, create, update }: { where: { planId_termMonths_groupKey: K }; create: K & { quantity: number }; update: { quantity: number } }) => {
      const i = at(where.planId_termMonths_groupKey); if (i >= 0) rows[i].quantity = update.quantity; else rows.push({ planId: create.planId, termMonths: create.termMonths, groupKey: create.groupKey, quantity: create.quantity });
    },
    findMany: async ({ where }: { where?: { planId: string; termMonths: number } } = {}) => rows.filter((r) => !where || (r.planId === where.planId && r.termMonths === where.termMonths)),
  };
  const prisma = {
    v3Plan: { findUnique: async ({ where }: { where: { key: string } }) => plans.find((p) => p.key === where.key) ?? null, findMany: async () => plans.filter((p) => p.level === 'PRO').map((p) => ({ ...p, name: p.key, track: 'HANDYMAN' })) },
    v3PlanSubscription: { findUnique: async () => sub },
    v3PlanServiceAllowance: allowance,
    $transaction: async (fn: (t: unknown) => unknown) => fn({ v3PlanServiceAllowance: allowance }),
  };
  return { svc: new IncludedAllowanceService(prisma as never, audit as never), rows, audit };
}
const code = (e: unknown): string | undefined => ((e as { getResponse?: () => { code?: string } }).getResponse?.() as { code?: string } | undefined)?.code;
const PLANS = [{ id: 'P1', key: 'handyman_pro', level: 'PRO' }, { id: 'F1', key: 'handyman_free', level: 'FREE' }];

describe('the SUPER_ADMIN route behind it', () => {
  it('starts with nothing set; setting writes the row and an audit row; the vendor on that plan and term sees it, another term does not', async () => {
    const { svc, rows, audit } = fakeDb(PLANS, { planId: 'P1', termMonths: 12 });
    const m0 = await svc.matrix(); expect(m0.plans[0].terms.every((t) => t.groups.every((g) => g.state === 'NOT_SET' && g.quantity === null))).toBe(true);
    expect(await svc.groupLimits('v1')).toEqual({});
    await svc.set('handyman_pro', 12, 'REELS', 4, ACTOR);
    expect(rows).toEqual([{ planId: 'P1', termMonths: 12, groupKey: 'REELS', quantity: 4 }]); expect(audit.record).toHaveBeenCalledTimes(1);
    expect(await svc.groupLimits('v1')).toEqual({ REELS: 4 });
    await svc.set('handyman_pro', 3, 'POSTS', 2, ACTOR);
    expect(await svc.groupLimits('v1')).toEqual({ REELS: 4 });   // the vendor is on the 12-month term
    const m1 = await svc.matrix(); expect(m1.plans[0].terms.find((t) => t.termMonths === 12)!.groups.find((g) => g.key === 'REELS')).toEqual({ key: 'REELS', state: 'INCLUDED', quantity: 4 });
  });
  it('null clears it back to NOT_SET; the same value again writes no audit row', async () => {
    const { svc, rows, audit } = fakeDb(PLANS, { planId: 'P1', termMonths: 6 });
    await svc.set('handyman_pro', 6, 'POSTERS', 5, ACTOR); await svc.set('handyman_pro', 6, 'POSTERS', 5, ACTOR); expect(audit.record).toHaveBeenCalledTimes(1);
    await svc.set('handyman_pro', 6, 'POSTERS', null, ACTOR); expect(rows).toEqual([]); expect(audit.record).toHaveBeenCalledTimes(2);
  });
  it('a Free vendor (no term) gets nothing; a Free plan, an unknown plan, a bad term, group or quantity are refused', async () => {
    const { svc } = fakeDb(PLANS, { planId: 'F1', termMonths: null });
    expect(await svc.groupLimits('v1')).toEqual({});
    expect(code(await svc.set('handyman_free', 12, 'REELS', 1, ACTOR).then(() => null, (e) => e))).toBe('ALLOWANCE_PLAN_NOT_PAID');
    expect(code(await svc.set('nope', 12, 'REELS', 1, ACTOR).then(() => null, (e) => e))).toBe('UNKNOWN_PLAN');
    for (const a of [[1, 'REELS', 1], [12, 'X', 1], [12, 'REELS', 0]] as const) expect(code(await svc.set('handyman_pro', a[0], a[1], a[2], ACTOR).then(() => null, (e) => e))).toBe('ALLOWANCE_INVALID');
  });
  it('only SUPER_ADMIN writes; reading is OPERATIONS and SUPER_ADMIN', () => {
    expect(effectiveRolesFor('PUT /v3/admin/included-services/:planKey/:termMonths/:groupKey')).toEqual(['SUPER_ADMIN']);
    expect(effectiveRolesFor('GET /v3/admin/included-services')).toContain('OPERATIONS');
  });
});
