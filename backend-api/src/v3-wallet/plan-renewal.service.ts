import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { billingError } from '../plan-billing/plan-billing.errors';
import { PlanBillingRepository } from '../plan-billing/plan-billing.repository';
import { PlanOrderService } from '../plan-billing/plan-order.service';
import { BillingSettingsService } from '../plan-billing/settings/billing-settings.service';
import { PaymentSettlementService } from '../plan-billing/settlement.service';
import { WalletRuleError } from './core/wallet-core';
import { WalletSettingsService } from './settings/wallet-settings.service';
import { postEntry } from './wallet-engine';
import { notActive, walletError, walletHttpError } from './wallet.errors';
import { V3WalletService } from './wallet.service';
import { walletKey, walletQueue } from './wallet.store';

export interface RenewalView {
  orderId: string; status: 'PAID'; paidWith: 'WALLET'; planKey: string; termMonths: number; amountPaise: number; currency: string; replay: boolean;
  endsAt: Date | null; invoiceNumber: string | null; wallet: { balancePaise: number; heldPaise: number; availablePaise: number };
}

const KEY = /^[A-Za-z0-9_-]{8,80}$/;

/**
 * Buying or renewing a plan with wallet credit (slice 5.16a-2). The payment source is WALLET instead of the payment provider; everything else is the same as the online order: the same
 * quote (PlanOrderService.buildQuote, so the amount is exactly the online amount), the same settlement body (PaymentSettlementService.settleWithin), the same invoice numbering.
 *
 * ONE unit of work, in the plan billing transaction: create the order, charge the wallet (PLAN_RENEWAL, key "renew:<order id>"), then settle: PAID, the term, the invoice and the audit row.
 *   - The wallet cannot pay: the unit is abandoned, so no order, no ledger entry, no change. The refusal carries the exact shortfall and the top-up that covers it.
 *   - The term cannot start AFTER the charge: the charge is given back with a REVERSAL entry (not a refund: the money never left the wallet), the order is closed, and the vendor is told nothing was charged.
 *   - The database fails: the whole transaction rolls back, wallet and plan together; net nothing.
 * Waiting for the vendor's turn happens in the wallet queue BEFORE the transaction opens (Batch 2 lesson); settings are read before it too.
 */
@Injectable()
export class PlanRenewalService {
  clock: () => Date = () => new Date();
  constructor(
    private readonly repo: PlanBillingRepository, private readonly orders: PlanOrderService, private readonly settlement: PaymentSettlementService, private readonly wallet: V3WalletService,
    private readonly walletSettings: WalletSettingsService, @Inject(BillingSettingsService) private readonly billing: Pick<BillingSettingsService, 'get'>,
  ) {}

  async renew(vendorId: string, input: { planKey: string; termMonths: number; idempotencyKey: string; promoCode?: string }, actor: Actor): Promise<RenewalView> {
    const key = String(input.idempotencyKey ?? '');
    if (!KEY.test(key)) throw new ConflictException(billingError('IDEMPOTENCY_CONFLICT', 'The request key must be 8 to 80 letters, digits, dashes or underscores.'));
    const w = await this.wallet.syncActivation(vendorId);
    if (!w || w.status === 'INACTIVE') throw notActive();
    const s = await this.billing.get(); const ws = await this.walletSettings.get();
    const limits = { minPaise: ws.walletTopupMinPaise, maxPaise: ws.walletTopupMaxPaise };

    type Done = { orderId: string; replay: boolean; planLevel: string | null } | { failed: true };
    let done: Done;
    try {
      done = await walletQueue.run(walletKey(vendorId), async (): Promise<Done> => {
        const prior = await this.repo.findOrderByIdempotency(vendorId, key);
        if (prior) {
          const plan = await this.repo.getPlanById(prior.planId);
          if (prior.source !== 'WALLET' || !plan || plan.key !== input.planKey || prior.termMonths !== input.termMonths) throw new ConflictException(billingError('IDEMPOTENCY_CONFLICT', 'That request key was already used for a different order.'));
          if (prior.status !== 'PAID') throw new ConflictException(walletError('WALLET_RENEWAL_INVALID', 'That attempt did not complete and nothing was charged. Please start again with a new request key.'));
          return { orderId: prior.id, replay: true, planLevel: null };
        }
        const now = this.clock();
        const q = await this.orders.buildQuote(vendorId, input, now, s);   // the same coded refusals as the online order, before anything is written
        return this.repo.transaction(vendorId, async (tx) => {
          if (!tx.walletTx) throw notActive();
          const wtx = await tx.walletTx();
          const o = await tx.createOrder({
            vendorId, planId: q.plan.id, termMonths: input.termMonths, kind: q.kind === 'RENEWAL' ? 'RENEWAL' : q.kind === 'UPGRADE' ? 'UPGRADE' : 'NEW',
            quote: { ...q.quote, base: q.price.amountPaise, planKey: q.plan.key, priceId: q.price.id, creditPaise: q.credit, taxName: q.tax.name, taxRatePercent: q.tax.ratePercent, termMonths: input.termMonths, paidWith: 'WALLET' },
            amountPaise: q.quote.totalMinor, currency: q.price.currency, idempotencyKey: key, expiresAt: new Date(now.getTime() + s.orderExpiryMinutes * 60_000), createdByType: actor.type, createdById: actor.id,
          });
          await tx.updateOrderCas(o.id, ['CREATED'], { status: 'PENDING_PAYMENT', source: 'WALLET' });
          const charge = await postEntry(wtx, { kind: 'PLAN_RENEWAL', amountPaise: o.amountPaise, idempotencyKey: `renew:${o.id}`, refType: 'plan_order', refId: o.id, actor: { type: actor.type, id: actor.id }, now });
          const ctx: { planLevel: string | null } = { planLevel: null };
          let outcome = 'ERROR';
          try {
            outcome = await this.settlement.settleWithin(tx, { orderId: o.id, paid: { paymentId: `wallet:${charge.entry.id}`, amount: o.amountPaise, currency: o.currency }, via: 'WALLET', actor, reason: null }, s, ctx);
          } catch { outcome = 'ERROR'; }
          if (outcome !== 'PAID') {
            // The term could not start: give the charge back (a REVERSAL, not a refund) and close the order. If the database aborted the transaction this write fails too, and the whole unit rolls back: nothing charged either way.
            await postEntry(wtx, { kind: 'REVERSAL', amountPaise: o.amountPaise, reversesId: charge.entry.id, idempotencyKey: `renew-reverse:${o.id}`, refType: 'plan_order', refId: o.id, reason: 'the term could not be started', actor: { type: 'SYSTEM', id: null }, now });
            await tx.updateOrderCas(o.id, ['PENDING_PAYMENT'], { status: 'CANCELLED', reason: 'the term could not be started; the wallet charge was reversed' });
            await tx.audit(actor, 'wallet.plan_renewal.reversed', o.id, null, { amountPaise: o.amountPaise, ledgerId: charge.entry.id });
            return { failed: true };
          }
          await tx.audit(actor, 'wallet.plan_renewal', o.id, null, { amountPaise: o.amountPaise, ledgerId: charge.entry.id, planKey: q.plan.key, termMonths: input.termMonths });
          return { orderId: o.id, replay: false, planLevel: ctx.planLevel };
        });
      });
    } catch (e) {
      if (e instanceof WalletRuleError) throw walletHttpError(e, limits);
      throw e;
    }
    if ('failed' in done) throw new ConflictException(walletError('WALLET_RENEWAL_INVALID', 'We could not start your plan term, so nothing was charged. Please try again.'));
    if (!done.replay) this.settlement.afterPaid(vendorId, done.orderId, done.planLevel, { via: 'WALLET', actor });

    const order = (await this.repo.getOrder(done.orderId))!;
    const plan = (await this.repo.getPlanById(order.planId))!;
    const sub = await this.repo.currentSub(vendorId);
    const inv = (await this.repo.listInvoicesForVendor(vendorId, 0, 5)).items.find((i) => i.orderId === order.id) ?? null;
    const v = await this.wallet.view(vendorId);
    return {
      orderId: order.id, status: 'PAID', paidWith: 'WALLET', planKey: plan.key, termMonths: order.termMonths, amountPaise: order.amountPaise, currency: order.currency, replay: done.replay,
      endsAt: sub?.endsAt ?? null, invoiceNumber: inv?.invoiceNumber ?? null, wallet: { balancePaise: v.balancePaise, heldPaise: v.heldPaise, availablePaise: v.availablePaise },
    };
  }
}
