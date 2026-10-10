import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingTerm, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, CommercialAuditService, CommercialMessenger } from './foundation.services';
import { SettlementService } from './settlement.service';
import { InvoiceBuilderService, ChannelT, SAFE_INVOICE_SELECT } from './invoice-builder.service';
import { DealsService } from './deals.service';
import { BillingCycle, GstMode, Line, computeTotals, cycleMonths, planListPaise, prorationCreditPaise, resolveApprovedNet, rupees } from './pricing-math';
import { PlanKey, entitlementsFor } from './entitlements';
import { isDowngrade } from './term-rules';
import { planLabel } from './quote-builder';
import { payUrl } from './pay-token';
import { advisoryXactLock } from '../common/db-lock';
import { aiStudioCreditPaise, resolveAiCredit } from './ai-credit';
import { grantLeadspacePlanCredit } from '../leadspace/plan-credit';
import { ArrangementsService } from './arrangements.service';
import { renewalBilling, shadowGst } from './arrangement-rules';

/** Fields of a term that are safe to show to the vendor. */
export function vendorTermView(t: BillingTerm | null) {
  if (!t) return null;
  return {
    id: t.id, planKey: t.planKey, billingCycle: t.billingCycle, cycleMonths: t.cycleMonths, status: t.status, source: t.source,
    netAmountPaise: t.netAmountPaise, gstMode: t.gstMode, periodStart: t.periodStart, periodEnd: t.periodEnd, graceDays: t.graceDays,
    paymentDueAt: t.paymentDueAt, scheduledNextPlan: t.scheduledNextPlan, scheduledNextCycle: t.scheduledNextCycle,
    adminDeal: t.source === 'ADMIN_DEAL', entitlements: entitlementsFor(t.planKey as PlanKey),
    // "AI Studio credit included" for THIS term (prorated by length, or the admin's figure). Never an invoice line.
    aiCreditIncludedPaise: t.aiCreditPaise ?? aiStudioCreditPaise(t.planKey as PlanKey, t.cycleMonths),
  };
}

export interface TermOverride {
  reason: string;
  planKey?: PlanKey;
  billingCycle?: BillingCycle;
  customMonths?: number;
  netAmountPaise?: number;
  gstMode?: GstMode;
  gstNote?: string | null;
  graceDays?: number;
  aiCreditPaise?: number;
  periodEnd?: string;
  paymentDueAt?: string | null;
  allowedChannels?: ChannelT[];
  status?: 'ACTIVE' | 'ACTIVE_PAYMENT_DUE' | 'LAPSED' | 'CANCELLED';
}

@Injectable()
export class TermsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: CommercialAuditService,
    private readonly settlement: SettlementService,
  ) {}

  currentFor(vendorId: string) {
    return this.prisma.billingTerm.findFirst({ where: { vendorId, isCurrent: true } });
  }

  async adminView(vendorId: string) {
    const [current, history, invoices, audit] = await Promise.all([
      this.currentFor(vendorId),
      this.prisma.billingTerm.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.invoice.findMany({ where: { vendorId, kind: { not: null } }, orderBy: { createdAt: 'desc' }, take: 50, select: SAFE_INVOICE_SELECT }),
      this.audit.listForVendor(vendorId),
    ]);
    let aiCredit: { targetPaise: number; computedPaise: number; grantedPaise: number } | null = null;
    if (current) {
      const computedPaise = aiStudioCreditPaise(current.planKey as PlanKey, current.cycleMonths);
      const granted = await this.prisma.walletTransaction.findMany({ where: { vendorId, service: 'ai_studio_bonus' }, select: { amount: true } });
      aiCredit = { targetPaise: current.aiCreditPaise ?? computedPaise, computedPaise, grantedPaise: granted.reduce((a, r) => a + Math.max(0, r.amount), 0) };
    }
    return { current, history, invoices, audit, aiCredit, entitlements: current ? entitlementsFor(current.planKey as PlanKey) : null };
  }

  /** Admin override. Never edits history in place: the current row is retired and a new one created, so every change is traceable. */
  async override(vendorId: string, o: TermOverride, actor: Actor, now = new Date()): Promise<BillingTerm> {
    if ((o.reason ?? '').trim().length < 3) throw new BadRequestException('A reason is required for every billing-term override');
    const cur = await this.currentFor(vendorId);
    if (!cur) throw new NotFoundException('This vendor has no billing term yet — create one with a deal');
    if (o.netAmountPaise != null && (!Number.isInteger(o.netAmountPaise) || o.netAmountPaise < 0)) throw new BadRequestException('Net amount must be a whole number of paise ≥ 0');
    if (o.graceDays != null && (!Number.isInteger(o.graceDays) || o.graceDays < 0 || o.graceDays > 90)) throw new BadRequestException('Grace days must be 0–90');
    const cycle = (o.billingCycle ?? cur.billingCycle) as BillingCycle;
    let months = cur.cycleMonths;
    try { if (o.billingCycle || o.customMonths) months = cycleMonths(cycle, o.customMonths ?? (cycle === 'CUSTOM_MONTHS' ? cur.cycleMonths : undefined)); } catch (e) { throw new BadRequestException((e as Error).message); }
    const newPlan = (o.planKey ?? cur.planKey) as PlanKey;
    // AI Studio credit for the new term: the admin's figure; else the prorated amount if the plan or length changed; else unchanged.
    let aiCredit: number | null = cur.aiCreditPaise;
    try {
      if (o.aiCreditPaise != null) aiCredit = resolveAiCredit(newPlan, months, o.aiCreditPaise).paise;
      else if (newPlan !== cur.planKey || months !== cur.cycleMonths) aiCredit = aiStudioCreditPaise(newPlan, months);
    } catch (e) { throw new BadRequestException((e as Error).message); }
    const periodEnd = o.periodEnd ? new Date(o.periodEnd) : cur.periodEnd;
    if (o.periodEnd && Number.isNaN((periodEnd as Date).getTime())) throw new BadRequestException('Invalid period end date');
    if (o.status === 'ACTIVE_PAYMENT_DUE' && !(o.paymentDueAt ?? cur.paymentDueAt)) throw new BadRequestException('Set a payment due date for ACTIVE_PAYMENT_DUE');

    const net = o.netAmountPaise ?? cur.netAmountPaise;
    const next = await this.prisma.$transaction(async (tx) => {
      await advisoryXactLock(tx, `term:${vendorId}`);
      await tx.billingTerm.update({ where: { id: cur.id }, data: { isCurrent: false } });
      const created = await tx.billingTerm.create({
        data: {
          vendorId, planKey: (o.planKey ?? cur.planKey) as PlanKey, billingCycle: cycle, cycleMonths: months,
          listAmountPaise: cur.listAmountPaise, discountPaise: Math.max(0, cur.listAmountPaise - net), netAmountPaise: net,
          gstMode: o.gstMode ?? cur.gstMode, gstNote: o.gstNote === undefined ? cur.gstNote : o.gstNote,
          periodStart: cur.periodStart, periodEnd, graceDays: o.graceDays ?? cur.graceDays,
          status: o.status ?? cur.status, source: 'ADMIN_DEAL', isCurrent: true,
          allowedChannels: o.allowedChannels?.length ? o.allowedChannels : cur.allowedChannels,
          paymentDueAt: o.paymentDueAt === undefined ? cur.paymentDueAt : (o.paymentDueAt ? new Date(o.paymentDueAt) : null),
          scheduledNextPlan: cur.scheduledNextPlan, scheduledNextCycle: cur.scheduledNextCycle, scheduledNextCycleMonths: cur.scheduledNextCycleMonths,
          scheduledNextNetPaise: cur.scheduledNextNetPaise, scheduledNextDiscountReason: cur.scheduledNextDiscountReason,
          aiCreditPaise: aiCredit,
          subscriptionId: cur.subscriptionId, activationInvoiceId: cur.activationInvoiceId, renewalInvoiceId: cur.renewalInvoiceId,
          activatedAt: cur.activatedAt, lapsedAt: o.status === undefined ? cur.lapsedAt : o.status === 'LAPSED' ? now : null, createdBy: actor.email,
        },
      });
      if (o.planKey && o.planKey !== cur.planKey) {
        await this.settlement.grantEntitlements(tx, vendorId, o.planKey, created.id, created.periodStart ?? now, created.periodEnd ?? now, net);
      } else if (cur.subscriptionId) {
        await tx.billingTerm.update({ where: { id: created.id }, data: { subscriptionId: cur.subscriptionId } });
        if (created.periodEnd) await tx.subscription.update({ where: { id: cur.subscriptionId }, data: { endDate: created.periodEnd } }).catch(() => undefined);
      }
      // A longer term or a higher admin figure grants only the difference; a grace-days/status-only override grants nothing.
      if (!(o.planKey && o.planKey !== cur.planKey) && (aiCredit !== cur.aiCreditPaise || months !== cur.cycleMonths)) {
        await this.settlement.grantAiCredit(tx, vendorId, newPlan, created.id);
        await grantLeadspacePlanCredit(tx, vendorId, newPlan, created.id);
      }
      if (aiCredit !== cur.aiCreditPaise) await this.audit.log(actor, 'term.ai_credit', 'BillingTerm', created.id, { vendorId, beforePaise: cur.aiCreditPaise, afterPaise: aiCredit, computedPaise: aiStudioCreditPaise(newPlan, months), reason: o.reason.trim() }, tx);
      await this.audit.log(actor, 'term.override', 'BillingTerm', created.id, { vendorId, reason: o.reason.trim(), before: pickTerm(cur), after: pickTerm(created) }, tx);
      await this.audit.log(actor, 'term.override', 'Vendor', vendorId, { termId: created.id, reason: o.reason.trim() }, tx);
      return created;
    });
    return next;
  }

  /** "Switch to X at the next renewal" — recorded on the current term, picked up by the T-15 renewal job. */
  async scheduleNext(vendorId: string, plan: PlanKey, cycle: BillingCycle, customMonths: number | undefined, actor: Actor, price?: { netPaise: number; reason: string | null }): Promise<BillingTerm> {
    const cur = await this.currentFor(vendorId);
    if (!cur) throw new NotFoundException('No billing term');
    let months: number;
    try { months = cycleMonths(cycle, customMonths); } catch (e) { throw new BadRequestException((e as Error).message); }
    const t = await this.prisma.billingTerm.update({ where: { id: cur.id }, data: { scheduledNextPlan: plan, scheduledNextCycle: cycle, scheduledNextCycleMonths: months, scheduledNextNetPaise: price?.netPaise ?? null, scheduledNextDiscountReason: price?.reason ?? null } });
    await this.audit.log(actor, 'term.schedule_next', 'BillingTerm', cur.id, { plan, cycle, months, netPaise: price?.netPaise ?? null });
    return t;
  }

  async clearScheduled(vendorId: string, actor: Actor): Promise<BillingTerm> {
    const cur = await this.currentFor(vendorId);
    if (!cur) throw new NotFoundException('No billing term');
    const t = await this.prisma.billingTerm.update({ where: { id: cur.id }, data: { scheduledNextPlan: null, scheduledNextCycle: null, scheduledNextCycleMonths: null, scheduledNextNetPaise: null, scheduledNextDiscountReason: null } });
    await this.audit.log(actor, 'term.clear_scheduled', 'BillingTerm', cur.id, {});
    return t;
  }
}

function pickTerm(t: BillingTerm) {
  return { planKey: t.planKey, cycle: t.billingCycle, months: t.cycleMonths, net: t.netAmountPaise, aiCredit: t.aiCreditPaise, gstMode: t.gstMode, grace: t.graceDays, status: t.status, periodEnd: t.periodEnd, paymentDueAt: t.paymentDueAt };
}

// ── Plan-change requests ──────────────────────────────────────────────────────────────────────────

@Injectable()
export class PlanChangeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: CommercialAuditService,
    private readonly messenger: CommercialMessenger,
    private readonly deals: DealsService,
    private readonly builder: InvoiceBuilderService,
    private readonly terms: TermsService,
    private readonly arrangements: ArrangementsService,
  ) {}

  async request(vendorId: string, r: { toPlanKey: PlanKey; toCycle: BillingCycle; customMonths?: number; effective?: 'AT_RENEWAL' | 'NOW'; note?: string }) {
    const cur = await this.terms.currentFor(vendorId);
    if (!cur || cur.status === 'CANCELLED') throw new BadRequestException('You do not have an active plan to change');
    let months: number;
    try { months = cycleMonths(r.toCycle, r.customMonths); } catch (e) { throw new BadRequestException((e as Error).message); }
    if (r.toPlanKey === cur.planKey && months === cur.cycleMonths) throw new BadRequestException('That is already your current plan and billing cycle');
    // A half-year term is arranged with our team; nobody can request it through the dashboard unless KSM has allowed it for them.
    if (r.toCycle === 'HALF_YEARLY') await this.arrangements.assertAllowed({ planKey: r.toPlanKey, billingCycle: r.toCycle, gstMode: 'EXCLUSIVE', channels: ['RAZORPAY'] }, vendorId);
    const open = await this.prisma.planChangeRequest.findFirst({ where: { vendorId, status: 'REQUESTED' } });
    if (open) throw new ConflictException('You already have a change request waiting for approval');
    // A downgrade can only start at renewal — enforced here and again on approval.
    const effective = isDowngrade(cur.planKey, r.toPlanKey) ? 'AT_RENEWAL' : r.effective ?? 'AT_RENEWAL';
    const row = await this.prisma.planChangeRequest.create({
      data: { vendorId, fromTermId: cur.id, toPlanKey: r.toPlanKey, toCycle: r.toCycle, toCycleMonths: months, effective, vendorNote: r.note?.trim().slice(0, 500) },
    });
    await this.messenger.admin('Plan change requested', `A vendor asked to move to ${r.toPlanKey} (${months} months)`, { requestId: row.id });
    return row;
  }

  forVendor(vendorId: string) {
    return this.prisma.planChangeRequest.findMany({ where: { vendorId }, orderBy: { requestedAt: 'desc' }, take: 20 });
  }

  async queue(status?: string) {
    const rows = await this.prisma.planChangeRequest.findMany({ where: status ? { status: status as never } : {}, orderBy: { requestedAt: 'desc' }, take: 200 });
    const out = [];
    const rates = await this.deals.annualRates();
    for (const r of rows) {
      const vendor = await this.prisma.vendor.findUnique({ where: { id: r.vendorId }, select: { id: true, businessName: true, name: true } });
      const cur = r.fromTermId ? await this.prisma.billingTerm.findUnique({ where: { id: r.fromTermId } }) : null;
      // What KSM would approve by default (list price of the target plan/cycle) and the credit an immediate change would earn.
      const listPaise = planListPaise(rates[r.toPlanKey as PlanKey], r.toCycleMonths);
      const creditIfNowPaise = cur && r.status === 'REQUESTED' ? Math.min(prorationCreditPaise(cur, new Date()), listPaise) : 0;
      out.push({ ...r, vendor, quote: { listPaise, creditIfNowPaise }, current: cur ? { planKey: cur.planKey, billingCycle: cur.billingCycle, periodEnd: cur.periodEnd, netAmountPaise: cur.netAmountPaise, source: cur.source } : null });
    }
    return out;
  }

  /** Approve: at renewal by default; NOW only for upgrades, issuing a PLAN_CHANGE invoice with a proration CREDIT line. */
  async approve(id: string, o: { effective?: 'AT_RENEWAL' | 'NOW'; adminNote?: string; netPaise?: number; discountReason?: string; confirm?: string }, actor: Actor, now = new Date()) {
    const r = await this.prisma.planChangeRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    if (r.status !== 'REQUESTED') throw new ConflictException('This request was already reviewed');
    const cur = await this.terms.currentFor(r.vendorId);
    if (!cur) throw new BadRequestException('Vendor has no billing term');
    const effective = o.effective ?? r.effective;
    if (r.toCycle === 'HALF_YEARLY') await this.arrangements.assertAllowed({ planKey: r.toPlanKey, billingCycle: r.toCycle, gstMode: 'EXCLUSIVE', channels: ['RAZORPAY'] }, r.vendorId, now);
    if (effective === 'NOW' && isDowngrade(cur.planKey, r.toPlanKey)) throw new BadRequestException('A downgrade can only take effect at renewal');
    // The price is decided from the server's own list price — the only client-side input is an optional, range-checked override.
    const rates = await this.deals.annualRates();
    const listPaise = planListPaise(rates[r.toPlanKey as PlanKey], r.toCycleMonths);
    let price;
    try { price = resolveApprovedNet(listPaise, o.netPaise, o.discountReason, o.confirm); } catch (e) { throw new BadRequestException((e as Error).message); }
    const reason = price.overridden ? (o.discountReason ?? '').trim().slice(0, 300) : null;

    const claim = await this.prisma.planChangeRequest.updateMany({ where: { id, status: 'REQUESTED' }, data: { status: 'APPROVED', effective, reviewedBy: actor.email, reviewedAt: now, adminNote: o.adminNote?.slice(0, 300), listPaise: price.listPaise, approvedNetPaise: price.netPaise, discountReason: reason } });
    if (claim.count === 0) throw new ConflictException('This request was just reviewed by someone else');
    const priceAudit = { listPaise: price.listPaise, approvedNetPaise: price.netPaise, discountPaise: price.discountPaise, overridden: price.overridden, discountReason: reason };

    if (effective === 'AT_RENEWAL') {
      await this.terms.scheduleNext(r.vendorId, r.toPlanKey as PlanKey, r.toCycle as BillingCycle, r.toCycleMonths, actor, price.overridden ? { netPaise: price.netPaise, reason } : undefined);
      await this.audit.log(actor, 'planchange.approve', 'PlanChangeRequest', id, { effective, ...priceAudit });
      if (price.overridden) await this.audit.log(actor, 'planchange.price_override', 'Vendor', r.vendorId, { requestId: id, ...priceAudit });
      return { approved: true, effective, invoiceId: null as string | null, ...priceAudit };
    }

    // NOW: charge the new plan at the approved price, credit the unused part of the current term. No cash refunds ever.
    const planLine: Line = { kind: 'PLAN', label: planLabel(r.toPlanKey as PlanKey, r.toCycleMonths), amountPaise: price.listPaise, qty: 1 };
    // The credit can never push the invoice below zero: it is capped at the price actually being charged.
    const credit = Math.min(prorationCreditPaise(cur, now), price.netPaise);
    const lines: Line[] = credit > 0 ? [planLine, { kind: 'CREDIT', label: 'Credit for unused days on your current plan', amountPaise: -credit, qty: 1 }] : [planLine];
    // GST treatment and payment channels follow the standard rule unless an arrangement is in force.
    const arrangement = await this.arrangements.activeFor(r.vendorId, now);
    const rb = renewalBilling({ billingCycle: r.toCycle as BillingCycle, cycleMonths: r.toCycleMonths, gstMode: cur.gstMode as GstMode, allowedChannels: cur.allowedChannels as ChannelT[], planKey: r.toPlanKey }, arrangement, now);
    const totals = computeTotals(lines, price.discountPaise, rb.gstMode);
    const shadow = rb.gstMode === 'NONE' ? shadowGst(totals.netPaise, rb.arrangement?.validUntil ?? null) : null;
    const { invoice, token } = await this.builder.create({
      vendorId: r.vendorId, kind: 'PLAN_CHANGE', description: `Plan change to ${planLine.label}`, lines, totals, gstMode: rb.gstMode, status: 'SENT',
      gstForgonePaise: shadow?.gstForgonePaise ?? null, gstNote: shadow?.gstNote ?? null,
      planKey: r.toPlanKey as PlanKey, billingCycle: r.toCycle as BillingCycle, cycleMonths: r.toCycleMonths,
      discountReason: reason, adminDiscount: price.overridden,
      allowedChannels: rb.channels, linkExpiryDays: 14, dueInDays: 14,
    });
    await this.prisma.planChangeRequest.update({ where: { id }, data: { prorationCreditPaise: credit, newInvoiceId: invoice.id } });
    await this.audit.log(actor, 'planchange.approve', 'PlanChangeRequest', id, { effective, creditPaise: credit, invoiceId: invoice.id, totalPaise: invoice.totalAmount, ...priceAudit });
    if (price.overridden) await this.audit.log(actor, 'planchange.price_override', 'Vendor', r.vendorId, { requestId: id, invoiceId: invoice.id, ...priceAudit });
    const settledFree = await this.deals.settleIfFree(invoice, actor, now);
    if (!settledFree) await this.deals.sendLink(invoice.id, payUrl(token));
    return { approved: true, effective, invoiceId: invoice.id, settledFree, prorationCreditPaise: credit, totalPaise: invoice.totalAmount, ...priceAudit, note: `Credit of ${rupees(credit)} applied. Pay link sent.` };
  }

  async reject(id: string, reason: string, actor: Actor) {
    if ((reason ?? '').trim().length < 3) throw new BadRequestException('Give the vendor a reason');
    const claim = await this.prisma.planChangeRequest.updateMany({ where: { id, status: 'REQUESTED' }, data: { status: 'REJECTED', adminNote: reason.trim().slice(0, 300), reviewedBy: actor.email, reviewedAt: new Date() } });
    if (claim.count === 0) throw new ConflictException('This request was already reviewed');
    const r = await this.prisma.planChangeRequest.findUniqueOrThrow({ where: { id } });
    const v = await this.prisma.vendor.findUnique({ where: { id: r.vendorId } });
    if (v) await this.messenger.send({ vendorId: v.id, name: v.name, email: v.email, phone: v.phone }, 'About your plan change request', `We could not approve your plan change request. ${reason.trim()}`);
    await this.audit.log(actor, 'planchange.reject', 'PlanChangeRequest', id, { reason });
    return { rejected: true };
  }
}

export type { Prisma };
