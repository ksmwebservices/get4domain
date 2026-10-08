import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingTerm, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommercialAuditService, CommercialMessenger } from './foundation.services';
import { InvoiceBuilderService, ChannelT } from './invoice-builder.service';
import { DealsService } from './deals.service';
import { BillingCycle, GstMode, Line, computeTotals, cycleMonths, planListPaise, renewalPeriod, rupees } from './pricing-math';
import { PlanKey } from './entitlements';
import { ReminderKey, TermSnapshot, decideRenewalStep, anchorDate } from './term-rules';
import { planLabel } from './quote-builder';
import { payUrl } from './pay-token';
import { ArrangementsService } from './arrangements.service';
import { renewalBilling, shadowGst } from './arrangement-rules';

export interface RenewalRunSummary { ran: boolean; examined: number; invoicesCreated: number; reminders: number; lapsed: number; overdueMarked: number }

const REMINDER_TEXT: Record<ReminderKey, (d: number) => string> = {
  T15: (d) => `Your Get4Domain plan renews in ${d} days. Your renewal invoice is ready — pay any time before then to keep everything running.`,
  T7: () => 'Your Get4Domain plan renews in 7 days. Please pay your renewal invoice to avoid any interruption.',
  T1: () => 'Your Get4Domain plan renews tomorrow. Pay your renewal invoice today to avoid any interruption.',
  OVERDUE: () => 'Your Get4Domain plan payment is overdue. You are still within your grace period — pay now to keep publishing, messaging and AI Studio available.',
};

@Injectable()
export class RenewalService {
  private readonly logger = new Logger(RenewalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: InvoiceBuilderService,
    private readonly deals: DealsService,
    private readonly messenger: CommercialMessenger,
    private readonly audit: CommercialAuditService,
    private readonly arrangements: ArrangementsService,
  ) {}

  /** 06:00 IST daily. The advisory lock makes a second API instance (or a manual run) a harmless no-op. */
  @Cron('0 6 * * *', { timeZone: 'Asia/Kolkata' })
  async scheduled(): Promise<void> {
    try { const s = await this.runOnce(new Date()); this.logger.log(`Renewal run: ${JSON.stringify(s)}`); }
    catch (e) { this.logger.error(`Renewal run failed: ${e instanceof Error ? e.message : 'error'}`); }
  }

  async runOnce(now: Date): Promise<RenewalRunSummary> {
    const summary: RenewalRunSummary = { ran: false, examined: 0, invoicesCreated: 0, reminders: 0, lapsed: 0, overdueMarked: 0 };
    // The lock lives for the duration of this transaction; the per-term work below uses its own short writes.
    await this.prisma.$transaction(async (tx) => {
      const got = await tx.$queryRawUnsafe<{ ok: boolean }[]>('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS ok', 'commercial-renewal-engine');
      if (!got?.[0]?.ok) return;
      summary.ran = true;
      const terms = await tx.billingTerm.findMany({ where: { isCurrent: true, status: { in: ['ACTIVE', 'ACTIVE_PAYMENT_DUE'] } } });
      summary.examined = terms.length;
      for (const term of terms) {
        try { await this.processTerm(term, now, summary); }
        catch (e) { this.logger.error(`Renewal step failed for term ${term.id}: ${e instanceof Error ? e.message : 'error'}`); }
      }
      summary.overdueMarked = await this.markOverdueInvoices(now);
      // Special arrangements: the 15-days-before and the ended notices to KSM (idempotent).
      try { await this.arrangements.runNotices(now); } catch (e) { this.logger.error('Arrangement notices failed: ' + (e instanceof Error ? e.message : 'error')); }
    }, { timeout: 300_000, maxWait: 10_000 });
    return summary;
  }

  private snapshot(t: BillingTerm): TermSnapshot {
    return {
      status: t.status, periodEnd: t.periodEnd, paymentDueAt: t.paymentDueAt, graceDays: t.graceDays, renewalInvoiceId: t.renewalInvoiceId,
      reminders: (t.reminders as Partial<Record<ReminderKey, string>> | null) ?? null,
    };
  }

  private async processTerm(term: BillingTerm, now: Date, summary: RenewalRunSummary): Promise<void> {
    const d = decideRenewalStep(this.snapshot(term), now);
    const vendor = await this.prisma.vendor.findUnique({ where: { id: term.vendorId } });
    if (!vendor) return;
    const to = { vendorId: vendor.id, name: vendor.name, email: vendor.email, phone: vendor.phone };
    let freshLink: string | undefined;
    let renewalInvoiceId = term.renewalInvoiceId;

    if (d.createInvoice) {
      const created = await this.createRenewalInvoice(term, now);
      if (created) {
        renewalInvoiceId = created.invoiceId;
        freshLink = created.payLink;
        summary.invoicesCreated += 1;
        const when = term.periodEnd ? term.periodEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'soon';
        await this.messenger.send(to, `Your Get4Domain renewal invoice (${created.number})`, `Your plan renews on ${when}. Your renewal invoice for ${rupees(created.totalPaise)} is ready — you can pay it any time before then.`, created.payLink);
        await this.prisma.billingTerm.update({ where: { id: term.id }, data: { renewalInvoiceId } });
      }
    }

    if (d.reminder && !(d.createInvoice && d.reminder === 'T15')) {
      const dashboard = `${(process.env.FRONTEND_URL ?? 'https://get4domain.com').replace(/\/+$/, '')}/dashboard/billing`;
      await this.messenger.send(to, d.reminder === 'OVERDUE' ? 'Your Get4Domain payment is overdue' : 'Your Get4Domain plan renewal', REMINDER_TEXT[d.reminder](d.daysLeft ?? 0), dashboard);
      summary.reminders += 1;
    }
    if (d.markReminders.length) {
      const prev = (term.reminders as Record<string, string> | null) ?? {};
      const next: Record<string, string> = { ...prev };
      for (const k of d.markReminders) next[k] = next[k] ?? now.toISOString();
      await this.prisma.billingTerm.update({ where: { id: term.id }, data: { reminders: next as Prisma.InputJsonValue } });
    }

    if (d.lapse) {
      await this.prisma.billingTerm.update({ where: { id: term.id }, data: { status: 'LAPSED', lapsedAt: now } });
      summary.lapsed += 1;
      await this.audit.log('system', 'term.lapse', 'BillingTerm', term.id, { vendorId: term.vendorId, anchor: anchorDate(this.snapshot(term)) });
      await this.messenger.send(to, 'Your Get4Domain plan has lapsed', 'Your plan payment is past its grace period, so publishing, outbound messaging and AI Studio spend are paused. Your data and login are safe — pay your pending invoice and everything resumes instantly.', `${(process.env.FRONTEND_URL ?? 'https://get4domain.com').replace(/\/+$/, '')}/dashboard/billing`);
      await this.messenger.admin('Plan lapsed', `${vendor.businessName} has lapsed (term ${term.id})`, { vendorId: vendor.id });
    }
    void freshLink;
  }

  /**
   * The T-15 renewal invoice. Uses the scheduled next plan/cycle when the vendor asked for a change at renewal
   * (priced at list); otherwise renews the CURRENT commercial terms (a negotiated deal keeps its net price).
   * Never creates a second one while an unpaid renewal invoice exists.
   */
  async createRenewalInvoice(term: BillingTerm, now: Date): Promise<{ invoiceId: string; number: string; totalPaise: number; payLink: string } | null> {
    const open = await this.prisma.invoice.findFirst({ where: { vendorId: term.vendorId, kind: 'RENEWAL', status: { in: ['DRAFT', 'SENT', 'PENDING', 'OVERDUE', 'PAYMENT_SUBMITTED', 'PARTIALLY_PAID'] } } });
    if (open) { await this.prisma.billingTerm.update({ where: { id: term.id }, data: { renewalInvoiceId: open.id } }); return null; }

    const changed = Boolean(term.scheduledNextPlan || term.scheduledNextCycle);
    const planKey = (term.scheduledNextPlan ?? term.planKey) as PlanKey;
    const wantedCycle = (term.scheduledNextCycle ?? term.billingCycle) as BillingCycle;
    const wantedMonths = term.scheduledNextCycleMonths ?? term.cycleMonths ?? cycleMonths(wantedCycle);
    // Standard rule: annual, Razorpay only, GST on top. Anything else survives into this invoice only while an arrangement allows it.
    const arrangement = await this.arrangements.activeFor(term.vendorId, now);
    const rb = renewalBilling({ billingCycle: wantedCycle, cycleMonths: wantedMonths, gstMode: term.gstMode as GstMode, allowedChannels: term.allowedChannels as ChannelT[], planKey: term.planKey }, arrangement, now);
    const cycle = rb.billingCycle as BillingCycle;
    const months = rb.months;
    const cycleReverted = cycle !== wantedCycle;

    let lines: Line[];
    let discount = 0;
    let discountReasonText: string | null = null;
    if (cycleReverted) {
      // Half-year ended with no arrangement to continue it: the renewal is the ANNUAL plan at list price (no half-year negotiated net carries over).
      const rates = await this.deals.annualRates();
      lines = [{ kind: 'PLAN', label: planLabel(planKey, months) + ' (renewal)', amountPaise: planListPaise(rates[planKey], months), qty: 1 }];
    } else if (changed) {
      const rates = await this.deals.annualRates();
      const listNow = planListPaise(rates[planKey], months);
      const approved = term.scheduledNextNetPaise;
      if (approved != null) {
        // KSM approved a specific price for this change: the renewal bills exactly that net, even if list prices moved since.
        const planAmount = Math.max(listNow, approved);
        lines = [{ kind: 'PLAN', label: planLabel(planKey, months), amountPaise: planAmount, qty: 1 }];
        discount = planAmount - approved;
        discountReasonText = term.scheduledNextDiscountReason ?? 'Approved plan-change price';
      } else {
        lines = [{ kind: 'PLAN', label: planLabel(planKey, months), amountPaise: listNow, qty: 1 }];
      }
    } else {
      lines = [{ kind: 'PLAN', label: `${planLabel(planKey, months)} (renewal)`, amountPaise: term.listAmountPaise, qty: 1 }];
      discount = Math.min(term.discountPaise, term.listAmountPaise);
      if (discount > 0) discountReasonText = 'Negotiated renewal terms';
    }
    const totals = computeTotals(lines, discount, rb.gstMode);
    const { start, end } = renewalPeriod(term.periodEnd, now, months);
    const channels = rb.channels;
    const shadow = rb.gstMode === 'NONE' ? shadowGst(totals.netPaise, rb.arrangement?.validUntil ?? null) : null;
    const { invoice, token } = await this.builder.create({
      vendorId: term.vendorId, kind: 'RENEWAL', description: `Renewal — ${lines[0].label}`, lines, totals, gstMode: rb.gstMode, status: 'SENT',
      termId: term.id, planKey, billingCycle: cycle, cycleMonths: months, periodStart: start, periodEnd: end,
      discountReason: discount > 0 ? discountReasonText : null, adminDiscount: discount > 0, allowedChannels: channels, linkExpiryDays: 45, now,
      dueInDays: term.periodEnd ? Math.max(1, Math.round((term.periodEnd.getTime() - now.getTime()) / 86_400_000)) : 15,
      gstForgonePaise: shadow?.gstForgonePaise ?? null, gstNote: shadow?.gstNote ?? null,
    });
    await this.audit.log('system', 'renewal.invoice_created', 'Invoice', invoice.id, { termId: term.id, changed, totalPaise: invoice.totalAmount, cycle, gstMode: rb.gstMode, channels });
    if (rb.reverted.length) {
      await this.audit.log('system', 'renewal.reverted_to_standard', 'Invoice', invoice.id, { termId: term.id, vendorId: term.vendorId, reverted: rb.reverted });
      await this.messenger.admin('Renewal invoice reverted to standard terms', 'A renewal invoice was issued on standard terms (' + rb.reverted.join('; ') + ') because no special arrangement is in force. Invoice ' + invoice.invoiceNumber + '.', { invoiceId: invoice.id, vendorId: term.vendorId });
    }
    return { invoiceId: invoice.id, number: invoice.invoiceNumber, totalPaise: invoice.totalAmount, payLink: payUrl(token) };
  }

  /** Unpaid commercial invoices past their due date become OVERDUE (still payable). */
  private async markOverdueInvoices(now: Date): Promise<number> {
    const r = await this.prisma.invoice.updateMany({ where: { kind: { not: null }, status: { in: ['SENT', 'PENDING'] }, dueDate: { lt: now } }, data: { status: 'OVERDUE' } });
    return r.count;
  }
}
