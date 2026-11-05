import { DEFAULT_BILLING_SETTINGS, BillingSettings } from '../../src/plan-billing/settings/billing-settings';
import { BillingSettingsService } from '../../src/plan-billing/settings/billing-settings.service';
import { ActivityBus, ActivityEvent } from '../../src/common/activity-bus';
import { DEFAULT_WALLET_SETTINGS, WalletSettings } from '../../src/v3-wallet/settings/wallet-settings';
import { WalletSettingsService } from '../../src/v3-wallet/settings/wallet-settings.service';
import { V3WalletService } from '../../src/v3-wallet/wallet.service';
import { TaxRateLite } from '../../src/v3-wallet/core/tax-core';
import { FakeGate } from './fake-gate';
import { FakeRazorpay } from './fake-razorpay';
import { MemoryWalletStore } from './memory-wallet-store';

/** real-looking GST rows for the tests about tax (the rates mean nothing to the code: it reads whatever rows it is given) */
export const GST18: TaxRateLite[] = [{ name: 'IGST', ratePercent: 18, appliesTo: 'ALL', active: true, validFrom: new Date('2026-01-01T00:00:00Z') }, { name: 'CGST', ratePercent: 9, appliesTo: 'ALL', active: true, validFrom: new Date('2026-01-01T00:00:00Z') }, { name: 'SGST', ratePercent: 9, appliesTo: 'ALL', active: true, validFrom: new Date('2026-01-01T00:00:00Z') }];
export const T0 = new Date('2026-11-05T10:00:00.000Z');
export const V1 = { type: 'VENDOR' as const, id: 'v1', ip: null };
export const V2 = { type: 'VENDOR' as const, id: 'v2', ip: null };
export const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
export const SUPER = { type: 'STAFF' as const, id: 'super-1', ip: null };

export interface WalletWorld {
  store: MemoryWalletStore; fake: FakeRazorpay; gate: FakeGate; now: { t: Date }; wsettings: { over: Partial<WalletSettings> }; bsettings: { over: Partial<BillingSettings> };
  svc: V3WalletService; bus: ActivityBus; events: ActivityEvent[];
  /** the settings readers the service was built with (the renewal service takes the same ones) */
  settingsService: WalletSettingsService; billingService: BillingSettingsService;
  /** gives a vendor the evidence of a paid Pro term and opens the wallet */
  open(vendorId?: string): Promise<void>;
  /** top up through the real flow (create, pay, confirm) */
  fund(vendorId: string, amountPaise: number): Promise<void>;
  clock(): Date;
}

export function walletWorld(opts: { fake?: FakeRazorpay } = {}): WalletWorld {
  const store = new MemoryWalletStore(); const fake = opts.fake ?? new FakeRazorpay(); const now = { t: new Date(T0) };
  const wsettings = { over: { walletTopupMinPaise: 10_000, walletTopupMaxPaise: 1_000_000, walletSellerStateCode: '33' } as Partial<WalletSettings> };
  const bsettings = { over: { paymentsMode: 'test' } as Partial<BillingSettings> };
  store.clock = () => new Date(now.t);
  const settings = { get: async (): Promise<WalletSettings> => ({ ...DEFAULT_WALLET_SETTINGS, ...wsettings.over }) } as unknown as WalletSettingsService;
  const billing = { get: async () => ({ ...DEFAULT_BILLING_SETTINGS, graceDays: 7, upgradeProration: 'NONE', renewalReminderDays: [14, 7, 1], ...bsettings.over }) } as unknown as BillingSettingsService;
  const gate = new FakeGate(billing as never, fake);
  const bus = new ActivityBus(); const events: ActivityEvent[] = []; bus.on('*', (e) => { events.push(e); });
  const svc = new V3WalletService(store, settings, billing, gate, bus); svc.clock = () => new Date(now.t);
  for (const id of ['v1', 'v2', 'v3']) store.names.set(id, `Business ${id}`);
  let k = 0;
  const open = async (vendorId = 'v1') => { store.evidence.set(vendorId, { kind: 'PLAN_ORDER', id: `order-${vendorId}` }); await svc.syncActivation(vendorId); await store.unit(vendorId, (tx) => tx.setBillingProfile({ stateCode: '33', gstin: null })); };
  const fund = async (vendorId: string, amountPaise: number) => {
    const actor = vendorId === 'v1' ? V1 : V2;
    const t = await svc.createTopup(vendorId, { amountPaise, idempotencyKey: `fund-${vendorId}-${++k}-abcdef` }, actor);
    const p = fake.pay(t.providerOrderId!);
    await svc.confirmTopup(vendorId, t.id, { paymentId: p.paymentId, signature: p.signature }, actor);
  };
  return { store, fake, gate, now, wsettings, bsettings, svc, bus, events, settingsService: settings, billingService: billing, open, fund, clock: () => new Date(now.t) };
}
export const advanceDays = (w: WalletWorld, days: number): void => { w.now.t = new Date(w.now.t.getTime() + days * 86_400_000); };
export const advance = (w: WalletWorld, seconds: number): void => { w.now.t = new Date(w.now.t.getTime() + seconds * 1000); };
