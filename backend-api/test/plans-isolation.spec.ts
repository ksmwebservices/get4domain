import * as fs from 'fs';
import * as path from 'path';
import { VENDOR_SCOPED_MODELS, forTenant } from '../src/common/tenant/for-tenant';
import { scopeArgs } from '../src/common/tenant/scope-args';
import { AuditService } from '../src/plans/admin/audit.service';
import { PlansAdminService } from '../src/plans/admin/plans-admin.service';
import { EntitlementsService } from '../src/plans/entitlements/entitlements.service';
import { PlansRepository } from '../src/plans/entitlements/plans.repository';
import { fakePrisma, FakePrisma, STAFF, T0 } from './support/fake-plans-prisma';
import { findLegacyUse } from './support/legacy-scan';

/** S51.9: tenant isolation of the new tables, "no V3 code touches a legacy table", and concurrent edits of one plan row. No database. */
const plansDir = path.resolve(__dirname, '../src/plans');
const tsFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));

describe('the new vendor-scoped tables are covered by the tenant extension', () => {
  it('V3PlanSubscription, V3SubscriptionEvent, V3EntitlementOverride and V3VendorFlag carry vendorId, so forTenant() scopes them automatically', () => {
    for (const m of ['V3PlanSubscription', 'V3SubscriptionEvent', 'V3EntitlementOverride', 'V3VendorFlag']) expect(VENDOR_SCOPED_MODELS.has(m)).toBe(true);
  });

  it('the catalogue tables (plans, prices, features, matrix, tax, discounts, settings, audit) are NOT vendor tables and are refused to a tenant client', () => {
    for (const m of ['V3Plan', 'V3PlanPrice', 'V3Feature', 'V3PlanFeature', 'V3TaxRate', 'V3DiscountRule', 'V3PlanSetting', 'V3AuditLog']) expect(VENDOR_SCOPED_MODELS.has(m)).toBe(false);
  });

  it('a scoped read of another vendor\'s subscription is confined to the caller: vendorId is forced into the query', () => {
    const opts = { vendorId: 'A', vendorModels: VENDOR_SCOPED_MODELS, sharedModels: new Set<string>() };
    expect(scopeArgs('V3PlanSubscription', 'findMany', {}, opts)).toEqual({ where: { vendorId: 'A' } });
    expect(scopeArgs('V3EntitlementOverride', 'findMany', { where: { featureKey: 'site.video' } }, opts)).toEqual({ where: { featureKey: 'site.video', vendorId: 'A' } });
    expect(() => scopeArgs('V3SubscriptionEvent', 'findMany', { where: { vendorId: 'B' } }, opts)).toThrow();
    expect(() => scopeArgs('V3PlanSubscription', 'create', { data: { vendorId: 'B', planId: 'x' } }, opts)).toThrow();
    expect(() => scopeArgs('V3Plan', 'findMany', {}, opts)).toThrow();   // a catalogue table is refused to a tenant-scoped client
  });

  it('forTenant exists as the V3 way to query these tables', () => {
    expect(typeof forTenant).toBe('function');
  });
});

describe('V3 plans code never touches a legacy table (owner decision D1)', () => {
  it('the detector itself works: it flags a legacy delegate, a legacy raw table, and a legacy import', () => {
    expect(findLegacyUse('const x = await this.prisma.subscription.findMany();')).not.toEqual([]);
    expect(findLegacyUse('await tx.vendorAddon.upsert({})')).not.toEqual([]);
    expect(findLegacyUse('await this.prisma.$queryRaw`select * from "BillingTerm"`')).not.toEqual([]);
    expect(findLegacyUse("import { PLAN_PRICES } from '../../payments/plan-pricing.constants';")).not.toEqual([]);
    expect(findLegacyUse("import { RegistryService } from '../../registry/registry.service';")).not.toEqual([]);
    expect(findLegacyUse("import { CommercialService } from '../../commercial/commercial.service';")).not.toEqual([]);
    expect(findLegacyUse('await this.prisma.v3PlanSubscription.findMany(); await tx.vendor.update({});')).toEqual([]);
    expect(findLegacyUse("import { SubscriptionsService } from '../subscriptions/subscriptions.service';")).toEqual([]);   // V3's own folder src/plans/subscriptions is fine
  });

  it('no file under src/plans imports or queries a legacy billing, BOS, commercial, add-on, module or registry table or constant', () => {
    const offenders = tsFiles(plansDir).flatMap((f) => findLegacyUse(fs.readFileSync(f, 'utf8'), f).map((hit) => `${path.relative(plansDir, f)}: ${hit}`));
    expect(offenders).toEqual([]);
  });

  it('the schema has no foreign key from a V3 table to a legacy model', () => {
    const schema = fs.readFileSync(path.resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
    const legacy = ['Subscription', 'Invoice', 'BillingTerm', 'BillingDeal', 'PlanOverride', 'PlanChangeRequest', 'PromoCode', 'ManualPaymentSubmission', 'SpecialArrangement', 'CommercialAuditLog', 'PaymentRecord', 'VendorAddon', 'VendorModule'];
    for (const m of schema.matchAll(/^model\s+(V3\w+)\s*\{[\s\S]*?^\}/gm)) {
      for (const l of legacy) expect({ model: m[1], legacy: l, hit: new RegExp(`\\b${l}\\b`).test(m[0].replace(/\/\/.*$/gm, '')) }).toEqual({ model: m[1], legacy: l, hit: false });
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------- concurrency
class NullRepo extends PlansRepository {
  async loadCatalogue() { return { plans: [], matrix: new Map(), featureKeys: [], settings: { graceDays: 7, downgradeBehaviour: 'FALL_TO_FREE' } }; }
  async loadVendorState() { return { flagOn: false, subscription: null, overrides: [] }; }
}

/** A fake plan table with the one property that matters: updateMany only matches when updatedAt equals what the caller read, and every write bumps updatedAt. */
function statefulPlans(prisma: FakePrisma) {
  const row = { id: 'P', key: 'handyman_pro', name: 'v0', updatedAt: T0 };
  let clock = T0.getTime();
  prisma.v3Plan.findUnique.mockImplementation(async () => ({ ...row }));
  prisma.v3Plan.findUniqueOrThrow.mockImplementation(async () => ({ ...row }));
  prisma.v3Plan.updateMany.mockImplementation(async ({ where, data }: { where: { id: string; updatedAt: Date }; data: { name?: string; updatedAt: Date } }) => {
    await Promise.resolve();   // a real round trip: lets the second request interleave
    if (where.updatedAt.getTime() !== row.updatedAt.getTime()) return { count: 0 };
    clock += 1000;
    if (data.name !== undefined) row.name = data.name;
    row.updatedAt = new Date(clock);
    return { count: 1 };
  });
  return row;
}

describe('two staff changing the same plan at the same time', () => {
  it('exactly one wins, the other gets STALE_WRITE, the final row is the winner\'s, and the audit trail has exactly one entry', async () => {
    const prisma = fakePrisma();
    const row = statefulPlans(prisma);
    const svc = new PlansAdminService(prisma as never, new AuditService(prisma as never), new EntitlementsService(new NullRepo()));
    const read = T0.toISOString();
    const results = await Promise.allSettled([
      svc.updatePlan('P', { expectedUpdatedAt: read, name: 'staff A' }, { ...STAFF, id: 'A' }),
      svc.updatePlan('P', { expectedUpdatedAt: read, name: 'staff B' }, { ...STAFF, id: 'B' }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0].reason as { getResponse: () => { code: string } }).getResponse().code).toBe('STALE_WRITE');
    expect(row.name).toBe(ok[0].status === 'fulfilled' ? (ok[0].value as { name: string }).name : '');
    const audit = prisma.v3AuditLog.create.mock.calls.map((c) => (c[0] as { data: { actorId: string; action: string } }).data);
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe('plan.update');
  });

  it('after the loser reloads (reads the new updatedAt) its edit succeeds, and the audit trail then has both, in order', async () => {
    const prisma = fakePrisma();
    const row = statefulPlans(prisma);
    const svc = new PlansAdminService(prisma as never, new AuditService(prisma as never), new EntitlementsService(new NullRepo()));
    await svc.updatePlan('P', { expectedUpdatedAt: T0.toISOString(), name: 'one' }, STAFF);
    await expect(svc.updatePlan('P', { expectedUpdatedAt: T0.toISOString(), name: 'two' }, STAFF)).rejects.toBeDefined();
    await svc.updatePlan('P', { expectedUpdatedAt: row.updatedAt.toISOString(), name: 'two' }, STAFF);
    expect(row.name).toBe('two');
    expect(prisma.v3AuditLog.create).toHaveBeenCalledTimes(2);
  });
});
