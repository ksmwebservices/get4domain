import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { AuditService } from '../src/plans/admin/audit.service';
import { FeaturesAdminService } from '../src/plans/admin/features-admin.service';
import { PlansAdminService } from '../src/plans/admin/plans-admin.service';
import { RulesAdminService } from '../src/plans/admin/rules-admin.service';
import { VendorPlansAdminService } from '../src/plans/admin/vendor-plans-admin.service';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { EntitlementsService } from '../src/plans/entitlements/entitlements.service';
import { PlansRepository } from '../src/plans/entitlements/plans.repository';
import { validateMatrixRow, validateSettingValue, addMonths } from '../src/plans/admin/admin-validation';
import { CreatePriceDto, SaveMatrixDto, UpdatePlanDto, CreateOverrideDto } from '../src/plans/admin/dto/plans-admin.dto';
import { fakePrisma, FakePrisma, STAFF, T0 } from './support/fake-plans-prisma';

/** S51.6: the rules of every admin write, without a database. Each write must (1) obey its rule, (2) write exactly one audit row with before and after, (3) clear the cache. */
const code = (e: unknown): string | undefined => ((e as { getResponse?: () => { code?: string } }).getResponse?.() as { code?: string } | undefined)?.code;
const rejects = async (p: Promise<unknown>): Promise<unknown> => p.then(() => { throw new Error('expected a rejection'); }, (e) => e);

class NullRepo extends PlansRepository {
  async loadCatalogue() { return { plans: [], matrix: new Map(), featureKeys: [], settings: { graceDays: 7, downgradeBehaviour: 'FALL_TO_FREE' } }; }
  async loadVendorState() { return { flagOn: false, subscription: null, overrides: [] }; }
}

function setup() {
  const prisma = fakePrisma();
  const entitlements = new EntitlementsService(new NullRepo());
  const invalidateAll = jest.spyOn(entitlements, 'invalidateAll');
  const invalidate = jest.spyOn(entitlements, 'invalidate');
  const audit = new AuditService(prisma as never);
  const subs = new SubscriptionsService(prisma as never, audit, entitlements);
  return {
    prisma, entitlements, invalidateAll, invalidate,
    plans: new PlansAdminService(prisma as never, audit, entitlements),
    features: new FeaturesAdminService(prisma as never, audit, entitlements),
    rules: new RulesAdminService(prisma as never, audit, entitlements),
    vendors: new VendorPlansAdminService(prisma as never, audit, entitlements, subs),
    subs,
  };
}
const auditRows = (p: FakePrisma) => p.v3AuditLog.create.mock.calls.map((c) => (c[0] as { data: Record<string, unknown> }).data);
const proPlan = { id: 'P', key: 'handyman_pro', track: 'HANDYMAN', level: 'PRO', status: 'ACTIVE', updatedAt: T0 };
const freePlan = { id: 'F', key: 'handyman_free', track: 'HANDYMAN', level: 'FREE', status: 'ACTIVE', updatedAt: T0 };

describe('plans', () => {
  it('create: the key must be track_level; writes one audit row (before null) and clears the cache', async () => {
    const s = setup();
    await expect(s.plans.createPlan({ key: 'wrong', track: 'HANDYMAN', level: 'PRO', name: 'X' }, STAFF)).rejects.toBeInstanceOf(BadRequestException);
    s.prisma.v3Plan.create.mockResolvedValue({ id: 'P', key: 'handyman_pro' });
    await s.plans.createPlan({ key: 'handyman_pro', track: 'HANDYMAN', level: 'PRO', name: 'Handyman Pro' }, STAFF);
    const a = auditRows(s.prisma);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ action: 'plan.create', entityType: 'plan', actorType: 'STAFF', actorId: 'staff1', ip: '127.0.0.1' });
    expect(s.invalidateAll).toHaveBeenCalled();
  });

  it('update: STALE_WRITE (409) when the row changed since it was read; no audit row is written', async () => {
    const s = setup();
    s.prisma.v3Plan.findUnique.mockResolvedValue(proPlan);
    s.prisma.v3Plan.updateMany.mockResolvedValue({ count: 0 });
    const e = await rejects(s.plans.updatePlan('P', { expectedUpdatedAt: T0.toISOString(), name: 'New' }, STAFF));
    expect(e).toBeInstanceOf(ConflictException);
    expect(code(e)).toBe('STALE_WRITE');
    expect(auditRows(s.prisma)).toHaveLength(0);
    expect(s.invalidateAll).not.toHaveBeenCalled();
  });

  it('update: uses expectedUpdatedAt in the WHERE clause and audits before and after', async () => {
    const s = setup();
    s.prisma.v3Plan.findUnique.mockResolvedValue(proPlan);
    s.prisma.v3Plan.updateMany.mockResolvedValue({ count: 1 });
    s.prisma.v3Plan.findUniqueOrThrow.mockResolvedValue({ ...proPlan, name: 'New' });
    await s.plans.updatePlan('P', { expectedUpdatedAt: T0.toISOString(), name: 'New' }, STAFF);
    expect(s.prisma.v3Plan.updateMany.mock.calls[0][0].where).toEqual({ id: 'P', updatedAt: T0 });
    expect(auditRows(s.prisma)[0]).toMatchObject({ action: 'plan.update', entityId: 'P' });
    expect((auditRows(s.prisma)[0].beforeJson as { name?: string }).name).toBeUndefined();
    expect((auditRows(s.prisma)[0].afterJson as { name: string }).name).toBe('New');
  });

  it('delete: a plan that has subscriptions is PLAN_IN_USE (409); an unused plan is deleted and audited', async () => {
    const s = setup();
    s.prisma.v3Plan.findUnique.mockResolvedValue({ ...proPlan, prices: [], features: [] });
    s.prisma.v3PlanSubscription.count.mockResolvedValue(2);
    expect(code(await rejects(s.plans.deletePlan('P', STAFF)))).toBe('PLAN_IN_USE');
    expect(s.prisma.v3Plan.delete).not.toHaveBeenCalled();
    s.prisma.v3PlanSubscription.count.mockResolvedValue(0);
    await s.plans.deletePlan('P', STAFF);
    expect(s.prisma.v3Plan.delete).toHaveBeenCalledWith({ where: { id: 'P' } });
    expect(auditRows(s.prisma).map((r) => r.action)).toEqual(['plan.delete']);
  });

  it('an unknown plan is UNKNOWN_PLAN (404)', async () => {
    const s = setup();
    s.prisma.v3Plan.findUnique.mockResolvedValue(null);
    expect(code(await rejects(s.plans.getPlan('nope')))).toBe('UNKNOWN_PLAN');
  });
});

describe('prices', () => {
  const create = (s: ReturnType<typeof setup>, dto: Partial<CreatePriceDto>, plan = proPlan) => {
    s.prisma.v3Plan.findUnique.mockResolvedValue(plan);
    s.prisma.v3PlanSetting.findUnique.mockResolvedValue(null);
    s.prisma.v3PlanPrice.create.mockResolvedValue({ id: 'pr1', planId: plan.id, ...dto });
    return s.plans.createPrice(plan.id, { termMonths: 3, amountPaise: 149700, ...dto } as CreatePriceDto, STAFF);
  };

  it('INVALID_AMOUNT for a negative, fractional or non-number amount (400)', async () => {
    for (const amountPaise of [-1, 1.5, Number.NaN]) expect(code(await rejects(create(setup(), { amountPaise })))).toBe('INVALID_AMOUNT');
  });

  it('INVALID_TERM for any term except 3, 6, 12 (400); a monthly term works only when allowMonthly is true', async () => {
    for (const termMonths of [0, 1, 2, 5, 24]) expect(code(await rejects(create(setup(), { termMonths })))).toBe('INVALID_TERM');
    const s = setup();
    s.prisma.v3Plan.findUnique.mockResolvedValue(proPlan);
    s.prisma.v3PlanSetting.findUnique.mockResolvedValue({ key: 'allowMonthly', valueJson: true });
    s.prisma.v3PlanPrice.create.mockResolvedValue({ id: 'pr1' });
    await expect(s.plans.createPrice('P', { termMonths: 1, amountPaise: 49900 } as CreatePriceDto, STAFF)).resolves.toBeDefined();
  });

  it('FREE_PLAN_HAS_NO_PRICE (400)', async () => {
    expect(code(await rejects(create(setup(), {}, freePlan)))).toBe('FREE_PLAN_HAS_NO_PRICE');
  });

  it('a valid price is created as PROPOSED and audited', async () => {
    const s = setup();
    await create(s, {});
    expect(s.prisma.v3PlanPrice.create.mock.calls[0][0].data).toMatchObject({ planId: 'P', termMonths: 3, amountPaise: 149700, status: 'PROPOSED', taxInclusive: false });
    expect(auditRows(s.prisma).map((r) => r.action)).toEqual(['price.create']);
  });

  it('update is optimistic (STALE_WRITE) and never touches a subscription (snapshots are copies)', async () => {
    const s = setup();
    s.prisma.v3PlanPrice.findUnique.mockResolvedValue({ id: 'pr1', amountPaise: 1, updatedAt: T0 });
    s.prisma.v3PlanPrice.updateMany.mockResolvedValue({ count: 0 });
    expect(code(await rejects(s.plans.updatePrice('pr1', { expectedUpdatedAt: T0.toISOString(), amountPaise: 2 }, STAFF)))).toBe('STALE_WRITE');
    expect(s.prisma.v3PlanSubscription.updateMany).not.toHaveBeenCalled();
    expect(s.prisma.v3PlanSubscription.update).not.toHaveBeenCalled();
    s.prisma.v3PlanPrice.updateMany.mockResolvedValue({ count: 1 });
    s.prisma.v3PlanPrice.findUniqueOrThrow.mockResolvedValue({ id: 'pr1', amountPaise: 2 });
    await s.plans.updatePrice('pr1', { expectedUpdatedAt: T0.toISOString(), amountPaise: 2 }, STAFF);
    expect(auditRows(s.prisma).map((r) => r.action)).toEqual(['price.update']);
    expect(s.prisma.v3PlanSubscription.updateMany).not.toHaveBeenCalled();
  });

  it('a negative amount on update is INVALID_AMOUNT', async () => {
    const s = setup();
    s.prisma.v3PlanPrice.findUnique.mockResolvedValue({ id: 'pr1', updatedAt: T0 });
    expect(code(await rejects(s.plans.updatePrice('pr1', { expectedUpdatedAt: T0.toISOString(), amountPaise: -5 }, STAFF)))).toBe('INVALID_AMOUNT');
  });
});

describe('features and the matrix', () => {
  it('a feature key must be dotted lower case', async () => {
    const s = setup();
    await expect(s.features.createFeature({ key: 'Video', name: 'Video', group: 'Site', kind: 'BOOLEAN' }, STAFF)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('FEATURE_IN_USE when a plan row or an override uses it (409)', async () => {
    const s = setup();
    s.prisma.v3Feature.findUnique.mockResolvedValue({ id: 'f1', key: 'site.video' });
    s.prisma.v3PlanFeature.count.mockResolvedValue(6);
    s.prisma.v3EntitlementOverride.count.mockResolvedValue(0);
    expect(code(await rejects(s.features.deleteFeature('site.video', STAFF)))).toBe('FEATURE_IN_USE');
    s.prisma.v3PlanFeature.count.mockResolvedValue(0);
    await s.features.deleteFeature('site.video', STAFF);
    expect(auditRows(s.prisma).map((r) => r.action)).toEqual(['feature.delete']);
  });

  it('validateMatrixRow: LIMITED needs a limit, LOCKED_PREVIEW needs upsell text, limits are whole numbers, states are known', () => {
    expect(() => validateMatrixRow({ featureKey: 'site.video', state: 'LIMITED' })).toThrow(/limit/);
    expect(() => validateMatrixRow({ featureKey: 'site.video', state: 'LOCKED_PREVIEW' })).toThrow(/upsell/);
    expect(() => validateMatrixRow({ featureKey: 'site.video', state: 'ACTIVE', limitValue: -1 })).toThrow(/whole number/);
    expect(() => validateMatrixRow({ featureKey: 'site.video', state: 'MAYBE' })).toThrow(/state/);
    expect(() => validateMatrixRow({ featureKey: 'Bad', state: 'ACTIVE' })).toThrow(/feature key/);
    expect(() => validateMatrixRow({ featureKey: 'site.pages', state: 'LIMITED', limitValue: 0 })).not.toThrow();
  });

  it('bulk save: one transaction, the plan version is checked, one audit row with before and after, the cache is cleared', async () => {
    const s = setup();
    s.prisma.v3Plan.findUnique.mockResolvedValue(proPlan);
    s.prisma.v3Plan.findUniqueOrThrow.mockResolvedValue(proPlan);
    s.prisma.v3Feature.findMany.mockResolvedValue([{ key: 'site.video' }, { key: 'site.pages' }]);
    s.prisma.v3Plan.updateMany.mockResolvedValue({ count: 1 });
    s.prisma.v3PlanFeature.findMany.mockResolvedValue([]);
    const dto = { expectedUpdatedAt: T0.toISOString(), rows: [{ featureKey: 'site.video', state: 'ACTIVE' }, { featureKey: 'site.pages', state: 'LIMITED', limitValue: 24 }] } as SaveMatrixDto;
    await s.features.savePlanFeatures('P', dto, STAFF);
    expect(s.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(s.prisma.v3PlanFeature.upsert).toHaveBeenCalledTimes(2);
    expect(auditRows(s.prisma).map((r) => r.action)).toEqual(['plan.features.save']);
    expect(s.invalidateAll).toHaveBeenCalled();
  });

  it('bulk save: a stale plan version is refused before any row is written; an unknown feature or a duplicate is a 400', async () => {
    const s = setup();
    s.prisma.v3Plan.findUnique.mockResolvedValue(proPlan);
    s.prisma.v3Feature.findMany.mockResolvedValue([{ key: 'site.video' }]);
    s.prisma.v3Plan.updateMany.mockResolvedValue({ count: 0 });
    const one = { expectedUpdatedAt: T0.toISOString(), rows: [{ featureKey: 'site.video', state: 'ACTIVE' }] } as SaveMatrixDto;
    expect(code(await rejects(s.features.savePlanFeatures('P', one, STAFF)))).toBe('STALE_WRITE');
    expect(s.prisma.v3PlanFeature.upsert).not.toHaveBeenCalled();
    await expect(s.features.savePlanFeatures('P', { ...one, rows: [{ featureKey: 'nope.nope', state: 'ACTIVE' }] } as SaveMatrixDto, STAFF)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.features.savePlanFeatures('P', { ...one, rows: [one.rows[0], one.rows[0]] } as SaveMatrixDto, STAFF)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('tax, discounts and settings', () => {
  it('a tax rate must be between 0 and 100; a valid one is audited', async () => {
    const s = setup();
    await expect(s.rules.createTaxRate({ name: 'GST', ratePercent: 120 }, STAFF)).rejects.toBeInstanceOf(BadRequestException);
    s.prisma.v3TaxRate.create.mockResolvedValue({ id: 't1', ratePercent: 18 });
    await s.rules.createTaxRate({ name: 'GST', ratePercent: 18 }, STAFF);
    expect(auditRows(s.prisma).map((r) => r.action)).toEqual(['tax.create']);
  });

  it('a discount needs exactly one of percentOff and amountOffPaise; a TERM discount needs a term', async () => {
    const s = setup();
    await expect(s.rules.createDiscountRule({ type: 'PROMO', name: 'x' }, STAFF)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.rules.createDiscountRule({ type: 'PROMO', name: 'x', percentOff: 10, amountOffPaise: 100 }, STAFF)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.rules.createDiscountRule({ type: 'PROMO', name: 'x', percentOff: 101 }, STAFF)).rejects.toBeInstanceOf(BadRequestException);
    expect(code(await rejects(s.rules.createDiscountRule({ type: 'TERM', name: 'x', percentOff: 10, conditions: { termMonths: 5 } }, STAFF)))).toBe('INVALID_TERM');
    s.prisma.v3DiscountRule.create.mockResolvedValue({ id: 'd1', percentOff: 10 });
    await s.rules.createDiscountRule({ type: 'TERM', name: 'Half-yearly', percentOff: 10, conditions: { termMonths: 6 } }, STAFF);
    expect(auditRows(s.prisma).map((r) => r.action)).toEqual(['discount.create']);
  });

  it('settings: a fixed vocabulary with typed values; an unknown key is refused', () => {
    expect(() => validateSettingValue('graceDays', 7)).not.toThrow();
    expect(() => validateSettingValue('graceDays', -1)).toThrow();
    expect(() => validateSettingValue('graceDays', '7')).toThrow();
    expect(() => validateSettingValue('allowMonthly', 'yes')).toThrow();
    expect(() => validateSettingValue('downgradeBehaviour', 'DELETE_EVERYTHING')).toThrow();
    expect(() => validateSettingValue('downgradeBehaviour', 'KEEP_UNTIL_REPLACED')).not.toThrow();
    expect(() => validateSettingValue('renewalReminderDays', [14, 7, 1])).not.toThrow();
    expect(() => validateSettingValue('renewalReminderDays', [14, -7])).toThrow();
    expect(() => validateSettingValue('baseMonthlyPaise.handyman_pro', 49900)).not.toThrow();
    expect(() => validateSettingValue('baseMonthlyPaise.handyman_pro', 499.5)).toThrow();
    expect(() => validateSettingValue('somethingElse', 1)).toThrow(/known plan setting/);
  });

  it('changing an existing setting needs expectedUpdatedAt and is optimistic; creating one does not', async () => {
    const s = setup();
    s.prisma.v3PlanSetting.findUnique.mockResolvedValue({ key: 'graceDays', valueJson: 7, updatedAt: T0 });
    await expect(s.rules.putSetting('graceDays', { valueJson: 10 }, STAFF)).rejects.toBeInstanceOf(BadRequestException);
    s.prisma.v3PlanSetting.updateMany.mockResolvedValue({ count: 0 });
    expect(code(await rejects(s.rules.putSetting('graceDays', { valueJson: 10, expectedUpdatedAt: T0.toISOString() }, STAFF)))).toBe('STALE_WRITE');
    s.prisma.v3PlanSetting.updateMany.mockResolvedValue({ count: 1 });
    s.prisma.v3PlanSetting.findUniqueOrThrow.mockResolvedValue({ key: 'graceDays', valueJson: 10 });
    await s.rules.putSetting('graceDays', { valueJson: 10, expectedUpdatedAt: T0.toISOString() }, STAFF);
    expect(auditRows(s.prisma).map((r) => r.action)).toEqual(['setting.update']);
    const s2 = setup();
    s2.prisma.v3PlanSetting.findUnique.mockResolvedValue(null);
    s2.prisma.v3PlanSetting.create.mockResolvedValue({ key: 'graceDays', valueJson: 7 });
    await s2.rules.putSetting('graceDays', { valueJson: 7 }, STAFF);
    expect(auditRows(s2.prisma).map((r) => r.action)).toEqual(['setting.create']);
  });
});

describe('vendor plan: assignment, overrides, flag', () => {
  const vendorOk = (s: ReturnType<typeof setup>) => s.prisma.vendor.findUnique.mockResolvedValue({ id: 'v1' });

  it('assignment needs a reason (REASON_REQUIRED), a known vendor and a known plan', async () => {
    const s = setup();
    expect(code(await rejects(s.vendors.assign('v1', { planKey: 'handyman_pro', termMonths: 3, reason: ' ' }, STAFF)))).toBe('REASON_REQUIRED');
    s.prisma.vendor.findUnique.mockResolvedValue(null);
    expect(code(await rejects(s.vendors.assign('v1', { planKey: 'handyman_pro', termMonths: 3, reason: 'sold offline' }, STAFF)))).toBe('UNKNOWN_VENDOR');
    vendorOk(s);
    s.prisma.v3Plan.findUnique.mockResolvedValue(null);
    expect(code(await rejects(s.vendors.assign('v1', { planKey: 'nope', reason: 'sold offline' }, STAFF)))).toBe('UNKNOWN_PLAN');
  });

  it('a PRO assignment: term required, end date and grace computed, a COPY of the approved price is kept, the old current row is closed, event and audit written', async () => {
    const s = setup();
    vendorOk(s);
    s.prisma.v3Plan.findUnique.mockResolvedValue(proPlan);
    s.prisma.v3PlanSetting.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => (where.key === 'graceDays' ? { valueJson: 10 } : null));
    s.prisma.v3PlanPrice.findFirst.mockResolvedValue({ id: 'pr1', amountPaise: 149700, currency: 'INR', taxInclusive: false });
    s.prisma.v3PlanSubscription.findUnique.mockResolvedValue({ id: 'old', planId: 'F' });
    s.prisma.v3PlanSubscription.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'new', ...data }));
    const out = await s.subs.assignPlan({ vendorId: 'v1', planKey: 'handyman_pro', termMonths: 3, source: 'STAFF', actor: STAFF, reason: 'sold offline', now: T0 });
    expect(out).toMatchObject({ planId: 'P', termMonths: 3, source: 'STAFF', status: 'ACTIVE', currentVendorId: 'v1', createdByType: 'STAFF', createdById: 'staff1' });
    expect((out.endsAt as Date).toISOString()).toBe('2027-06-01T00:00:00.000Z');
    expect((out.graceEndsAt as Date).toISOString()).toBe('2027-06-11T00:00:00.000Z');
    expect(out.priceSnapshotJson).toMatchObject({ amountPaise: 149700, priceId: 'pr1', termMonths: 3 });
    expect(s.prisma.v3PlanSubscription.update).toHaveBeenCalledWith({ where: { id: 'old' }, data: { status: 'CANCELLED', currentVendorId: null } });
    expect(s.prisma.v3SubscriptionEvent.create.mock.calls[0][0].data).toMatchObject({ type: 'CHANGED', fromPlanId: 'F', toPlanId: 'P', reason: 'sold offline', actorType: 'STAFF', actorId: 'staff1' });
    expect(auditRows(s.prisma).map((r) => r.action)).toEqual(['subscription.assign']);
    expect(s.invalidate).toHaveBeenCalledWith('v1');
  });

  it('a PRO assignment without a valid term is INVALID_TERM; a FREE assignment takes no term and has no end date', async () => {
    const s = setup();
    vendorOk(s);
    s.prisma.v3Plan.findUnique.mockResolvedValue(proPlan);
    s.prisma.v3PlanSetting.findUnique.mockResolvedValue(null);
    expect(code(await rejects(s.subs.assignPlan({ vendorId: 'v1', planKey: 'handyman_pro', source: 'STAFF', actor: STAFF, reason: 'r' })))).toBe('INVALID_TERM');
    s.prisma.v3Plan.findUnique.mockResolvedValue(freePlan);
    expect(code(await rejects(s.subs.assignPlan({ vendorId: 'v1', planKey: 'handyman_free', termMonths: 3, source: 'STAFF', actor: STAFF, reason: 'r' })))).toBe('INVALID_TERM');
    s.prisma.v3PlanSubscription.findUnique.mockResolvedValue(null);
    s.prisma.v3PlanSubscription.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'n', ...data }));
    const free = await s.subs.assignPlan({ vendorId: 'v1', planKey: 'handyman_free', source: 'STAFF', actor: STAFF, reason: 'r', now: T0 });
    expect(free).toMatchObject({ termMonths: null, endsAt: null, graceEndsAt: null });
    expect(s.prisma.v3SubscriptionEvent.create.mock.calls.at(-1)![0].data.type).toBe('ASSIGNED');
  });

  it('a retired plan cannot be assigned', async () => {
    const s = setup();
    vendorOk(s);
    s.prisma.v3Plan.findUnique.mockResolvedValue({ ...proPlan, status: 'RETIRED' });
    await expect(s.subs.assignPlan({ vendorId: 'v1', planKey: 'handyman_pro', termMonths: 3, source: 'STAFF', actor: STAFF, reason: 'r' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('overrides: reason required, future expiry, known feature; created with the staff id; audited; only that vendor\'s cache is cleared', async () => {
    const s = setup();
    const dto = (over: Partial<CreateOverrideDto>) => ({ featureKey: 'site.video', state: 'ACTIVE', reason: 'trial', ...over }) as CreateOverrideDto;
    expect(code(await rejects(s.vendors.createOverride('v1', dto({ reason: '' }), STAFF)))).toBe('REASON_REQUIRED');
    await expect(s.vendors.createOverride('v1', dto({ expiresAt: '2020-01-01T00:00:00Z' }), STAFF)).rejects.toBeInstanceOf(BadRequestException);
    vendorOk(s);
    s.prisma.v3Feature.findUnique.mockResolvedValue(null);
    await expect(s.vendors.createOverride('v1', dto({}), STAFF)).rejects.toBeInstanceOf(NotFoundException);
    s.prisma.v3Feature.findUnique.mockResolvedValue({ id: 'f' });
    s.prisma.v3EntitlementOverride.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'o1', ...data }));
    const out = await s.vendors.createOverride('v1', dto({ expiresAt: new Date(Date.now() + 86_400_000).toISOString() }), STAFF);
    expect(out).toMatchObject({ vendorId: 'v1', featureKey: 'site.video', reason: 'trial', createdByStaffId: 'staff1' });
    expect(auditRows(s.prisma).map((r) => r.action)).toEqual(['override.create']);
    expect(s.invalidate).toHaveBeenCalledWith('v1');
    expect(s.invalidateAll).not.toHaveBeenCalled();
  });

  it('DELETE of an override expires it (the row stays) and is audited', async () => {
    const s = setup();
    s.prisma.v3EntitlementOverride.findUnique.mockResolvedValue({ id: 'o1', vendorId: 'v1' });
    s.prisma.v3EntitlementOverride.update.mockResolvedValue({});
    s.prisma.v3EntitlementOverride.findUniqueOrThrow.mockResolvedValue({ id: 'o1', vendorId: 'v1', expiresAt: new Date() });
    await s.vendors.expireOverride('o1', STAFF);
    expect(s.prisma.v3EntitlementOverride.delete).not.toHaveBeenCalled();
    expect(s.prisma.v3EntitlementOverride.update.mock.calls[0][0].data.expiresAt).toBeInstanceOf(Date);
    expect(auditRows(s.prisma).map((r) => r.action)).toEqual(['override.expire']);
  });

  it('override update is optimistic (STALE_WRITE)', async () => {
    const s = setup();
    s.prisma.v3EntitlementOverride.findUnique.mockResolvedValue({ id: 'o1', vendorId: 'v1', featureKey: 'site.pages', state: 'LIMITED', limitValue: 3 });
    s.prisma.v3EntitlementOverride.updateMany.mockResolvedValue({ count: 0 });
    expect(code(await rejects(s.vendors.updateOverride('o1', { expectedUpdatedAt: T0.toISOString(), limitValue: 9 }, STAFF)))).toBe('STALE_WRITE');
  });

  it('the flag is upserted for an existing vendor and audited', async () => {
    const s = setup();
    vendorOk(s);
    s.prisma.v3VendorFlag.findUnique.mockResolvedValue(null);
    s.prisma.v3VendorFlag.upsert.mockResolvedValue({ id: 'fl', vendorId: 'v1', key: 'v3_plans', enabled: true });
    await s.vendors.setFlag('v1', true, STAFF);
    expect(s.prisma.v3VendorFlag.upsert.mock.calls[0][0].where).toEqual({ vendorId_key: { vendorId: 'v1', key: 'v3_plans' } });
    expect(auditRows(s.prisma).map((r) => r.action)).toEqual(['flag.set']);
    expect(s.invalidate).toHaveBeenCalledWith('v1');
  });
});

describe('audit rows never carry secrets', () => {
  it('credential-looking fields are removed from before and after', async () => {
    const prisma = fakePrisma();
    const audit = new AuditService(prisma as never);
    await audit.record(prisma as never, STAFF, 'x', 'plan', 'P', { password: 'hunter2', name: 'a' }, { razorpayKeySecret: 's3cret', refreshToken: 't', name: 'b' });
    const row = auditRows(prisma)[0] as { beforeJson: Record<string, unknown>; afterJson: Record<string, unknown> };
    expect(JSON.stringify(row)).not.toMatch(/hunter2|s3cret/);
    expect(row.beforeJson.name).toBe('a');
    expect(row.afterJson.name).toBe('b');
  });
});

describe('request validation (DTOs)', () => {
  const pipe = buildValidationPipe();
  const run = (cls: new () => object, body: unknown) => pipe.transform(body, { type: 'body', metatype: cls } as never);

  it('an update without expectedUpdatedAt is refused; an unknown field is refused', async () => {
    await expect(run(UpdatePlanDto, { name: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run(UpdatePlanDto, { expectedUpdatedAt: T0.toISOString(), key: 'new_key' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run(UpdatePlanDto, { expectedUpdatedAt: T0.toISOString(), name: 'ok' })).resolves.toBeDefined();
  });

  it('a matrix save validates every row (state must be one of four)', async () => {
    await expect(run(SaveMatrixDto, { expectedUpdatedAt: T0.toISOString(), rows: [{ featureKey: 'site.video', state: 'MAYBE' }] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(run(SaveMatrixDto, { expectedUpdatedAt: T0.toISOString(), rows: [{ featureKey: 'site.video', state: 'ACTIVE' }] })).resolves.toBeDefined();
  });
});

describe('addMonths', () => {
  it('adds calendar months and clamps to the end of a shorter month', () => {
    expect(addMonths(new Date('2027-03-01T00:00:00Z'), 3).toISOString()).toBe('2027-06-01T00:00:00.000Z');
    expect(addMonths(new Date('2027-08-31T00:00:00Z'), 6).toISOString()).toBe('2028-02-29T00:00:00.000Z');
    expect(addMonths(new Date('2027-03-15T00:00:00Z'), 12).toISOString()).toBe('2028-03-15T00:00:00.000Z');
  });
});
