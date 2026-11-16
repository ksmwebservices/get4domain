import { Injectable, Optional } from '@nestjs/common';
import { OtpPepper } from '../directory/pepper';
import { addressHash, maskAddress } from '../requests-orders/core/messaging-core';
import { EmailPort } from '../v3-mail/email.port';
import { PlanBillingRepository } from './plan-billing.repository';

export type DeliveryOutcome = 'PENDING' | 'SENT' | 'FAILED' | 'NO_ADDRESS' | 'ALREADY_RECORDED';
export const INVOICE_TEMPLATE_KEY = 'plan_invoice';

/**
 * The invoice mail (Wave 3 Part D). After a payment is committed, the owner is sent a short transactional message through the mail port (lane 1, kind RECEIPT). The mail flag (EMAIL_LIVE_SEND) is OFF by
 * default, so the port refuses, and that is recorded as PENDING in the message outbox: nothing is sent and nothing is lost. A transport failure is recorded as FAILED. It is best effort and never throws:
 * the payment, the plan and the invoice are already committed and never depend on a mail. One outbox row per invoice, so a repeat records nothing twice. The text carries no price and no personal data
 * beyond the invoice number and the plan name; the invoice itself is downloaded from the dashboard.
 */
@Injectable()
export class PlanInvoiceDeliveryService {
  constructor(private readonly repo: PlanBillingRepository, @Optional() private readonly email?: EmailPort, @Optional() private readonly pepper: OtpPepper = new OtpPepper()) {}

  async queue(i: { invoiceId: string; invoiceNumber: string; planName: string; vendorId: string; to: string | null }): Promise<DeliveryOutcome> {
    try {
      if (!i.to) return 'NO_ADDRESS';
      if (await this.repo.findInvoiceDelivery(i.invoiceId)) return 'ALREADY_RECORDED';
      const row = await this.repo.addInvoiceDelivery({ vendorId: i.vendorId, invoiceId: i.invoiceId, toHash: addressHash('EMAIL', i.to, this.pepper.value()), toMasked: maskAddress('EMAIL', i.to), payload: { invoiceNumber: i.invoiceNumber } });
      let status: 'QUEUED' | 'DELIVERED' | 'FAILED' = 'QUEUED';
      try {
        if (this.email) {
          await this.email.send({ lane: 'SYSTEM', kind: 'RECEIPT', to: i.to, subject: `Your invoice ${i.invoiceNumber}`, text: `Your invoice ${i.invoiceNumber} for the ${i.planName} plan is ready. Sign in to your dashboard to view or download it.` });
          status = 'DELIVERED';
        }
      } catch (e) {
        const code = (e as { response?: { code?: string } }).response?.code;
        status = code === 'EMAIL_NOT_LIVE' || code === 'EMAIL_NOT_CONFIGURED' ? 'QUEUED' : 'FAILED';   // switched off or not set up: still pending; anything else failed
      }
      if (status !== 'QUEUED') await this.repo.setInvoiceDeliveryStatus(row.id, status);
      return status === 'QUEUED' ? 'PENDING' : status === 'DELIVERED' ? 'SENT' : 'FAILED';
    } catch {
      return 'FAILED';   // recording failed: never raised to the payment
    }
  }
}
