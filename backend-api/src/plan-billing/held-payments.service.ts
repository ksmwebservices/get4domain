import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { EmailPort } from '../v3-mail/email.port';
import { checkHeldResolution, heldReason, HeldResolveInput } from './core/held-core';
import { billingError } from './plan-billing.errors';
import { OrderRow, PlanBillingRepository } from './plan-billing.repository';
import { PaymentSettlementService, SettleCtx } from './settlement.service';

export interface HeldFilter { vendorId?: string; gateway?: string; from?: Date; to?: Date; skip: number; take: number }
export interface HeldView {
  id: string; vendorId: string; gateway: string; status: string; heldReason: string; expectedTotalPaise: number; amountSeenPaise: number | null; currency: string;
  providerOrderId: string | null; gatewayPaymentId: string | null; heldAt: Date; resolution: 'ACCEPTED' | 'REJECTED' | null; resolvedBy: string | null; resolvedAt: Date | null; note: string | null;
}
export interface ResolveOutcome { status: string; outcome: 'ACCEPTED' | 'REJECTED' | 'ALREADY_ACCEPTED' | 'ALREADY_REJECTED'; invoice: { number: string } | null; mail?: 'PENDING' | 'SENT' | 'FAILED' | 'NO_ADDRESS' }

/**
 * Held payments (Wave 4 W2). The screen for a payment the gateway reported that did not match its order. ACCEPT goes through the ONE settlement path (PaymentSettlementService.settle), so the plan activates and the
 * invoice is made in one transaction, and only when the verified amount equals the order total. REJECT marks the order FAILED with the note and queues the vendor message through the mail port (the mail flag is
 * OFF by default, so it stays pending: nothing is lost, nothing is sent). Both are idempotent and audited. No refund is ever made here: that is done in the gateway dashboard.
 */
@Injectable()
export class HeldPaymentsService {
  clock: () => Date = () => new Date();
  constructor(private readonly repo: PlanBillingRepository, private readonly settlement: PaymentSettlementService, @Optional() private readonly email?: EmailPort) {}

  /** A FAILED order that carries a gateway payment id was a held payment an admin rejected (an order whose provider order could not be made has no payment id). */
  private rejected(o: OrderRow): boolean { return o.status === 'FAILED' && o.paymentId !== null; }
  private accepted(o: OrderRow): boolean { return o.status === 'PAID' && o.settledByName !== null && o.reason !== null && o.source === 'SELF'; }

  private view(o: OrderRow): HeldView {
    const rej = this.rejected(o); const acc = this.accepted(o);
    return {
      id: o.id, vendorId: o.vendorId, gateway: o.gateway ?? 'razorpay', status: o.status, heldReason: heldReason(o), expectedTotalPaise: o.amountPaise, amountSeenPaise: o.paidAmountPaise, currency: o.currency,
      providerOrderId: o.providerOrderId, gatewayPaymentId: o.paymentId, heldAt: o.updatedAt,
      resolution: rej ? 'REJECTED' : acc ? 'ACCEPTED' : null, resolvedBy: rej || acc ? o.settledByName : null, resolvedAt: rej ? o.settledOn : acc ? o.paidAt : null, note: rej || acc ? o.reason : null,
    };
  }

  async list(f: HeldFilter): Promise<{ items: HeldView[]; total: number }> {
    const r = await this.repo.listOrders({ status: 'REVIEW', ...(f.vendorId ? { vendorId: f.vendorId } : {}), ...(f.gateway ? { gateway: f.gateway } : {}), ...(f.from ? { from: f.from } : {}), ...(f.to ? { to: f.to } : {}), skip: f.skip, take: f.take });
    return { items: r.items.map((o) => this.view(o)), total: r.total };
  }

  /** A held payment, or one that was resolved (it stays readable). Any other order answers exactly like one that does not exist. */
  async detail(id: string): Promise<HeldView> {
    const o = await this.repo.getOrder(id);
    if (!o || !(o.status === 'REVIEW' || this.rejected(o) || this.accepted(o))) throw new NotFoundException(billingError('HELD_PAYMENT_NOT_FOUND', 'That held payment does not exist.'));
    return this.view(o);
  }

  async resolve(id: string, input: HeldResolveInput, actor: Actor, byName: string): Promise<ResolveOutcome> {
    const c = checkHeldResolution(input);
    if (!c.ok) throw new BadRequestException({ ...billingError(c.code, 'Some details need fixing.'), details: { fields: c.fields } });
    const o = await this.repo.getOrder(id);
    if (!o) throw new NotFoundException(billingError('HELD_PAYMENT_NOT_FOUND', 'That held payment does not exist.'));
    return c.value.action === 'ACCEPT' ? this.accept(o, c.value, actor, byName) : this.reject(o, c.value.note, actor, byName);
  }

  private notHeld(o: OrderRow): ConflictException {
    return o.status === 'PAID' || this.rejected(o) ? new ConflictException(billingError('HELD_ALREADY_RESOLVED', 'That payment is already resolved.')) : new ConflictException(billingError('HELD_PAYMENT_NOT_FOUND', 'That order is not a held payment.'));
  }

  private async accept(o: OrderRow, v: { note: string; verifiedAmountPaise: number; gatewayPaymentId: string }, actor: Actor, byName: string): Promise<ResolveOutcome> {
    if (o.status === 'PAID' && this.accepted(o) && o.paymentId === v.gatewayPaymentId) {   // the same acceptance again changes nothing
      const inv = await this.repo.getInvoiceByOrder(o.id);
      return { status: 'PAID', outcome: 'ALREADY_ACCEPTED', invoice: inv ? { number: inv.invoiceNumber } : null };
    }
    if (o.status !== 'REVIEW') throw this.notHeld(o);
    // the one rule: the money verified in the gateway dashboard is exactly the order total including GST, to the paise. Anything else is never accepted here.
    if (v.verifiedAmountPaise !== o.amountPaise) throw new ConflictException({ ...billingError('HELD_AMOUNT_MISMATCH', 'The verified amount is not the order total including GST, so it cannot be accepted.'), details: { expectedTotalPaise: o.amountPaise } });
    const ctx: SettleCtx = { planLevel: null };
    const outcome = await this.settlement.settle({ orderId: o.id, paid: { paymentId: v.gatewayPaymentId, amount: v.verifiedAmountPaise, currency: o.currency }, via: 'CONFIRM', actor, reason: v.note }, ctx);
    if (outcome !== 'PAID') throw this.notHeld((await this.repo.getOrder(o.id)) ?? o);
    await this.repo.updateOrderCas(o.id, ['PAID'], { settledByName: byName });
    await this.repo.transaction(o.vendorId, (tx) => tx.audit(actor, 'billing.held.accepted', o.id, { status: 'REVIEW', amountSeenPaise: o.paidAmountPaise }, { status: 'PAID', verifiedAmountPaise: v.verifiedAmountPaise, gatewayPaymentId: v.gatewayPaymentId, note: v.note, by: byName }));
    return { status: 'PAID', outcome: 'ACCEPTED', invoice: ctx.invoice ? { number: ctx.invoice.number } : null };
  }

  private async reject(o: OrderRow, note: string, actor: Actor, byName: string): Promise<ResolveOutcome> {
    if (this.rejected(o)) return { status: 'FAILED', outcome: 'ALREADY_REJECTED', invoice: null };
    if (o.status !== 'REVIEW') throw this.notHeld(o);
    const now = this.clock();
    const done = await this.repo.transaction(o.vendorId, async (tx) => {
      const ok = await tx.updateOrderCas(o.id, ['REVIEW'], { status: 'FAILED', reason: note, settledByName: byName, settledOn: now });
      if (ok) await tx.audit(actor, 'billing.held.rejected', o.id, { status: 'REVIEW', amountSeenPaise: o.paidAmountPaise }, { status: 'FAILED', note, by: byName, paymentId: o.paymentId });
      return ok;
    });
    if (!done) return { status: 'FAILED', outcome: 'ALREADY_REJECTED', invoice: null };   // a racing second reject
    return { status: 'FAILED', outcome: 'REJECTED', invoice: null, mail: await this.mailVendor(o) };
  }

  /** The vendor is told through the mail port, best effort: the flag is OFF by default, so the port refuses and the message stays pending. Never throws, never blocks the resolution. The text names no amount. */
  private async mailVendor(o: OrderRow): Promise<'PENDING' | 'SENT' | 'FAILED' | 'NO_ADDRESS'> {
    try {
      const vendor = await this.repo.vendor(o.vendorId);
      if (!vendor?.email) return 'NO_ADDRESS';
      if (!this.email) return 'PENDING';
      try {
        await this.email.send({ lane: 'SYSTEM', kind: 'RECEIPT', to: vendor.email, subject: 'About your recent payment', text: 'We could not match a recent payment to your plan order, so the plan was not activated. Any amount taken is returned through your payment method. Please contact support if you have a question.' });
        return 'SENT';
      } catch (e) { const code = (e as { response?: { code?: string } }).response?.code; return code === 'EMAIL_NOT_LIVE' || code === 'EMAIL_NOT_CONFIGURED' ? 'PENDING' : 'FAILED'; }
    } catch { return 'FAILED'; }
  }
}
