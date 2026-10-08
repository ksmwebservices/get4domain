import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Invoice, Prisma, Vendor } from '@prisma/client';
import { provisionModules } from '../registry/provisioning';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { InvoicesService } from '../invoices/invoices.service';
import { renderInvoiceHtml } from '../invoices/templates/invoice.template';
import { Actor, CommercialAuditService, CommercialMessenger } from './foundation.services';
import { ChannelT, balanceDue, isPayable } from './invoice-builder.service';
import { BillingCycle, addMonths, cycleMonths, rupees, renewalPeriod } from './pricing-math';
import { PlanKey, entitlementsFor } from './entitlements';
import { activationPeriod } from './term-rules';
import * as crypto from 'crypto';
import { advisoryXactLock } from '../common/db-lock';
import { aiStudioCreditPaise } from './ai-credit';

type Db = Prisma.TransactionClient | PrismaService;

export interface PaymentInput {
  amountPaise: number;
  via: ChannelT;
  reference?: string | null;
  razorpay?: { orderId: string; paymentId: string };
  actor?: Actor | string;
  now?: Date;
}

/** PURE decision: what applying `amount` to this invoice does. Exported for exhaustive testing. */
export function decidePayment(
  inv: { status: string; totalAmount: number; paidPaise: number; razorpayPaymentId?: string | null },
  amountPaise: number,
  razorpayPaymentId?: string,
): { action: 'apply'; newPaid: number; newStatus: 'PAID' | 'PARTIALLY_PAID'; overpaymentPaise: number }
  | { action: 'idempotent' }
  | { action: 'reject'; reason: string } {
  if (razorpayPaymentId && inv.status === 'PAID' && inv.razorpayPaymentId === razorpayPaymentId) return { action: 'idempotent' };
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) return { action: 'reject', reason: 'Amount must be a positive whole number of paise' };
  if (inv.status === 'PAID') return { action: 'reject', reason: 'This invoice is already paid' };
  if (!isPayable(inv.status)) return { action: 'reject', reason: `This invoice cannot be paid (${inv.status.toLowerCase()})` };
  const newPaid = inv.paidPaise + amountPaise;
  if (newPaid >= inv.totalAmount) return { action: 'apply', newPaid, newStatus: 'PAID', overpaymentPaise: newPaid - inv.totalAmount };
  return { action: 'apply', newPaid, newStatus: 'PARTIALLY_PAID', overpaymentPaise: 0 };
}

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: CommercialAuditService,
    private readonly messenger: CommercialMessenger,
    private readonly invoices: InvoicesService,
    private readonly email: EmailService,
  ) {}

  private async lock(tx: Db, key: string): Promise<void> {
    await advisoryXactLock(tx as Prisma.TransactionClient, key);
  }

  // ── Recording a payment ────────────────────────────────────────────────────────────────────────

  /**
   * Record money received against an invoice. Atomic and idempotent:
   *   - serialised per invoice (advisory lock) so two confirmations cannot both apply;
   *   - the same Razorpay payment id is a no-op the second time;
   *   - amount < balance → PARTIALLY_PAID (balance still due); amount == balance → PAID;
   *     amount > balance → PAID with an overpayment note (no automatic refund).
   * On the transition to PAID the term/entitlement effects run exactly once (`effectsAppliedAt`).
   */
  async applyPayment(invoiceId: string, p: PaymentInput): Promise<{ invoice: Invoice; becamePaid: boolean; idempotent: boolean }> {
    const now = p.now ?? new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, `invoice:${invoiceId}`);
      const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!inv) throw new NotFoundException('Invoice not found');
      const d = decidePayment(inv, p.amountPaise, p.razorpay?.paymentId);
      if (d.action === 'idempotent') return { invoice: inv, becamePaid: false, idempotent: true };
      if (d.action === 'reject') throw new BadRequestException(d.reason);

      if (p.razorpay) {
        const clash = await tx.invoice.findFirst({ where: { razorpayPaymentId: p.razorpay.paymentId, id: { not: inv.id } }, select: { id: true } });
        if (clash) throw new BadRequestException('This payment has already been applied to another invoice');
      }

      const becamePaid = d.newStatus === 'PAID';
      const updated = await tx.invoice.update({
        where: { id: inv.id },
        data: {
          paidPaise: d.newPaid, overpaymentPaise: d.overpaymentPaise, status: d.newStatus, paidVia: p.via,
          ...(becamePaid ? { paidAt: now } : {}),
          ...(p.razorpay ? { razorpayOrderId: p.razorpay.orderId, razorpayPaymentId: p.razorpay.paymentId } : {}),
        },
      });
      await tx.platformIncome.create({
        data: { vendorId: inv.vendorId, invoiceId: inv.id, amount: p.amountPaise, source: 'commercial_invoice', description: `${inv.invoiceNumber} — ${inv.description}${p.reference ? ` (ref ${p.reference})` : ''}` },
      });
      if (becamePaid && inv.promoCodeId && inv.discountPaise > 0) {
        const existing = await tx.promoRedemption.findUnique({ where: { invoiceId: inv.id } });
        if (!existing) await tx.promoRedemption.create({ data: { promoCodeId: inv.promoCodeId, vendorId: inv.vendorId, invoiceId: inv.id, discountPaise: inv.discountPaise } });
      }
      await this.audit.log(p.actor ?? 'system', becamePaid ? 'invoice.paid' : 'invoice.partial_payment', 'Invoice', inv.id, {
        amountPaise: p.amountPaise, via: p.via, reference: p.reference ?? null, paidPaise: d.newPaid, overpaymentPaise: d.overpaymentPaise,
      }, tx);
      return { invoice: updated, becamePaid, idempotent: false };
    });

    if (result.becamePaid) await this.runEffects(result.invoice.id, now);
    if (!result.idempotent) await this.notifyPayment(result.invoice, p.amountPaise, result.becamePaid);
    return result;
  }

  /**
   * A ₹0 invoice (a 100%-discount deal, or a proration credit that covers the whole new plan) has nothing to collect,
   * so it settles immediately — otherwise it could never become PAID and the plan would never activate.
   */
  async settleFree(invoiceId: string, actor: Actor | string, now = new Date()): Promise<Invoice> {
    const inv = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, `invoice:${invoiceId}`);
      const cur = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!cur) throw new NotFoundException('Invoice not found');
      if (cur.totalAmount !== 0) throw new BadRequestException('Only a ₹0 invoice can be settled without a payment');
      if (cur.status === 'PAID') return cur;
      if (!isPayable(cur.status)) throw new BadRequestException('This invoice cannot be settled');
      const u = await tx.invoice.update({ where: { id: cur.id }, data: { status: 'PAID', paidAt: now, paidVia: 'OFFLINE' } });
      await this.audit.log(actor, 'invoice.settled_free', 'Invoice', cur.id, { reason: 'zero total' }, tx);
      return u;
    });
    await this.runEffects(inv.id, now);
    return inv;
  }

  // ── Effects of a PAID invoice (activation / renewal / plan change) ─────────────────────────────

  /** Safe to call repeatedly: serialised per invoice and gated by `effectsAppliedAt`. Also usable as a repair. */
  async runEffects(invoiceId: string, now = new Date()): Promise<{ applied: boolean; newCredentials?: { email: string; password: string } }> {
    const out = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, `effects:${invoiceId}`);
      const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!inv || inv.status !== 'PAID' || inv.effectsAppliedAt) return { applied: false } as { applied: boolean; newCredentials?: { email: string; password: string } };
      let creds: { email: string; password: string } | undefined;
      if (inv.kind === 'ACTIVATION') creds = await this.activate(tx, inv, now);
      else if (inv.kind === 'RENEWAL') await this.renew(tx, inv, now, false);
      else if (inv.kind === 'PLAN_CHANGE') await this.renew(tx, inv, now, true);
      await tx.invoice.update({ where: { id: inv.id }, data: { effectsAppliedAt: now } });
      return { applied: true, newCredentials: creds };
    });
    if (out.newCredentials) await this.sendWelcome(invoiceId, out.newCredentials);
    return out;
  }

  /** ACTIVATION paid: term ACTIVE, demo → live, entitlements. Also lifts "payment due". */
  private async activate(tx: Prisma.TransactionClient, inv: Invoice, now: Date): Promise<{ email: string; password: string } | undefined> {
    if (!inv.planKey) return undefined; // an activation invoice without a plan has nothing to activate
    const planKey = inv.planKey as PlanKey;
    const months = inv.cycleMonths ?? cycleMonths(inv.billingCycle as BillingCycle);
    const current = await tx.billingTerm.findFirst({ where: { vendorId: inv.vendorId, isCurrent: true } });

    let term;
    // Paying the activation invoice settles an "activate now, pay later" term — also one that already lapsed while unpaid.
    const settlesCurrent = current && (current.status === 'ACTIVE_PAYMENT_DUE' || current.status === 'LAPSED') && (inv.termId ? inv.termId === current.id : current.activationInvoiceId === inv.id);
    if (current && settlesCurrent) {
      term = await tx.billingTerm.update({ where: { id: current.id }, data: { status: 'ACTIVE', paymentDueAt: null, lapsedAt: null, reminders: Prisma.DbNull, activationInvoiceId: inv.id } });
    } else {
      const { start, end } = activationPeriod(now, months);
      if (current) await tx.billingTerm.update({ where: { id: current.id }, data: { isCurrent: false } });
      const deal = inv.dealId ? await tx.billingDeal.findUnique({ where: { id: inv.dealId } }) : null;
      term = await tx.billingTerm.create({
        data: {
          vendorId: inv.vendorId, planKey, billingCycle: (inv.billingCycle ?? 'ANNUAL') as BillingCycle, cycleMonths: months,
          listAmountPaise: inv.listAmountPaise ?? inv.totalAmount, discountPaise: inv.discountPaise, netAmountPaise: (inv.listAmountPaise ?? inv.totalAmount) - inv.discountPaise,
          gstMode: inv.gstMode, periodStart: start, periodEnd: end, graceDays: deal?.graceDays ?? 7,
          status: 'ACTIVE', source: inv.dealId ? 'ADMIN_DEAL' : 'STANDARD', isCurrent: true, allowedChannels: inv.allowedChannels,
          activationInvoiceId: inv.id, activatedAt: now, createdBy: 'payment',
          aiCreditPaise: deal?.aiCreditPaise ?? aiStudioCreditPaise(planKey, months),
        },
      });
      if (deal && deal.aiCreditPaise == null) await tx.billingDeal.update({ where: { id: deal.id }, data: { aiCreditPaise: term.aiCreditPaise } });
    }
    await this.grantEntitlements(tx, inv.vendorId, planKey, term.id, term.periodStart ?? now, term.periodEnd ?? addMonths(now, months), term.netAmountPaise);
    return this.goLive(tx, inv.vendorId, now);
  }

  /** RENEWAL / PLAN_CHANGE(now) paid: a NEW term row, extended from the previous periodEnd (renewal) or from now (plan change). */
  private async renew(tx: Prisma.TransactionClient, inv: Invoice, now: Date, fromNow: boolean): Promise<void> {
    const cur = await tx.billingTerm.findFirst({ where: { vendorId: inv.vendorId, isCurrent: true } });
    const planKey = (inv.planKey ?? cur?.planKey) as PlanKey | undefined;
    if (!planKey) return;
    const cycle = (inv.billingCycle ?? cur?.billingCycle ?? 'ANNUAL') as BillingCycle;
    const months = inv.cycleMonths ?? cur?.cycleMonths ?? cycleMonths(cycle);
    const { start, end } = fromNow ? activationPeriod(now, months) : renewalPeriod(cur?.periodEnd ?? null, now, months);
    if (cur) await tx.billingTerm.update({ where: { id: cur.id }, data: { isCurrent: false } });
    // The term's price is the PLAN price only. A one-time proration CREDIT line on a plan-change invoice must not leak
    // into it, or every later renewal would be under-billed by that credit.
    const lines = Array.isArray(inv.lineItems) ? (inv.lineItems as Array<{ kind?: string; amountPaise?: number; qty?: number }>) : [];
    const planList = lines.length ? lines.filter((l) => l.kind !== 'CREDIT').reduce((a, l) => a + Math.round(l.amountPaise ?? 0) * (l.qty ?? 1), 0) : (inv.listAmountPaise ?? inv.totalAmount);
    const net = planList - inv.discountPaise;
    const term = await tx.billingTerm.create({
      data: {
        vendorId: inv.vendorId, planKey, billingCycle: cycle, cycleMonths: months,
        listAmountPaise: planList, discountPaise: inv.discountPaise, netAmountPaise: net,
        gstMode: inv.gstMode, periodStart: start, periodEnd: end, graceDays: cur?.graceDays ?? 7,
        status: 'ACTIVE', source: cur?.source ?? 'STANDARD', isCurrent: true, allowedChannels: inv.allowedChannels?.length ? inv.allowedChannels : (cur?.allowedChannels ?? []),
        activationInvoiceId: cur?.activationInvoiceId ?? undefined, activatedAt: cur?.activatedAt ?? now,
        scheduledNextPlan: null, scheduledNextCycle: null, scheduledNextCycleMonths: null, scheduledNextNetPaise: null, scheduledNextDiscountReason: null,
        // Same plan + length: carry the term's credit forward (so a renewal grants nothing). A different plan or length
        // targets the prorated credit for the new shape; only the difference over what was already granted is credited.
        aiCreditPaise: cur && cur.planKey === planKey && cur.cycleMonths === months && cur.aiCreditPaise != null ? cur.aiCreditPaise : aiStudioCreditPaise(planKey, months),
        subscriptionId: cur?.subscriptionId ?? undefined, createdBy: 'payment',
      },
    });
    await this.grantEntitlements(tx, inv.vendorId, planKey, term.id, start, end, net);
    // Close out the vendor's approved plan-change request (scheduled-at-renewal, or the NOW invoice that was just paid).
    await tx.planChangeRequest.updateMany({ where: { vendorId: inv.vendorId, status: 'APPROVED', OR: [{ newInvoiceId: inv.id }, { effective: 'AT_RENEWAL', toPlanKey: planKey }] }, data: { status: 'APPLIED', appliedAt: now } });
  }

  /**
   * Entitlements come from `planKey` ONLY. Keeps the legacy Subscription row in step (it carries the
   * theme-change counter the CMS enforces) and grants the one-time AI Studio credit exactly once per vendor.
   */
  async grantEntitlements(tx: Prisma.TransactionClient, vendorId: string, planKey: PlanKey, termId: string, start: Date, end: Date, netPaise: number): Promise<void> {
    const ent = entitlementsFor(planKey);
    let sub = await tx.subscription.findFirst({ where: { vendorId, product: 'DOMAIN_APP' }, orderBy: { createdAt: 'desc' } });
    if (!sub) {
      sub = await tx.subscription.create({
        data: { vendorId, product: 'DOMAIN_APP', plan: 'STARTUP', amount: netPaise, status: 'ACTIVE', startDate: start, endDate: end, themeChangesUsed: 0, themeChangesLimit: ent.themeChangesPerYear, themeChangesResetAt: addMonths(start, 12) },
      });
    } else {
      const planChanged = sub.themeChangesLimit !== ent.themeChangesPerYear;
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE', startDate: sub.startDate ?? start, endDate: end, amount: netPaise, themeChangesLimit: ent.themeChangesPerYear, themeChangesResetAt: sub.themeChangesResetAt ?? addMonths(start, 12), ...(planChanged && sub.themeChangesLimit == null ? { themeChangesUsed: 0 } : {}) },
      });
    }
    await tx.billingTerm.update({ where: { id: termId }, data: { subscriptionId: sub.id } });

    // Dashboard v2: the modules the plan includes are switched on (grant-only, idempotent, audited). Runs at activation, renewal, plan change and admin activation.
    await provisionModules(tx, vendorId, planKey, { actor: 'settlement', reason: 'term started or renewed' });

    await this.grantAiCredit(tx, vendorId, planKey, termId);
  }

  /** The AI Studio credit a new term for `inv` carries: the deal's stored amount (computed or admin override), else prorated. */
  async termAiCredit(tx: Prisma.TransactionClient, inv: Invoice, planKey: PlanKey, months: number): Promise<number> {
    const deal = inv.dealId ? await tx.billingDeal.findUnique({ where: { id: inv.dealId } }) : null;
    if (deal && deal.aiCreditPaise != null) return deal.aiCreditPaise;
    const computed = aiStudioCreditPaise(planKey, months);
    if (deal) await tx.billingDeal.update({ where: { id: deal.id }, data: { aiCreditPaise: computed } });
    return computed;
  }

  /**
   * One-time AI Studio credit, prorated by billing term (KSM, 2026-10-08).
   *   target  = the term's aiCreditPaise (null → prorated for plan + months)
   *   granted = everything this vendor has already received under the 'ai_studio_bonus' tag (any earlier term, plan or flow)
   *   credit  = max(0, target − granted)  — serialised per vendor, so a retry, a double settlement or a renewal grants 0.
   * Never claws back: a downgrade or a smaller target just grants nothing. Plan/cycle upgrades grant the difference only.
   */
  async grantAiCredit(tx: Prisma.TransactionClient, vendorId: string, planKey: PlanKey, termId: string): Promise<number> {
    const term = await tx.billingTerm.findUnique({ where: { id: termId } });
    if (!term) return 0;
    const target = term.aiCreditPaise ?? aiStudioCreditPaise(planKey, term.cycleMonths);
    if (target <= 0) return 0;
    await this.lock(tx, `ai-credit:${vendorId}`);
    const earlier = await tx.walletTransaction.findMany({ where: { vendorId, service: 'ai_studio_bonus' }, select: { amount: true } });
    const granted = earlier.reduce((sum, r) => sum + Math.max(0, r.amount), 0);
    const grant = Math.max(0, target - granted);
    if (grant === 0) return 0;
    const wallet = await tx.wallet.upsert({
      where: { vendorId },
      create: { vendorId, balance: grant, totalCredited: grant },
      update: { balance: { increment: grant }, totalCredited: { increment: grant } },
    });
    const planName = planKey === 'BOS' ? 'BOS' : 'Workspace';
    await tx.walletTransaction.create({
      data: {
        vendorId, walletId: wallet.id, type: 'credit', amount: grant, service: 'ai_studio_bonus',
        description: granted > 0
          ? `${planName} plan AI Studio credit — ${rupees(grant)} added (${term.cycleMonths}-month term, credit now ${rupees(target)} in total)`
          : `${planName} plan AI Studio credit — ${rupees(grant)} free wallet credit (${term.cycleMonths}-month term)`,
        balanceAfter: wallet.balance, expiresAt: new Date(Date.now() + 90 * 86_400_000),
      },
    });
    return grant;
  }

  /** Demo/prospect → live. A deal-created prospect vendor (isSandbox with no expiry) also gets a first password. */
  async goLive(tx: Prisma.TransactionClient, vendorId: string, now: Date): Promise<{ email: string; password: string } | undefined> {
    const v = await tx.vendor.findUnique({ where: { id: vendorId } });
    if (!v || !v.isSandbox) return undefined;
    const dealCreated = v.expiresAt === null;
    const password = dealCreated ? crypto.randomBytes(9).toString('base64url') : undefined;
    await tx.vendor.update({
      where: { id: vendorId },
      data: { isSandbox: false, expiresAt: null, status: 'ACTIVE', ...(password ? { password: await AuthService.hashPassword(password) } : {}) },
    });
    void now;
    return password ? { email: v.email, password } : undefined;
  }

  // ── Messaging ──────────────────────────────────────────────────────────────────────────────────

  private async sendWelcome(invoiceId: string, creds: { email: string; password: string }): Promise<void> {
    try {
      const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, select: { vendorId: true } });
      const vendor = inv ? await this.prisma.vendor.findUnique({ where: { id: inv.vendorId } }) : null;
      if (vendor) await this.email.sendWelcomeEmail(vendor as Vendor, creds.password);
    } catch (e) { this.logger.warn(`Welcome email failed: ${e instanceof Error ? e.message : 'error'}`); }
  }

  private async notifyPayment(inv: Invoice, amountPaise: number, paid: boolean): Promise<void> {
    try {
      const vendor = await this.prisma.vendor.findUnique({ where: { id: inv.vendorId } });
      if (!vendor) return;
      const subject = paid ? `Payment received — ${inv.invoiceNumber}` : `Part payment received — ${inv.invoiceNumber}`;
      const text = paid
        ? `Thank you! We received ${rupees(amountPaise)} for ${inv.invoiceNumber} (${inv.description}). Your account is up to date.${inv.overpaymentPaise > 0 ? ` You paid ${rupees(inv.overpaymentPaise)} more than invoiced — our team will adjust it against your next invoice.` : ''}`
        : `We received ${rupees(amountPaise)} towards ${inv.invoiceNumber}. Balance still due: ${rupees(balanceDue(inv))}.`;
      await this.messenger.send({ vendorId: vendor.id, name: vendor.name, email: vendor.email, phone: vendor.phone }, subject, text);
      if (paid) {
        const full = await this.prisma.invoice.findUnique({ where: { id: inv.id } });
        if (full) {
          const items = ((full.lineItems as unknown as { label: string; amountPaise: number; qty?: number }[] | null) ?? []).map((l) => ({ description: l.label, price: l.amountPaise * (l.qty ?? 1), discount: 0 }));
          const html = renderInvoiceHtml(full as never, vendor as never, { company: await this.invoices.resolveCompany(), paymentMode: full.paidVia ?? 'Online', nextRenewal: full.periodEnd, lineItems: items.length ? items : undefined });
          await this.email.sendInvoiceEmail(vendor as Vendor, full, html);
        }
      }
      await this.messenger.admin(paid ? 'Payment received' : 'Part payment received', `${rupees(amountPaise)} from ${vendor.businessName} for ${inv.invoiceNumber}`, { invoiceId: inv.id });
    } catch (e) { this.logger.warn(`Payment notification failed: ${e instanceof Error ? e.message : 'error'}`); }
  }
}
