import { ConflictException, Injectable } from '@nestjs/common';
import { billingError } from '../plan-billing.errors';
import { BillingSettingsService } from '../settings/billing-settings.service';
import { RazorpayPort, RazorpayTestAdapter } from './razorpay.port';

/**
 * Which payment provider adapter, if any, may be used right now (slice 5.1b).
 *  - paymentsMode "off" (the default): none. Orders are refused, webhooks are ignored.
 *  - "test": the Razorpay TEST adapter, built lazily, only if RAZORPAY_TEST_KEY_ID (rzp_test_...), RAZORPAY_TEST_KEY_SECRET and RAZORPAY_TEST_WEBHOOK_SECRET are all set.
 *  - "live": REFUSED. It needs an environment flag the owner sets later (PLAN_PAYMENTS_LIVE_ENABLED=true), and even then this build has no live adapter, so it stays refused.
 * The key values are read here and handed to the adapter; they are never logged or returned.
 */
@Injectable()
export class PaymentsGate {
  /** overridable in tests */
  env: Record<string, string | undefined> = process.env;
  private adapter: RazorpayTestAdapter | null = null;
  constructor(private readonly settings: BillingSettingsService) {}

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

  /** For the webhook: null when payments are off or not set up, so the route can say "nothing to do" without an error the provider would retry. */
  async webhookPort(): Promise<RazorpayPort | null> {
    const mode = (await this.settings.get()).paymentsMode;
    return mode === 'test' ? this.build() : null;
  }
}
