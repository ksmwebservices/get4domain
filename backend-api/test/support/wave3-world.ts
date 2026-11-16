import { randomBytes } from 'crypto';
import { GatewayName, paiseToDecimal } from '../../src/plan-billing/gateway/gateway-core';
import { PaymentGatewayPort } from '../../src/plan-billing/gateway/gateway.port';
import { InMemoryGateway } from '../../src/plan-billing/gateway/in-memory.gateway';
import { PlanOrderService } from '../../src/plan-billing/plan-order.service';
import { PlanPaidHook } from '../../src/plan-billing/plan-paid.hook';
import { PaymentsGate } from '../../src/plan-billing/razorpay/payments-gate';
import { BillingSettings, DEFAULT_BILLING_SETTINGS } from '../../src/plan-billing/settings/billing-settings';
import { PaymentSettlementService } from '../../src/plan-billing/settlement.service';
import { billingWorld, VENDOR } from './billing-world';

/**
 * The Wave 3 payment test world: the billing world (memory repository, price book, vendors v1 and v2) with BOTH gateways replaced by in-memory adapters. Every secret is made here, at run time. Shared by the
 * gateway, invoice, cash, theme and referral specs, so they all drive the same real services.
 */
export const secret = (): string => randomBytes(16).toString('hex');

export class TestGate extends PaymentsGate {
  readonly gws = new Map<string, InMemoryGateway>();
  protected buildGateway(name: GatewayName): PaymentGatewayPort | null { return this.gws.get(name) ?? null; }
}

export function flow(chosen: GatewayName = 'razorpay', opts: { paidHook?: PlanPaidHook } = {}) {
  const w = billingWorld();
  w.settings.over = { paymentsMode: 'test', paymentGateway: chosen };
  const settingsObj = { get: async (): Promise<BillingSettings> => ({ ...DEFAULT_BILLING_SETTINGS, graceDays: 7, upgradeProration: 'NONE', renewalReminderDays: [14, 7, 1], ...w.settings.over }) };
  const settings = settingsObj as never;
  const gate = new TestGate(settings);
  const gws = { razorpay: new InMemoryGateway('razorpay', { signing: secret(), webhook: secret() }), cashfree: new InMemoryGateway('cashfree', { signing: secret(), webhook: secret() }) };
  gate.gws.set('razorpay', gws.razorpay); gate.gws.set('cashfree', gws.cashfree);
  const queued: Array<Record<string, unknown>> = [];
  const delivery = { queue: async (i: Record<string, unknown>) => { queued.push(i); return 'PENDING' as const; } };
  const settlement = new PaymentSettlementService(w.repo, settings, gate, { invalidate: () => undefined }, undefined, undefined, delivery, opts.paidHook); settlement.clock = () => new Date(w.now.t);
  const orders = new PlanOrderService(w.repo, settings, gate, settlement); orders.clock = () => new Date(w.now.t);
  let k = 0;
  const buy = (over: Partial<{ planKey: string; termMonths: number }> = {}, vendorId = 'v1') => orders.create(vendorId, { planKey: 'handyman_pro', termMonths: 3, idempotencyKey: `wave3-key-${++k}-abcdef`, ...over }, VENDOR);
  const invoices = () => w.repo.invoices.length;
  return { w, gate, gws, settings: settingsObj, settlement, orders, buy, invoices, queued, gw: gws[chosen], set: (over: Partial<BillingSettings>) => { w.settings.over = { ...w.settings.over, ...over }; } };
}
export type Flow = ReturnType<typeof flow>;

/** the body and headers a gateway would POST for a payment, signed with the secret the test made */
export function deliver(f: Flow, gateway: GatewayName, order: { providerOrderId: string | null }, o: { amountMinor: number; paymentId: string; eventId?: string; sign?: boolean; kind?: 'PAID' | 'FAILED'; currency?: string }) {
  const gw = f.gws[gateway];
  const raw = gateway === 'cashfree'
    ? JSON.stringify({ type: o.kind === 'FAILED' ? 'PAYMENT_FAILED_WEBHOOK' : 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: order.providerOrderId }, payment: { cf_payment_id: o.paymentId, payment_status: o.kind === 'FAILED' ? 'FAILED' : 'SUCCESS', payment_amount: paiseToDecimal(o.amountMinor), payment_currency: o.currency ?? 'INR' } } })
    : JSON.stringify({ event: o.kind === 'FAILED' ? 'payment.failed' : 'payment.captured', payload: { payment: { entity: { id: o.paymentId, order_id: order.providerOrderId, amount: o.amountMinor, currency: o.currency ?? 'INR', status: o.kind === 'FAILED' ? 'failed' : 'captured' } } } });
  const headers = o.sign === false ? gw.signedHeaders(raw + ' tampered', f.w.now.t, o.eventId) : gw.signedHeaders(raw, f.w.now.t, o.eventId);
  return { raw, headers };
}
