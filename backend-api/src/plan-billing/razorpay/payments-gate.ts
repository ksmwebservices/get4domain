import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { billingError } from '../plan-billing.errors';
import { BillingSettingsService } from '../settings/billing-settings.service';
import { CashfreeGateway } from '../gateway/cashfree.gateway';
import { GatewayCredentialsService } from '../gateway/gateway-credentials.service';
import { GatewayName } from '../gateway/gateway-core';
import { buildLiveGateway } from '../gateway/live-gateway.factory';
import { PaymentGatewayPort } from '../gateway/gateway.port';
import { RazorpayGateway } from '../gateway/razorpay.gateway';
import { RazorpayPort, RazorpayTestAdapter } from './razorpay.port';

/**
 * Which payment provider adapter, if any, may be used right now (slice 5.1b).
 *  - paymentsMode "off" (the default): none. Orders are refused, webhooks are ignored.
 *  - "test": the Razorpay TEST adapter, built lazily, only if RAZORPAY_TEST_KEY_ID (rzp_test_...), RAZORPAY_TEST_KEY_SECRET and RAZORPAY_TEST_WEBHOOK_SECRET are all set.
 *  - "live": REFUSED. It needs an environment flag the owner sets later (PLAN_PAYMENTS_LIVE_ENABLED=true), and even then this build has no live adapter, so it stays refused.
 * The key values are read here and handed to the adapter; they are never logged or returned.
 * Wave 4 W6: the keys the SUPER_ADMIN stored in the admin app (encrypted) are read FIRST; the environment is the fallback. Live still needs the admin setting, PLAN_PAYMENTS_LIVE_ENABLED and a complete set of live keys.
 */
@Injectable()
export class PaymentsGate {
  /** overridable in tests */
  env: Record<string, string | undefined> = process.env;
  private adapter: RazorpayTestAdapter | null = null;
  constructor(private readonly settings: BillingSettingsService, @Optional() private readonly creds?: GatewayCredentialsService) {}

  protected build(): RazorpayPort | null {
    if (this.adapter) return this.adapter;
    const keyId = this.env.RAZORPAY_TEST_KEY_ID; const keySecret = this.env.RAZORPAY_TEST_KEY_SECRET; const webhookSecret = this.env.RAZORPAY_TEST_WEBHOOK_SECRET;
    if (!keyId || !keySecret || !webhookSecret || !keyId.startsWith('rzp_test_')) return null;
    this.adapter = new RazorpayTestAdapter({ keyId, keySecret, webhookSecret });
    return this.adapter;
  }

  /** The adapter for creating and confirming orders, or a plain refusal. */
  async port(): Promise<RazorpayPort> {
    const mode = (await this.settings.get()).paymentsMode;
    if (mode === 'off') throw new ConflictException(billingError('PAYMENTS_DISABLED', 'Online payment is not switched on yet.'));
    if (mode === 'live') throw new ConflictException(billingError('PAYMENTS_NOT_CONFIGURED', 'Live payments are not enabled.'));
    const p = this.build();
    if (!p) throw new ConflictException(billingError('PAYMENTS_NOT_CONFIGURED', 'Online payment is not set up yet.'));
    return p;
  }

  // ───────────── Wave 3 Part C: the payment port over both gateways ─────────────
  // The methods below are what the plan checkout and the new webhooks use. port() and webhookPort() above stay exactly as they were (the wallet still uses them until its top-up moves to the port).
  //  - paymentsMode "off" (default): no gateway. "test": the TEST keys of the chosen gateway. "live": needs PLAN_PAYMENTS_LIVE_ENABLED=true AND that gateway's LIVE keys; otherwise refused.
  private gateways = new Map<string, { g: PaymentGatewayPort; ver: number; at: number }>();
  private static readonly CACHE_MS = 30_000;

  private liveEnabled(): boolean { return this.env.PLAN_PAYMENTS_LIVE_ENABLED === 'true'; }

  /** Builds the adapter of one gateway for one mode from the environment, or null when its keys are missing (or live is not enabled). Key values are never logged or returned. */
  /** may be answered at once (a test double) or after reading the stored keys; every caller awaits it */
  protected buildGateway(name: GatewayName, mode: 'test' | 'live'): PaymentGatewayPort | null | Promise<PaymentGatewayPort | null> {
    return this.buildGatewayAsync(name, mode);
  }
  private async buildGatewayAsync(name: GatewayName, mode: 'test' | 'live'): Promise<PaymentGatewayPort | null> {
    const cacheKey = `${name}:${mode}`;
    const ver = this.creds?.version() ?? 0; const nowMs = Date.now();
    const hit = this.gateways.get(cacheKey);
    // an adapter built from stored keys is kept for a short time and dropped when the keys are set or cleared on this server, so a change reaches checkout and the webhook quickly
    if (hit && hit.ver === ver && nowMs - hit.at < PaymentsGate.CACHE_MS) return hit.g;
    let g: PaymentGatewayPort | null = await this.fromStored(name, mode);
    if (g) { this.gateways.set(cacheKey, { g, ver, at: nowMs }); return g; }
    if (mode === 'live') g = buildLiveGateway(name, this.env);   // every live adapter is made in live-gateway.factory.ts, behind the live flag
    else if (name === 'razorpay') {
      const adapter = this.build();   // the one place the Razorpay TEST adapter is made (a test double overrides it)
      if (adapter) g = new RazorpayGateway(adapter, 'test');
    } else {
      const appId = this.env.CASHFREE_TEST_APP_ID; const secretKey = this.env.CASHFREE_TEST_SECRET_KEY;
      if (appId && secretKey) g = new CashfreeGateway({ appId, secretKey }, 'test');
    }
    if (g) this.gateways.set(cacheKey, { g, ver, at: nowMs });
    return g;
  }

  /** The adapter made from the keys stored in the admin app, or null when none are stored (the environment then applies). Live is only ever built with the live flag on. */
  private async fromStored(name: GatewayName, mode: 'test' | 'live'): Promise<PaymentGatewayPort | null> {
    if (!this.creds) return null;
    if (mode === 'live' && !this.liveEnabled()) return null;
    const c = await this.creds.resolve(name, mode);
    if (!c) return null;
    if (name === 'razorpay') return new RazorpayGateway(new RazorpayTestAdapter({ keyId: c.keyId, keySecret: c.keySecret, webhookSecret: c.webhookSecret }, undefined, mode === 'live' ? 'live' : undefined), mode);
    return new CashfreeGateway({ appId: c.appId, secretKey: c.secretKey }, mode);
  }

  /** The gateway checkout uses right now (the plan setting paymentGateway), or a plain refusal. Nothing is created for nothing: this is asked BEFORE an order row is written. */
  async gatewayPort(): Promise<PaymentGatewayPort> {
    const s = await this.settings.get();
    if (s.paymentsMode === 'off') throw new ConflictException(billingError('PAYMENTS_DISABLED', 'Online payment is not switched on yet.'));
    if (s.paymentsMode === 'live' && !this.liveEnabled()) throw new ConflictException(billingError('PAYMENTS_NOT_CONFIGURED', 'Live payments are not enabled.'));
    const g = await this.buildGateway(s.paymentGateway, s.paymentsMode);
    if (!g) throw new ConflictException(billingError('PAYMENTS_NOT_CONFIGURED', 'Online payment is not set up yet.'));
    return g;
  }

  /** The adapter that can verify a webhook of the named gateway, whichever gateway is chosen now (an order started on one keeps being settled after the switch). Null when payments are off or that gateway has no keys. */
  async webhookGatewayPort(name: GatewayName): Promise<PaymentGatewayPort | null> {
    const mode = (await this.settings.get()).paymentsMode;
    return mode === 'off' ? null : await this.buildGateway(name, mode);
  }

  /** The gateway an EXISTING order was started on, to confirm it or cancel it (settings may have moved on since). */
  async portFor(name: GatewayName): Promise<PaymentGatewayPort> {
    const mode = (await this.settings.get()).paymentsMode;
    if (mode === 'off') throw new ConflictException(billingError('PAYMENTS_DISABLED', 'Online payment is not switched on yet.'));
    if (mode === 'live' && !this.liveEnabled()) throw new ConflictException(billingError('PAYMENTS_NOT_CONFIGURED', 'Live payments are not enabled.'));
    const g = await this.buildGateway(name, mode);
    if (!g) throw new ConflictException(billingError('PAYMENTS_NOT_CONFIGURED', 'Online payment is not set up yet.'));
    return g;
  }

  /** For the webhook: null when payments are off or not set up, so the route can say "nothing to do" without an error the provider would retry. */
  async webhookPort(): Promise<RazorpayPort | null> {
    const mode = (await this.settings.get()).paymentsMode;
    return mode === 'test' ? this.build() : null;
  }
}
