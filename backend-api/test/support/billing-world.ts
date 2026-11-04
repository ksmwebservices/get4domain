import { DEFAULT_BILLING_SETTINGS, BillingSettings } from '../../src/plan-billing/settings/billing-settings';
import { PlanOrderService } from '../../src/plan-billing/plan-order.service';
import { RenewalReminderService, SandboxReminderMailer } from '../../src/plan-billing/renewal-reminder.service';
import { PaymentSettlementService } from '../../src/plan-billing/settlement.service';
import { FakeGate } from './fake-gate';
import { FakeRazorpay } from './fake-razorpay';
import { MemoryBillingRepo } from './memory-billing-repo';

export const T0 = new Date('2026-11-05T10:00:00.000Z');
export const VENDOR = { type: 'VENDOR' as const, id: 'v1', ip: null };
export const OTHER = { type: 'VENDOR' as const, id: 'v2', ip: null };
export const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
export const SUPER = { type: 'STAFF' as const, id: 'super-1', ip: null };

export interface BillingWorld {
  repo: MemoryBillingRepo; fake: FakeRazorpay; gate: FakeGate; now: { t: Date }; settings: { over: Partial<BillingSettings> }; invalidated: string[];
  orders: PlanOrderService; settlement: PaymentSettlementService; reminders: RenewalReminderService; mailer: SandboxReminderMailer; ids: { free: string; pro: string; plus: string; otherTrackPro: string };
  buy(input?: Partial<{ planKey: string; termMonths: number; idempotencyKey: string }>, vendorId?: string): ReturnType<PlanOrderService['create']>;
}

export function billingWorld(): BillingWorld {
  const repo = new MemoryBillingRepo(); const fake = new FakeRazorpay(); const now = { t: new Date(T0) }; const settings = { over: { paymentsMode: 'test' } as Partial<BillingSettings> }; const invalidated: string[] = [];
  repo.clock = () => new Date(now.t);
  const settingsService = { get: async (): Promise<BillingSettings> => ({ ...DEFAULT_BILLING_SETTINGS, graceDays: 7, upgradeProration: 'NONE', renewalReminderDays: [14, 7, 1], ...settings.over }) } as never;
  const gate = new FakeGate(settingsService, fake);
  const settlement = new PaymentSettlementService(repo, settingsService, gate, { invalidate: (v: string) => { invalidated.push(v); } }); settlement.clock = () => new Date(now.t);
  const orders = new PlanOrderService(repo, settingsService, gate, settlement); orders.clock = () => new Date(now.t);
  const mailer = new SandboxReminderMailer(); const reminders = new RenewalReminderService(repo, settingsService, mailer); reminders.clock = () => new Date(now.t);

  const plan = (key: string, track: string, level: 'FREE' | 'PRO', over: Partial<{ status: 'DRAFT' | 'ACTIVE' | 'RETIRED'; isPublic: boolean }> = {}) => { const id = `plan-${key}`; repo.plans.set(id, { id, key, track, level, name: key.replace('_', ' '), status: over.status ?? 'ACTIVE', isPublic: over.isPublic ?? true }); return id; };
  const free = plan('handyman_free', 'handyman', 'FREE'); const pro = plan('handyman_pro', 'handyman', 'PRO'); const plus = plan('handyman_plus', 'handyman', 'PRO'); const otherTrackPro = plan('professional_pro', 'professional', 'PRO');
  const price = (planId: string, term: number, amountPaise: number, status: 'PROPOSED' | 'APPROVED' = 'APPROVED', effectiveFrom = new Date('2026-01-01T00:00:00Z')) => repo.prices.push({ planId, termMonths: term, row: { id: `price-${planId}-${term}`, amountPaise, currency: 'INR', taxInclusive: false }, status, effectiveFrom });
  for (const [t, a] of [[3, 300_000], [6, 540_000], [12, 960_000]] as const) { price(pro, t, a); price(plus, t, a * 2); price(otherTrackPro, t, a); }
  repo.taxes.push({ name: 'GST', ratePercent: 18, appliesTo: 'ALL', active: true, validFrom: new Date('2026-01-01T00:00:00Z') });
  for (const id of ['v1', 'v2']) repo.vendors.set(id, { id, name: `Owner ${id}`, businessName: `Business ${id}`, email: `${id}@x.invalid`, phone: '+919876543210' });
  repo.subs.push({ id: 'sub-free-v1', vendorId: 'v1', planId: free, status: 'ACTIVE', startsAt: new Date('2026-06-01T00:00:00Z'), endsAt: null, graceEndsAt: null, termMonths: null, amountPaise: null, current: true, source: 'REGISTRATION' });
  repo.subs.push({ id: 'sub-free-v2', vendorId: 'v2', planId: free, status: 'ACTIVE', startsAt: new Date('2026-06-01T00:00:00Z'), endsAt: null, graceEndsAt: null, termMonths: null, amountPaise: null, current: true, source: 'REGISTRATION' });
  let k = 0;
  const buy = (input: Partial<{ planKey: string; termMonths: number; idempotencyKey: string }> = {}, vendorId = 'v1') => orders.create(vendorId, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: `key-${++k}-abcdefgh`, ...input }, vendorId === 'v1' ? VENDOR : OTHER);
  return { repo, fake, gate, now, settings, invalidated, orders, settlement, reminders, mailer, ids: { free, pro, plus, otherTrackPro }, buy };
}
export const advance = (w: BillingWorld, seconds: number): void => { w.now.t = new Date(w.now.t.getTime() + seconds * 1000); };
export const currentOf = (w: BillingWorld, vendorId = 'v1') => w.repo.subs.find((s) => s.vendorId === vendorId && s.current)!;
export const paid = async (w: BillingWorld, o: { id: string; providerOrderId: string | null }, vendorId = 'v1') => {
  const p = w.fake.pay(o.providerOrderId!);
  return w.orders.confirm(vendorId, o.id, { paymentId: p.paymentId, signature: p.signature }, vendorId === 'v1' ? VENDOR : OTHER);
};
