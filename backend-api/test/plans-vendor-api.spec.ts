import { ForbiddenException } from '@nestjs/common';
import { shapePublicPlans, PublicPlanRows } from '../src/plans/public/public-plans.shape';
import { MePlansService } from '../src/plans/me/me-plans.service';
import { EntitlementsService } from '../src/plans/entitlements/entitlements.service';
import { PlansRepository } from '../src/plans/entitlements/plans.repository';
import { EngineCell } from '../src/plans/entitlements/entitlement-engine';
import { TenantGuard } from '../src/common/tenant/tenant.guard';
import { VendorOwnerGuard } from '../src/common/guards/vendor-owner.guard';
import { fakePrisma, T0 } from './support/fake-plans-prisma';

/** S51.7: the public plan comparison and the vendor's own entitlement, subscription and event routes. */
const NOW = new Date('2027-03-01T00:00:00.000Z');
const D = (s: string) => new Date(s);

function rows(over: Partial<PublicPlanRows> = {}): PublicPlanRows {
  return {
    now: NOW,
    plans: [
      { id: 'P1', key: 'handyman_pro', track: 'HANDYMAN', level: 'PRO', name: 'Handyman Pro', description: 'Pro', status: 'ACTIVE', isPublic: true, sortOrder: 2 },
      { id: 'P0', key: 'handyman_free', track: 'HANDYMAN', level: 'FREE', name: 'Handyman Free', description: 'Free', status: 'ACTIVE', isPublic: true, sortOrder: 1 },
      { id: 'PX', key: 'ecommerce_pro', track: 'ECOMMERCE', level: 'PRO', name: 'Draft', description: null, status: 'DRAFT', isPublic: true, sortOrder: 9 },
      { id: 'PY', key: 'professional_pro', track: 'PROFESSIONAL', level: 'PRO', name: 'Private', description: null, status: 'ACTIVE', isPublic: false, sortOrder: 8 },
      { id: 'PZ', key: 'professional_free', track: 'PROFESSIONAL', level: 'FREE', name: 'Old', description: null, status: 'RETIRED', isPublic: true, sortOrder: 7 },
    ],
    prices: [
      { id: 'x1', planId: 'P1', termMonths: 3, amountPaise: 149700, currency: 'INR', taxInclusive: false, status: 'APPROVED', effectiveFrom: D('2027-01-01Z') },
      { id: 'x2', planId: 'P1', termMonths: 3, amountPaise: 159700, currency: 'INR', taxInclusive: false, status: 'APPROVED', effectiveFrom: D('2027-02-01Z') },   // newer, wins
      { id: 'x3', planId: 'P1', termMonths: 3, amountPaise: 999900, currency: 'INR', taxInclusive: false, status: 'APPROVED', effectiveFrom: D('2028-01-01Z') },   // not started yet
      { id: 'x4', planId: 'P1', termMonths: 6, amountPaise: 269500, currency: 'INR', taxInclusive: false, status: 'PROPOSED', effectiveFrom: D('2027-01-01Z') },    // not approved
      { id: 'x5', planId: 'P1', termMonths: 12, amountPaise: 479000, currency: 'INR', taxInclusive: true, status: 'APPROVED', effectiveFrom: D('2027-01-01Z') },
      { id: 'x6', planId: 'PX', termMonths: 3, amountPaise: 1, currency: 'INR', taxInclusive: false, status: 'APPROVED', effectiveFrom: D('2027-01-01Z') },
    ],
    cells: [
      { planId: 'P0', featureKey: 'site.video', state: 'LOCKED_PREVIEW', limitValue: null, enumValue: null, upsellText: 'Add video with Pro.' },
      { planId: 'P0', featureKey: 'site.booking', state: 'HIDDEN', limitValue: null, enumValue: null, upsellText: null },
      { planId: 'P0', featureKey: 'site.pages', state: 'LIMITED', limitValue: 1, enumValue: null, upsellText: null },
      { planId: 'P1', featureKey: 'site.video', state: 'ACTIVE', limitValue: null, enumValue: null, upsellText: null },
    ],
    features: [
      { key: 'site.video', name: 'Video', group: 'Website', kind: 'BOOLEAN', unit: null, sortOrder: 10 },
      { key: 'site.booking', name: 'Booking', group: 'Website', kind: 'BOOLEAN', unit: null, sortOrder: 20 },
      { key: 'site.pages', name: 'Pages', group: 'Website', kind: 'LIMIT', unit: 'pages', sortOrder: 5 },
    ],
    tax: { name: 'GST', ratePercent: 18 },
    allowMonthly: false,
    ...over,
  };
}

describe('GET /v3/plans (public comparison)', () => {
  const out = shapePublicPlans(rows());

  it('lists only ACTIVE, public plans, in sort order', () => {
    expect(out.plans.map((p) => p.key)).toEqual(['handyman_free', 'handyman_pro']);
  });

  it('prices: only APPROVED rows that have started, the latest per term; Free plans have none', () => {
    const pro = out.plans.find((p) => p.key === 'handyman_pro')!;
    expect(pro.prices).toEqual([
      { termMonths: 3, amountPaise: 159700, currency: 'INR', taxInclusive: false },
      { termMonths: 12, amountPaise: 479000, currency: 'INR', taxInclusive: true },
    ]);
    expect(out.plans.find((p) => p.key === 'handyman_free')!.prices).toEqual([]);
  });

  it('feature rows: HIDDEN ones are left out; the rest carry name, group, kind, state, limit and the upsell text, in catalogue order', () => {
    const free = out.plans.find((p) => p.key === 'handyman_free')!;
    expect(free.features.map((f) => f.key)).toEqual(['site.pages', 'site.video']);
    expect(free.features[1]).toEqual({ key: 'site.video', name: 'Video', group: 'Website', kind: 'BOOLEAN', unit: null, state: 'LOCKED_PREVIEW', limit: null, enumValue: null, upsellText: 'Add video with Pro.' });
  });

  it('the sellable terms and the tax note are included; a monthly term appears only when the setting allows it', () => {
    expect(out.terms).toEqual([3, 6, 12]);
    expect(out.tax).toEqual({ name: 'GST', ratePercent: 18 });
    expect(shapePublicPlans(rows({ allowMonthly: true })).terms).toEqual([1, 3, 6, 12]);
  });

  it('nothing internal: no ids, no statuses, no sort order, no settings, no timestamps', () => {
    const text = JSON.stringify(out);
    expect(text).not.toMatch(/"id"|"planId"|"status"|"isPublic"|"sortOrder"|"effectiveFrom"|"createdAt"|"updatedAt"|P0|P1|x1|x2/);
  });
});

class FakeRepo extends PlansRepository {
  async loadCatalogue() {
    return {
      plans: [{ id: 'F', key: 'handyman_free', track: 'HANDYMAN', level: 'FREE', status: 'ACTIVE' }],
      matrix: new Map([['F', new Map([['site.video', { state: 'LOCKED_PREVIEW', limitValue: null, enumValue: null, upsellText: 'Add video with Pro.' } as EngineCell]])]]),
      featureKeys: ['site.video'], settings: { graceDays: 7, downgradeBehaviour: 'FALL_TO_FREE' },
    };
  }
  async loadVendorState(vendorId: string) {
    return vendorId === 'v1'
      ? { flagOn: true, subscription: { id: 's', planId: 'F', status: 'ACTIVE' as const, termMonths: null, startsAt: T0, endsAt: null, graceEndsAt: null }, overrides: [] }
      : { flagOn: false, subscription: null, overrides: [] };
  }
}

describe('MePlansService (the vendor\'s own routes)', () => {
  const setup = () => {
    const prisma = fakePrisma();
    const ent = new EntitlementsService(new FakeRepo(), () => NOW);
    return { prisma, svc: new MePlansService(prisma as never, ent) };
  };

  it('entitlements: the resolved features plus the four theme-kit booleans, for the CALLER\'s vendor only', async () => {
    const { svc } = setup();
    const out = await svc.entitlements('v1');
    expect(out).toMatchObject({ mode: 'V3', plan: 'handyman_free', level: 'FREE', track: 'HANDYMAN', subscriptionStatus: 'ACTIVE', graceWarning: false });
    expect(out.features['site.video']).toEqual({ state: 'LOCKED_PREVIEW', limit: null, enumValue: null, upsellText: 'Add video with Pro.', overLimit: false, source: 'PLAN' });
    expect(out.render).toEqual({ video: false, cart: false, booking: false, customDomain: false });
    expect(JSON.stringify(out)).not.toMatch(/overrideReason|createdByStaffId|reason/);
  });

  it('a legacy vendor gets mode LEGACY and everything hidden (no V3 behaviour)', async () => {
    const { svc } = setup();
    const out = await svc.entitlements('legacy');
    expect(out.mode).toBe('LEGACY');
    expect(out.features['site.video'].state).toBe('HIDDEN');
  });

  it('subscription: the vendor\'s current subscription with the plan and the price it was sold at; none = null with the mode', async () => {
    const { prisma, svc } = setup();
    prisma.v3PlanSubscription.findUnique.mockResolvedValue({
      id: 's1', status: 'ACTIVE', termMonths: 3, startsAt: T0, endsAt: new Date('2027-06-01Z'), graceEndsAt: null, source: 'STAFF',
      priceSnapshotJson: { amountPaise: 149700, currency: 'INR', taxInclusive: false, priceId: 'secret-internal-id' }, plan: { key: 'handyman_pro', name: 'Handyman Pro', track: 'HANDYMAN', level: 'PRO' },
    });
    const out = await svc.subscription('v1');
    expect(prisma.v3PlanSubscription.findUnique.mock.calls[0][0].where).toEqual({ currentVendorId: 'v1' });
    expect(out).toMatchObject({ id: 's1', plan: { key: 'handyman_pro' }, status: 'ACTIVE', termMonths: 3, price: { amountPaise: 149700, currency: 'INR', taxInclusive: false } });
    expect(JSON.stringify(out)).not.toMatch(/secret-internal-id|priceId|createdById/);
    prisma.v3PlanSubscription.findUnique.mockResolvedValue(null);
    prisma.v3PlanSubscription.findFirst.mockResolvedValue(null);
    expect(await svc.subscription('legacy')).toEqual({ subscription: null, mode: 'LEGACY' });
  });

  it('events: paginated and scoped to the caller\'s vendor id (never a vendor id from the request)', async () => {
    const { prisma, svc } = setup();
    prisma.v3SubscriptionEvent.findMany.mockResolvedValue([{ id: 'e1', type: 'ASSIGNED', fromPlanId: null, toPlanId: 'F', reason: null, actorType: 'SYSTEM', actorId: null, at: T0, vendorId: 'v1', subscriptionId: 's1' }]);
    prisma.v3SubscriptionEvent.count.mockResolvedValue(1);
    prisma.v3Plan.findMany.mockResolvedValue([{ id: 'F', key: 'handyman_free' }]);
    const out = await svc.events('v1', { page: 2, pageSize: 10 });
    const call = prisma.v3SubscriptionEvent.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ vendorId: 'v1' });
    expect(call).toMatchObject({ skip: 10, take: 10 });
    expect(out).toMatchObject({ page: 2, pageSize: 10, total: 1 });
    expect(out.items[0]).toEqual({ type: 'ASSIGNED', fromPlan: null, toPlan: 'handyman_free', reason: null, actorType: 'SYSTEM', at: T0 });
  });
});

describe('who may call the vendor routes', () => {
  const ctx = (user: unknown) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as never;
  it('a staff principal is refused by the tenant guard (staff must name a vendor explicitly)', () => {
    expect(() => new TenantGuard().canActivate(ctx({ sub: 's', role: 'ADMIN', kind: 'admin_member' }))).toThrow(ForbiddenException);
  });
  it('the tenant is the verified principal\'s vendor, for an owner and for a team member', () => {
    const owner = ctx({ sub: 'v1', role: 'VENDOR' });
    expect(new TenantGuard().canActivate(owner)).toBe(true);
    const member = { sub: 'v1', role: 'VENDOR', kind: 'team_member', memberId: 'm1' };
    expect(new TenantGuard().canActivate(ctx(member))).toBe(true);
  });
  it('the owner-only guard refuses a team member (subscription and events are billing information)', () => {
    expect(new VendorOwnerGuard().canActivate(ctx({ sub: 'v1', role: 'VENDOR' }))).toBe(true);
    expect(() => new VendorOwnerGuard().canActivate(ctx({ sub: 'v1', role: 'VENDOR', kind: 'team_member' }))).toThrow(ForbiddenException);
  });
});
