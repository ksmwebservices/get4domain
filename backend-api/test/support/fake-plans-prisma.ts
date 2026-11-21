/**
 * A tiny fake of the Prisma calls the plans admin services make, so their RULES can be tested without a database. Each model method is a jest.fn
 * that tests configure; `$transaction(fn)` runs fn with the same object (as the transaction client). Not a database: ordering and constraints are
 * the job of the staging integration tests.
 */
type Fn = jest.Mock;
const model = (...names: string[]): Record<string, Fn> => Object.fromEntries(names.map((n) => [n, jest.fn()]));
const ALL = ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findMany', 'count', 'create', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'];

export interface FakePrisma {
  [k: string]: unknown;
  v3Plan: Record<string, Fn>; v3PlanPrice: Record<string, Fn>; v3Feature: Record<string, Fn>; v3PlanFeature: Record<string, Fn>; v3TaxRate: Record<string, Fn>;
  v3DiscountRule: Record<string, Fn>; v3PlanSetting: Record<string, Fn>; v3PlanSubscription: Record<string, Fn>; v3SubscriptionEvent: Record<string, Fn>;
  v3EntitlementOverride: Record<string, Fn>; v3AuditLog: Record<string, Fn>; v3VendorFlag: Record<string, Fn>; vendor: Record<string, Fn>;
  $transaction: Fn;
}

export function fakePrisma(): FakePrisma {
  const p = {
    v3Plan: model(...ALL), v3PlanPrice: model(...ALL), v3Feature: model(...ALL), v3PlanFeature: model(...ALL), v3TaxRate: model(...ALL),
    v3DiscountRule: model(...ALL), v3PlanSetting: model(...ALL), v3PlanSubscription: model(...ALL), v3SubscriptionEvent: model(...ALL),
    v3EntitlementOverride: model(...ALL), v3AuditLog: model(...ALL), v3VendorFlag: model(...ALL), vendor: model(...ALL),
    $transaction: jest.fn(),
  } as FakePrisma;
  p.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(p));
  return p;
}

export const STAFF = { type: 'STAFF' as const, id: 'staff1', ip: '127.0.0.1' };
export const T0 = new Date('2027-03-01T00:00:00.000Z');
