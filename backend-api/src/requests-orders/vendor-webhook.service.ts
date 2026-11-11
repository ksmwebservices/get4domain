import { Injectable, UnauthorizedException } from '@nestjs/common';
import { openSecret } from '../ai-studio/secret-box';
import { redactSecrets } from '../common/utils/redact-secrets';
import { amountCheck, PAID_EVENT_TYPES, parseGatewayEvent, verifyVendorSignature } from './core/commerce-core';
import { RequestsStore } from './requests.store';
import { VendorRequestsService } from './vendor-requests.service';

export interface WebhookOutcome { status: 'PROCESSED' | 'DUPLICATE' | 'IGNORED' | 'REVIEW' }

/**
 * Events from a vendor's OWN payment gateway (POST /v3/payments/vendor/:vendorId/:methodId). The signature is checked over the RAW body with that vendor's own webhook secret; a bad signature, an
 * unknown vendor or method, and a method that is not theirs all answer the same 401. A duplicate event id always answers 200 and changes nothing. A paid event is applied in ONE transaction: the amount
 * and currency must match the order EXACTLY, otherwise the order is flagged for review and NEVER marked paid; a match marks the order PAID once, reduces the stock once and takes the invoice number.
 * Get4Domain never receives or holds the money: this route only learns that the vendor's gateway says the customer paid the vendor.
 */
@Injectable()
export class VendorWebhookService {
  /** Amendment 06: vendors are paid by UPI and confirm the payment themselves, so this route is OFF unless VENDOR_GATEWAY_WEBHOOK_ENABLED=true (the owner sets it; nothing sets it in this build). Off, it answers the same plain 401 as a bad signature. */
  env: Record<string, string | undefined> = process.env;
  constructor(private readonly store: RequestsStore, private readonly vendor: VendorRequestsService) {}

  async handle(vendorId: string, methodId: string, rawBody: Buffer | undefined, signature: string | undefined): Promise<WebhookOutcome> {
    if (this.env.VENDOR_GATEWAY_WEBHOOK_ENABLED !== 'true') throw new UnauthorizedException('Unauthorized');
    const method = await this.store.getMethod(methodId, vendorId);
    const sealed = method ? await this.store.methodSecrets(methodId, vendorId) : null;
    const secret = sealed ? openSecret(sealed.webhook) : null;
    if (!method || method.kind !== 'OWN_GATEWAY' || method.status === 'DISABLED' || !verifyVendorSignature(rawBody, signature, secret)) throw new UnauthorizedException('Unauthorized');
    let body: unknown; try { body = JSON.parse(rawBody!.toString('utf8')); } catch { return { status: 'IGNORED' }; }
    const ev = parseGatewayEvent(body);
    if (!ev) return { status: 'IGNORED' };
    const fresh = await this.store.recordPaymentEvent({ vendorId, methodId, providerEventId: ev.eventId, signatureValid: true, payload: redactSecrets({ type: ev.type, orderRef: ev.orderRef, amountPaise: ev.amountPaise, currency: ev.currency }) as Record<string, unknown>, result: 'RECEIVED' });
    if (!fresh) return { status: 'DUPLICATE' };   // replay-safe: 200 and nothing else
    if (!PAID_EVENT_TYPES.includes(ev.type)) return { status: 'IGNORED' };
    const found = await this.store.getOrder(ev.orderRef, vendorId);   // found by the vendor's own id: another vendor's order can never be touched
    if (!found) return { status: 'IGNORED' };
    if (amountCheck(found.order, ev) !== 'OK') { await this.store.flagReview(found.order.id, vendorId); return { status: 'REVIEW' }; }
    const r = await this.store.markPaid(found.order.id, vendorId, new Date());
    await this.vendor.afterPaid(vendorId, found.order.id, r.alreadyPaid);
    return { status: r.alreadyPaid ? 'DUPLICATE' : 'PROCESSED' };
  }
}
