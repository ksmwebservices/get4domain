import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { billingError } from '../plan-billing.errors';
import { PaymentsGate } from '../razorpay/payments-gate';
import { BillingSettingsService } from '../settings/billing-settings.service';
import { PaymentLinkPort } from './payment-link.port';
import { RazorpayPaymentLinkAdapter } from './razorpay-payment-link.adapter';

/**
 * May a payment link be made right now, and with which adapter. Everything must hold: the setting payLinkEnabled is true (off by default), paymentsMode is "test",
 * the gateway is Razorpay, and a complete set of Razorpay TEST keys is present (stored in the admin app first, the server environment second). LIVE IS ALWAYS
 * REFUSED here, whatever PLAN_PAYMENTS_LIVE_ENABLED says: this build makes test links only. Key values are never logged or returned.
 */
@Injectable()
export class PaymentLinkGate {
  constructor(
    @Inject(BillingSettingsService) private readonly settings: Pick<BillingSettingsService, 'get'>,
    /** the one place the gateway keys are read */
    @Inject(PaymentsGate) private readonly payments: Pick<PaymentsGate, 'razorpayTestKeys'>,
  ) {}

  async port(): Promise<PaymentLinkPort> {
    const s = await this.settings.get();
    if (!s.payLinkEnabled) throw new ConflictException(billingError('PAYMENT_LINKS_DISABLED', 'Payment links are not switched on.'));
    if (s.paymentsMode === 'off') throw new ConflictException(billingError('PAYMENTS_DISABLED', 'Online payment is not switched on yet.'));
    if (s.paymentsMode !== 'test') throw new ConflictException(billingError('PAYMENT_LINKS_TEST_ONLY', 'Payment links work in test mode only for now.'));
    if (s.paymentGateway !== 'razorpay') throw new ConflictException(billingError('PAYMENTS_NOT_CONFIGURED', 'Payment links need Razorpay as the chosen gateway.'));
    const keys = await this.payments.razorpayTestKeys();
    if (!keys) throw new ConflictException(billingError('PAYMENTS_NOT_CONFIGURED', 'Online payment is not set up yet.'));
    return this.build(keys);
  }

  protected build(keys: { keyId: string; keySecret: string }): PaymentLinkPort { return new RazorpayPaymentLinkAdapter(keys); }
}
