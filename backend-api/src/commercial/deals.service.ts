import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingDeal, Invoice, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { WalletService } from '../wallet/wallet.service';
import { EmailService } from '../email/email.service';
import { WORKSPACE_YEARLY_PAISE, BOS_YEARLY_PAISE } from '../payments/plan-pricing.constants';
import { Actor, CommercialAuditService, CommercialMessenger } from './foundation.services';
import { InvoiceBuilderService, ChannelT, InvoiceKindT } from './invoice-builder.service';
import { SettlementService } from './settlement.service';
import { AnnualRates, BuiltQuote, QuoteSpec, buildQuote } from './quote-builder';
import { evaluatePromo, normalizePromoCode } from './promo-rules';
import { BillingCycle, GstMode, addMonths, cycleMonths, rupees } from './pricing-math';
import { PlanKey } from './entitlements';
import { payUrl } from './pay-token';
import { advisoryXactLock } from '../common/db-lock';

export interface ProspectInput { name?: string; phone?: string; email?: string; business?: string; demoSubdomain?: string }

export interface DealSpec extends QuoteSpec {
  vendorId?: string | null;
  prospect?: ProspectInput | null;
  kind?: InvoiceKindT;
  promoCode?: string;
  graceDays?: number;
  allowedChannels?: ChannelT[];
  linkExpiryDays?: number;
  allowPromoEntry?: boolean;
  allowPromoStacking?: boolean;
  paymentDueDays?: number | null;
  notes?: string;
}

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'gapi', 'admin', 'app', 'mail', 'pay', 'demo', 'dashboard', 'login', 'static', 'cdn', 'assets']);
const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const CHANNELS: ChannelT[] = ['RAZORPAY', 'UPI_QR', 'OFFLINE'];

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly builder: InvoiceBuilderService,
    private readonly settlement: SettlementService,
    private readonly audit: CommercialAuditService,
    private readonly messenger: CommercialMessenger,
    private readonly email: EmailService,
  ) {}

  /** Annual list prices — the platform's single pricing source (admin Pricing Manager keys, constants as fallback). */
  async annualRates(): Promise<AnnualRates> {
    const [ws, bos] = await Promise.all([
      this.wallet.getRate('domainapp_workspace_yearly', WORKSPACE_YEARLY_PAISE),
      this.wallet.getRate('domainapp_bos_yearly', BOS_YEARLY_PAISE),
    ]);
    return { WORKSPACE: ws, BOS: bos };
  }

  private validateSpec(spec: DealSpec): { channels: ChannelT[]; graceDays: number; linkExpiryDays: number } {
    if (!['EXCLUSIVE', 'INCLUSIVE', 'NONE'].includes(spec.gstMode)) throw new BadRequestException('Choose a GST mode');
    const channels = [...new Set(spec.allowedChannels ?? [])].filter((c) => CHANNELS.includes(c));
    if (!channels.length) throw new BadRequestException('Enable at least one payment channel');
    const graceDays = spec.graceDays ?? 7;
    if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 90) throw new BadRequestException('Grace days must be 0–90');
    const linkExpiryDays = spec.linkExpiryDays ?? 14;
    if (!Number.isInteger(linkExpiryDays) || linkExpiryDays < 1 || linkExpiryDays > 180) throw new BadRequestException('Link expiry must be 1–180 days');
    if (spec.paymentDueDays != null && (!Number.isInteger(spec.paymentDueDays) || spec.paymentDueDays < 0 || spec.paymentDueDays > 90)) throw new BadRequestException('Payment due days must be 0–90');
    return { channels, graceDays, linkExpiryDays };
  }

  /** Server-authoritative totals — used by the live preview AND by invoice creation (same code path). */
  async quote(spec: DealSpec, vendorIdForPromo?: string | null, now = new Date()): Promise<BuiltQuote & { promo?: { id: string; code: string } }> {
    const rates = await this.annualRates();
    if (spec.discount?.mode !== 'PROMO') return buildQuote(spec, rates);

    const code = normalizePromoCode(spec.promoCode);
    if (!code) throw new BadRequestException('Enter a valid promo code');
    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
    if (!promo) throw new BadRequestException('That promo code does not exist');
    const base = buildQuote({ ...spec, discount: { mode: 'NONE' } }, rates);
    const months = base.months;
    const [total, byVendor] = await Promise.all([
      this.prisma.promoRedemption.count({ where: { promoCodeId: promo.id } }),
      vendorIdForPromo ? this.prisma.promoRedemption.count({ where: { promoCodeId: promo.id, vendorId: vendorIdForPromo } }) : Promise.resolve(0),
    ]);
    const res = evaluatePromo(promo, {
      now, planKey: spec.planKey ?? null, billingCycle: spec.billingCycle ?? null, cycleMonths: months,
      kind: spec.kind ?? (spec.planKey ? 'ACTIVATION' : 'ADDON'), subtotalPaise: base.totals.subtotalPaise,
      adminDiscountPresent: false, allowStacking: false, redemptionsTotal: total, redemptionsByVendor: byVendor, invoiceHasPromo: false,
    });
    if (!res.ok) throw new BadRequestException(res.reason);
    const built = buildQuote(spec, rates, res.discountPaise);
    return { ...built, promo: { id: promo.id, code: promo.code } };
  }

  async preview(spec: DealSpec) {
    this.validateSpec({ ...spec, allowedChannels: spec.allowedChannels?.length ? spec.allowedChannels : ['OFFLINE'] });
    const q = await this.quote(spec, spec.vendorId);
    return { lines: q.lines, months: q.months, totals: q.totals, discountReason: q.discountReason, bigDiscount: q.bigDiscount, promo: q.promo ?? null, aiCredit: q.aiCredit };
  }

  // ── Vendor / prospect ──────────────────────────────────────────────────────────────────────────

  /** The vendor row an invoice hangs off. A prospect becomes a hidden "pre-sale" vendor (isSandbox, no expiry). */
  async resolveVendor(spec: DealSpec, actor: Actor): Promise<{ vendorId: string; created: boolean }> {
    if (spec.vendorId) {
      const v = await this.prisma.vendor.findUnique({ where: { id: spec.vendorId }, select: { id: true } });
      if (!v) throw new NotFoundException('Vendor not found');
      return { vendorId: v.id, created: false };
    }
    const p = spec.prospect;
    if (!p?.name?.trim() || !p.business?.trim()) throw new BadRequestException('Prospect name and business name are required');
    const sub = p.demoSubdomain?.trim().toLowerCase() || undefined;
    if (sub) {
      if (!SUBDOMAIN_RE.test(sub) || RESERVED_SUBDOMAINS.has(sub)) throw new BadRequestException('Demo subdomain must be 3–40 lowercase letters, numbers or hyphens');
      const existing = await this.prisma.vendor.findUnique({ where: { subdomain: sub }, select: { id: true } });
      if (existing) return { vendorId: existing.id, created: false }; // the demo site already exists — attach the deal to it
    }
    const email = (p.email ?? '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BadRequestException('A valid prospect email is required to create their account');
    const byEmail = await this.prisma.vendor.findUnique({ where: { email }, select: { id: true } });
    if (byEmail) return { vendorId: byEmail.id, created: false };

    const vendor = await this.prisma.vendor.create({
      data: {
        name: p.name.trim().slice(0, 80), email, businessName: p.business.trim().slice(0, 120), phone: p.phone?.trim() || undefined,
        industry: 'general', subdomain: sub, role: 'VENDOR', status: 'ACTIVE',
        isSandbox: true, expiresAt: null, // pre-sale: hidden from the public site, never auto-deleted; flipped live when the activation invoice is paid
        password: await AuthService.hashPassword(crypto.randomBytes(24).toString('hex')),
      },
    });
    await this.audit.log(actor, 'prospect.create_vendor', 'Vendor', vendor.id, { subdomain: sub ?? null, business: vendor.businessName });
    return { vendorId: vendor.id, created: true };
  }

  // ── Persisting ─────────────────────────────────────────────────────────────────────────────────

  private dealData(spec: DealSpec, q: BuiltQuote, vendorId: string | null, extra: { graceDays: number; channels: ChannelT[]; linkExpiryDays: number; promoId?: string | null }, actor: Actor): Prisma.BillingDealUncheckedCreateInput {
    return {
      vendorId, prospectName: spec.prospect?.name, prospectPhone: spec.prospect?.phone, prospectEmail: spec.prospect?.email,
      prospectBusiness: spec.prospect?.business, demoSubdomain: spec.prospect?.demoSubdomain?.toLowerCase(),
      planKey: spec.planKey ?? undefined, billingCycle: spec.billingCycle ?? undefined, cycleMonths: q.months ?? undefined,
      lineItems: q.lines.map((l) => ({ kind: l.kind, label: l.label, amountPaise: l.amountPaise, qty: l.qty ?? 1 })) as Prisma.InputJsonValue,
      listAmountPaise: q.totals.subtotalPaise, discountPaise: q.totals.discountPaise, discountReason: q.discountReason ?? undefined,
      promoCodeId: extra.promoId ?? undefined, gstMode: spec.gstMode, graceDays: extra.graceDays, allowedChannels: extra.channels,
      linkExpiryDays: extra.linkExpiryDays, allowPromoEntry: Boolean(spec.allowPromoEntry), paymentDueDays: spec.paymentDueDays ?? undefined,
      notes: spec.notes?.slice(0, 1000), createdBy: actor.email,
      aiCreditPaise: q.aiCredit?.paise ?? undefined,
    };
  }

  async saveDraft(spec: DealSpec, actor: Actor, dealId?: string): Promise<BillingDeal> {
    const v = this.validateSpec(spec);
    const q = await this.quote(spec, spec.vendorId);
    const data = this.dealData(spec, q, spec.vendorId ?? null, { ...v, promoId: q.promo?.id }, actor);
    const deal = dealId
      ? await this.prisma.billingDeal.update({ where: { id: dealId }, data: { ...data, status: 'DRAFT' } })
      : await this.prisma.billingDeal.create({ data: { ...data, status: 'DRAFT' } });
    if (q.bigDiscount || q.totals.discountPaise > 0) await this.audit.log(actor, 'deal.discount', 'BillingDeal', deal.id, { discountPaise: q.totals.discountPaise, reason: q.discountReason, big: q.bigDiscount });
    if (q.aiCredit?.overridden) await this.audit.log(actor, 'deal.ai_credit_override', 'BillingDeal', deal.id, { computedPaise: q.aiCredit.computedPaise, enteredPaise: q.aiCredit.paise });
    return deal;
  }

  /** Create the deal's invoice + pay link. The clear link is returned once and never stored. */
  async createInvoice(spec: DealSpec, actor: Actor, opts: { dealId?: string; activateNow?: boolean; sendNow?: boolean } = {}): Promise<{ invoice: Invoice; payLink: string; dealId: string; vendorId: string }> {
    const v = this.validateSpec(spec);
    const { vendorId } = await this.resolveVendor(spec, actor);
    const q = await this.quote(spec, vendorId);
    const kind: InvoiceKindT = spec.kind ?? (spec.planKey ? 'ACTIVATION' : 'ADDON');
    if (kind === 'ACTIVATION' && !spec.planKey) throw new BadRequestException('An activation invoice needs a plan');

    const dealData = this.dealData(spec, q, vendorId, { ...v, promoId: q.promo?.id }, actor);
    const deal = opts.dealId
      ? await this.prisma.billingDeal.update({ where: { id: opts.dealId }, data: { ...dealData, status: 'SENT', activateNow: Boolean(opts.activateNow) } })
      : await this.prisma.billingDeal.create({ data: { ...dealData, status: 'SENT', activateNow: Boolean(opts.activateNow) } });

    const description = q.lines.length === 1 ? q.lines[0].label : `${q.lines[0].label} + ${q.lines.length - 1} more`;
    const { invoice, token } = await this.builder.create({
      vendorId, kind, description, lines: q.lines, totals: q.totals, gstMode: spec.gstMode as GstMode, status: 'SENT', dealId: deal.id,
      planKey: spec.planKey ?? null, billingCycle: (spec.billingCycle ?? null) as BillingCycle | null, cycleMonths: q.months,
      discountReason: q.discountReason, adminDiscount: spec.discount?.mode === 'PERCENT' || spec.discount?.mode === 'FLAT', allowPromoStacking: Boolean(spec.allowPromoStacking),
      promoCodeId: q.promo?.id ?? null, allowPromoEntry: Boolean(spec.allowPromoEntry), allowedChannels: v.channels, linkExpiryDays: v.linkExpiryDays,
      dueInDays: opts.activateNow ? spec.paymentDueDays ?? 7 : v.linkExpiryDays,
    });
    if (q.aiCredit?.overridden) await this.audit.log(actor, 'deal.ai_credit_override', 'BillingDeal', deal.id, { computedPaise: q.aiCredit.computedPaise, enteredPaise: q.aiCredit.paise, invoiceId: invoice.id });
    await this.audit.log(actor, 'deal.invoice_created', 'Invoice', invoice.id, {
      dealId: deal.id, kind, totalPaise: invoice.totalAmount, discountPaise: q.totals.discountPaise, discountReason: q.discountReason, big: q.bigDiscount, gstMode: spec.gstMode, channels: v.channels,
    });

    if (opts.activateNow) {
      if (!spec.planKey) throw new BadRequestException('Activate-now needs a plan');
      const act = await this.activateNow(invoice.id, spec.paymentDueDays ?? 7, v.graceDays, actor);
      if (act.credentials) {
        // A pre-sale prospect just went live: give them their first login.
        const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
        if (vendor) await this.email.sendWelcomeEmail(vendor, act.credentials.password).catch(() => undefined);
      }
    }
    const payLink = payUrl(token);
    if (invoice.totalAmount === 0) await this.settlement.settleFree(invoice.id, actor);
    else if (opts.sendNow) await this.sendLink(invoice.id, payLink);
    return { invoice, payLink, dealId: deal.id, vendorId };
  }

  /**
   * "Activate now, payment due in N days": all features on immediately (ACTIVE_PAYMENT_DUE) while the invoice
   * stays payable. The AI Studio credit for the term (prorated, see ai-credit.ts) is granted now; paying later grants nothing more.
   */
  async activateNow(invoiceId: string, dueDays: number, graceDays: number, actor: Actor, now = new Date()): Promise<{ termId: string; credentials?: { email: string; password: string } }> {
    const out = await this.prisma.$transaction(async (tx) => {
      await advisoryXactLock(tx, `activate:${invoiceId}`);
      const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!inv) throw new NotFoundException('Invoice not found');
      if (!inv.planKey || !inv.billingCycle) throw new BadRequestException('This invoice has no plan to activate');
      if (inv.status === 'PAID') throw new BadRequestException('This invoice is already paid');
      const existing = inv.termId ? await tx.billingTerm.findUnique({ where: { id: inv.termId } }) : null;
      if (existing) return { termId: existing.id, credentials: undefined };

      const months = inv.cycleMonths ?? cycleMonths(inv.billingCycle as BillingCycle);
      const cur = await tx.billingTerm.findFirst({ where: { vendorId: inv.vendorId, isCurrent: true } });
      if (cur) await tx.billingTerm.update({ where: { id: cur.id }, data: { isCurrent: false } });
      const list = inv.listAmountPaise ?? inv.totalAmount;
      const term = await tx.billingTerm.create({
        data: {
          vendorId: inv.vendorId, planKey: inv.planKey as PlanKey, billingCycle: inv.billingCycle as BillingCycle, cycleMonths: months,
          listAmountPaise: list, discountPaise: inv.discountPaise, netAmountPaise: list - inv.discountPaise, gstMode: inv.gstMode,
          gstNote: inv.gstMode === 'NONE' ? 'GST not charged (admin deal)' : undefined,
          periodStart: now, periodEnd: addMonths(now, months), graceDays, status: 'ACTIVE_PAYMENT_DUE', source: inv.dealId ? 'ADMIN_DEAL' : 'STANDARD',
          isCurrent: true, allowedChannels: inv.allowedChannels, paymentDueAt: new Date(now.getTime() + dueDays * 86_400_000),
          activationInvoiceId: inv.id, activatedAt: now, createdBy: actor.email,
          aiCreditPaise: await this.settlement.termAiCredit(tx, inv, inv.planKey as PlanKey, months),
        },
      });
      await tx.invoice.update({ where: { id: inv.id }, data: { termId: term.id } });
      await this.settlement.grantEntitlements(tx, inv.vendorId, inv.planKey as PlanKey, term.id, now, term.periodEnd as Date, term.netAmountPaise);
      const credentials = await this.settlement.goLive(tx, inv.vendorId, now);
      await this.audit.log(actor, 'term.activate_now', 'BillingTerm', term.id, { invoiceId: inv.id, dueDays, graceDays, plan: inv.planKey, cycle: inv.billingCycle }, tx);
      return { termId: term.id, credentials };
    });
    return out;
  }

  /** A ₹0 invoice (e.g. the proration credit covers the whole price) has nothing to pay: settle it so its effects apply. */
  async settleIfFree(invoice: { id: string; totalAmount: number }, actor: Actor | string, now = new Date()): Promise<boolean> {
    if (invoice.totalAmount !== 0) return false;
    await this.settlement.settleFree(invoice.id, actor, now);
    return true;
  }

  async sendLink(invoiceId: string, payLink: string): Promise<{ email: boolean; whatsapp: boolean }> {
    const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const vendor = await this.prisma.vendor.findUnique({ where: { id: inv.vendorId } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return this.messenger.send(
      { vendorId: vendor.id, name: vendor.name, email: vendor.email, phone: vendor.phone },
      `Your Get4Domain invoice ${inv.invoiceNumber} — ${rupees(inv.totalAmount)}`,
      `Hi ${vendor.name.split(' ')[0] || 'there'}, here is your invoice ${inv.invoiceNumber} for ${inv.description}. Total ${rupees(inv.totalAmount)}${inv.gstMode === 'NONE' ? ' (no GST)' : inv.gstMode === 'INCLUSIVE' ? ' (GST included)' : ' (incl. 18% GST)'}. You can pay securely by UPI, QR or card at the link below.`,
      payLink,
    );
  }

  // ── Reads ──────────────────────────────────────────────────────────────────────────────────────

  listDeals(vendorId?: string) {
    return this.prisma.billingDeal.findMany({ where: vendorId ? { vendorId } : {}, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async getDeal(id: string) {
    const d = await this.prisma.billingDeal.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Deal not found');
    return d;
  }

}
