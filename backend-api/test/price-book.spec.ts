import { PriceRowIn, lineFor, shapePriceBook } from '../src/v3-services/core/price-book-core';
import { effectiveRolesFor } from '../src/auth/guards/admin-role-matrix';
import { shapePublicPricing, PricingRows } from '../src/plans/public/public-pricing.shape';
import { PlansAdminService } from '../src/plans/admin/plans-admin.service';
import { AuditService } from '../src/plans/admin/audit.service';
import { EntitlementsService } from '../src/plans/entitlements/entitlements.service';
import { PlansRepository } from '../src/plans/entitlements/plans.repository';
import { fakePrisma, STAFF, T0 } from './support/fake-plans-prisma';

/** Dispatch G1 B2: the price book overview, approving a plan price, who may do it, and the theme switch fee on the public pricing. */
const NOW = new Date('2026-11-17T10:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const row = (over: Partial<PriceRowIn> = {}): PriceRowIn => ({ id: 'r1', ownerId: 'P', termMonths: 3, amountPaise: 100_000, taxInclusive: false, status: 'APPROVED', effectiveFrom: day(-1), ...over });
const code = (e: unknown): string | undefined => ((e as { getResponse?: () => { code?: string } }).getResponse?.() as { code?: string } | undefined)?.code;
const rejects = async (p: Promise<unknown>): Promise<unknown> => p.then(() => { throw new Error('expected a rejection'); }, (e) => e);

describe('the state of one price line', () => {
  it('no row at all is PRICE_PENDING and never a number', () => expect(lineFor([], NOW)).toMatchObject({ state: 'PRICE_PENDING', amountPaise: null, priceId: null }));
  it('an approved row that has started is IN_FORCE; the newest started row wins', () => {
    expect(lineFor([row({ id: 'old', amountPaise: 90_000, effectiveFrom: day(-30) }), row({ id: 'new', amountPaise: 110_000, effectiveFrom: day(-2) })], NOW)).toMatchObject({ state: 'IN_FORCE', priceId: 'new', amountPaise: 110_000 });
  });
  it('an approved row that starts later is SCHEDULED (the earliest one is named); a started row still wins over it', () => {
    expect(lineFor([row({ id: 'a', effectiveFrom: day(10) }), row({ id: 'b', effectiveFrom: day(5) })], NOW)).toMatchObject({ state: 'SCHEDULED', priceId: 'b' });
    expect(lineFor([row({ id: 'now', effectiveFrom: day(-1) }), row({ id: 'next', effectiveFrom: day(5) })], NOW)).toMatchObject({ state: 'IN_FORCE', priceId: 'now' });
  });
  it('a PROPOSED row is shown to the admin as PROPOSED; a RETIRED row counts for nothing', () => {
    expect(lineFor([row({ status: 'PROPOSED', effectiveFrom: null })], NOW)).toMatchObject({ state: 'PROPOSED', amountPaise: 100_000 });
    expect(lineFor([row({ status: 'RETIRED' })], NOW)).toMatchObject({ state: 'PRICE_PENDING', amountPaise: null });
  });
  it('an approved row with no start date is not in force (it never starts)', () => expect(lineFor([row({ effectiveFrom: null })], NOW).state).toBe('PRICE_PENDING'));
});

describe('the price book', () => {
  const plans = [{ id: 'P', key: 'handyman_pro', track: 'HANDYMAN', level: 'PRO', name: 'Handyman Pro', status: 'ACTIVE' }, { id: 'F', key: 'handyman_free', track: 'HANDYMAN', level: 'FREE', name: 'Handyman Free', status: 'ACTIVE' }];
  const base = {
    now: NOW, plans, planPrices: [row({ id: 'p3', termMonths: 3 }), row({ id: 'p6', termMonths: 6, status: 'PROPOSED', effectiveFrom: day(1) })],
    services: [{ id: 'S1', key: 'THEME_SWITCH', name: 'Theme switch', status: 'ACTIVE' }, { id: 'S2', key: 'LOGO_DESIGN', name: 'Logo', status: 'ACTIVE' }],
    servicePrices: [row({ id: 's2', ownerId: 'S2', status: 'PROPOSED', effectiveFrom: null, amountPaise: 29_900 })], packs: [{ id: 'K1', key: 'STARTER', name: 'Starter', status: 'ACTIVE' }], packPrices: [] as PriceRowIn[], withMoney: true,
  };
  it('lists each paid plan by the three terms (a Free plan has no price), the services, the packs, with a count of each state', () => {
    const b = shapePriceBook(base);
    expect(b.plans).toHaveLength(1); expect(b.plans[0].terms.map((t) => [t.termMonths, t.state])).toEqual([[3, 'IN_FORCE'], [6, 'PROPOSED'], [12, 'PRICE_PENDING']]);
    expect(b.services.map((s) => [s.key, s.state])).toEqual([['LOGO_DESIGN', 'PROPOSED'], ['THEME_SWITCH', 'PRICE_PENDING']]); expect(b.packs.map((p) => p.state)).toEqual(['PRICE_PENDING']);
    expect(b.summary).toEqual({ total: 6, inForce: 1, scheduled: 0, proposed: 2, pending: 3 });
  });
  it('the theme switch fee is lifted out: pending until a price exists, then the number', () => {
    expect(shapePriceBook(base).themeSwitch).toMatchObject({ key: 'THEME_SWITCH', state: 'PRICE_PENDING', amountPaise: null });
    const priced = shapePriceBook({ ...base, servicePrices: [...base.servicePrices, row({ id: 'ts', ownerId: 'S1', amountPaise: 29_900 })] });
    expect(priced.themeSwitch).toMatchObject({ state: 'IN_FORCE', amountPaise: 29_900, priceId: 'ts' });
  });
  it('without money rights every amount is hidden but the states stay; nothing is ever invented for a missing row', () => {
    const b = shapePriceBook({ ...base, withMoney: false });
    expect(JSON.stringify(b)).not.toMatch(/100000|29900/); expect(b.plans[0].terms[0].state).toBe('IN_FORCE'); expect(b.plans[0].terms[2].amountPaise).toBeNull();
  });
});

describe('who may do what', () => {
  it('approving a plan price is SUPER_ADMIN only; the overview is operations and the owner, never MARKETING and not the ADMIN role', () => {
    expect(effectiveRolesFor('POST /v3/admin/prices/:priceId/approve')).toEqual(['SUPER_ADMIN']);
    const read = effectiveRolesFor('GET /v3/admin/price-book'); expect(read).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'OPERATIONS'])); expect(read).not.toContain('MARKETING'); expect(read).not.toContain('ADMIN');
  });
});

class NullRepo extends PlansRepository {
  async loadCatalogue() { return { plans: [], matrix: new Map(), featureKeys: [], settings: { graceDays: 7, downgradeBehaviour: 'FALL_TO_FREE' } }; }
  async loadVendorState() { return { flagOn: false, subscription: null, overrides: [] }; }
}
describe('approving a plan price', () => {
  const make = () => { const prisma = fakePrisma(); const ents = new EntitlementsService(new NullRepo()); const spy = jest.spyOn(ents, 'invalidateAll'); return { prisma, spy, plans: new PlansAdminService(prisma as never, new AuditService(prisma as never), ents) }; };
  const proposed = { id: 'pr1', planId: 'P', termMonths: 3, amountPaise: 149700, taxInclusive: false, status: 'PROPOSED', effectiveFrom: T0 };
  it('a proposed price becomes APPROVED from now, with one audit row and the cache cleared', async () => {
    const s = make(); s.prisma.v3PlanPrice.findUnique.mockResolvedValue(proposed); s.prisma.v3PlanPrice.findFirst.mockResolvedValue(null); s.prisma.v3PlanPrice.update.mockResolvedValue({ ...proposed, status: 'APPROVED', effectiveFrom: NOW });
    const out = await s.plans.approvePrice('pr1', {}, STAFF, NOW);
    expect(out).toMatchObject({ status: 'APPROVED' }); expect(s.prisma.v3PlanPrice.update.mock.calls[0][0]).toMatchObject({ where: { id: 'pr1' }, data: { status: 'APPROVED', effectiveFrom: NOW } });
    expect(s.prisma.v3AuditLog.create.mock.calls.map((c: unknown[]) => (c[0] as { data: { action: string } }).data.action)).toEqual(['price.approve']); expect(s.spy).toHaveBeenCalledTimes(1);
  });
  it('a later date is allowed; a past date, a bad date and an unknown price are refused; an approved price is returned unchanged', async () => {
    const s = make(); s.prisma.v3PlanPrice.findUnique.mockResolvedValue(proposed); s.prisma.v3PlanPrice.findFirst.mockResolvedValue(null); s.prisma.v3PlanPrice.update.mockImplementation(async (a: { data: object }) => ({ ...proposed, ...a.data }));
    expect((await s.plans.approvePrice('pr1', { effectiveFrom: day(3).toISOString() }, STAFF, NOW)).effectiveFrom).toEqual(day(3));
    expect(code(await rejects(s.plans.approvePrice('pr1', { effectiveFrom: day(-1).toISOString() }, STAFF, NOW)))).toBe('PRICE_DATE_IN_PAST');
    expect(code(await rejects(s.plans.approvePrice('pr1', { effectiveFrom: 'nonsense' }, STAFF, NOW)))).toBe('PRICE_DATE_INVALID');
    const u = make(); u.prisma.v3PlanPrice.findUnique.mockResolvedValue(null); await expect(u.plans.approvePrice('nope', {}, STAFF, NOW)).rejects.toMatchObject({ status: 404 });
    const a = make(); a.prisma.v3PlanPrice.findUnique.mockResolvedValue({ ...proposed, status: 'APPROVED' }); await a.plans.approvePrice('pr1', {}, STAFF, NOW);
    expect(a.prisma.v3PlanPrice.update).not.toHaveBeenCalled(); expect(a.prisma.v3AuditLog.create).not.toHaveBeenCalled();
  });
  it('two prices of one plan and term may not start at the same moment (409)', async () => {
    const s = make(); s.prisma.v3PlanPrice.findUnique.mockResolvedValue(proposed); s.prisma.v3PlanPrice.findFirst.mockResolvedValue({ id: 'other' });
    expect(code(await rejects(s.plans.approvePrice('pr1', {}, STAFF, NOW)))).toBe('PRICE_START_CLASH'); expect(s.prisma.v3PlanPrice.update).not.toHaveBeenCalled();
  });
});

describe('the public pricing shows the theme switch fee', () => {
  const rows = (over: Partial<PricingRows> = {}): PricingRows => ({ now: NOW, plans: [], prices: [], tax: { name: 'GST', ratePercent: 18 }, capabilities: [], tierCells: [], addonPacks: [], addonPrices: [], ...over });
  it('PRICE_PENDING with no number until a price is approved and started; then the amount before GST, the GST and the total', () => {
    expect(shapePublicPricing(rows()).themeSwitch).toEqual({ state: 'PRICE_PENDING', price: null });
    expect(shapePublicPricing(rows({ themeSwitchPrices: [{ amountPaise: 29_900, currency: 'INR', taxInclusive: false, status: 'PROPOSED', effectiveFrom: null }] })).themeSwitch).toEqual({ state: 'PRICE_PENDING', price: null });
    expect(shapePublicPricing(rows({ themeSwitchPrices: [{ amountPaise: 29_900, currency: 'INR', taxInclusive: false, status: 'APPROVED', effectiveFrom: day(2) }] })).themeSwitch.state).toBe('PRICE_PENDING');
    const live = shapePublicPricing(rows({ themeSwitchPrices: [{ amountPaise: 29_900, currency: 'INR', taxInclusive: false, status: 'APPROVED', effectiveFrom: day(-1) }] })).themeSwitch;
    expect(live).toEqual({ state: 'AVAILABLE', price: { priceMinor: 29_900, gstMinor: 5_382, totalMinor: 35_282 } });
  });
});
