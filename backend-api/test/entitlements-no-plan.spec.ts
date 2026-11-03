import { entitlementsFor, ENTITLEMENTS, NO_PLAN_ENTITLEMENTS, PlanKey } from '../src/commercial/entitlements';

// terms.service pulls in modules that need @nestjs/schedule, an ES module Jest does not parse; only its cron decorators are used at import time.
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined, Interval: () => () => undefined, Timeout: () => () => undefined,
  CronExpression: new Proxy({}, { get: () => '* * * * *' }), ScheduleModule: {}, SchedulerRegistry: class {},
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { vendorTermView } = require('../src/commercial/terms.service') as typeof import('../src/commercial/terms.service');

/** CI-FIX-1 part 3: a vendor with no plan key got a 500 (RangeError "Unknown plan key: undefined") from GET /billing/me. It is a defined state now. */
describe('a vendor with no plan key', () => {
  const base = {
    billingCycle: 'ANNUAL', cycleMonths: 12, status: 'ACTIVE', source: 'SELF', netAmountPaise: 0, gstMode: 'NONE', periodStart: null, periodEnd: null,
    graceDays: 0, paymentDueAt: null, scheduledNextPlan: null, scheduledNextCycle: null, aiCreditPaise: null,
  };

  it('entitlementsFor(undefined | null | "") answers a defined, empty "no plan" state instead of throwing', () => {
    for (const k of [undefined, null, '']) expect(entitlementsFor(k as unknown as PlanKey)).toBe(NO_PLAN_ENTITLEMENTS);
    expect(NO_PLAN_ENTITLEMENTS).toEqual({ aiCreditAnnualPaise: 0, seoKeywords: 0, themeChangesPerYear: 0, whatsappBotReply: false, fullAccounting: false, hrm: false, inventory: false, taskManagement: false });
  });
  it('a real plan is unchanged, and a non-empty unknown key is still a loud error (never silently "no plan")', () => {
    expect(entitlementsFor('BOS')).toBe(ENTITLEMENTS.BOS);
    expect(() => entitlementsFor('PLATINUM' as unknown as PlanKey)).toThrow(RangeError);
  });
  it('vendorTermView of a term without a plan key does not throw and says there is no plan', () => {
    const view = vendorTermView({ ...base, id: 't1', planKey: undefined } as never);
    expect(view).toMatchObject({ planKey: null, hasPlan: false, entitlements: NO_PLAN_ENTITLEMENTS, aiCreditIncludedPaise: 0 });
  });
  it('vendorTermView of a normal term is unchanged and says hasPlan', () => {
    expect(vendorTermView({ ...base, id: 't2', planKey: 'WORKSPACE' } as never)).toMatchObject({ planKey: 'WORKSPACE', hasPlan: true, entitlements: ENTITLEMENTS.WORKSPACE });
  });
  it('vendorTermView(null) is still null', () => { expect(vendorTermView(null)).toBeNull(); });
});
