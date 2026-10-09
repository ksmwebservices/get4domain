import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddonsService } from '../addons/addons.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { OPEN_INVOICE_STATUSES } from '../commercial/activation-guard';
import { PlanKey, Profile, VendorPlan, planDisplayName, profileOfIndustry } from './registry.generated';

export interface DashboardContext {
  vendorId: string;
  businessName: string;
  industry: string;
  profile: Profile;
  /** The billing-term plan key (WORKSPACE / BOS); LEADSPACE = a LeadSpace-only account; null = no term yet (demo). Display names come from planDisplay. */
  plan: VendorPlan | null;
  planDisplay: string;
  custom: boolean;
  navV2: boolean;
  principal: 'owner' | 'team_member' | 'sandbox';
  /** Team-member access areas (null for the owner). The menu is the intersection of plan access and these. */
  memberAreas: string[] | null;
  term: { status: string; paymentDueAt: string | null; periodEnd: string | null; graceDays: number } | null;
  /** An unpaid plan invoice (also drives the banner in the header). Owner only. */
  paymentDue: { invoiceId: string; invoiceNumber: string; totalPaise: number; dueDate: string | null; overdue: boolean } | null;
  signals: {
    productsAdded: number;
    paymentsConnected: boolean;
    domainConnected: boolean;
    seoBasics: boolean;
    firstLead: boolean;
    newLeads7d: number;
    pendingOrders: number;
    lowStock: number;
    /** The vendor already has campaigns: Campaigns stays open to them whatever the plan (nothing they made is hidden). */
    hasCampaigns: boolean;
  };
}

/** What the v2 dashboard needs to know about the signed-in vendor, in one call. Every query is scoped to the caller's own vendorId. */
@Injectable()
export class DashboardContextService {
  constructor(private readonly prisma: PrismaService, private readonly addons: AddonsService) {}

  async build(user: AuthenticatedUser, now = new Date()): Promise<DashboardContext> {
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.kind === 'admin_member') throw new ForbiddenException('The vendor dashboard context is for vendor accounts');
    const vendorId = user.sub;
    const principal: DashboardContext['principal'] = user.kind === 'sandbox' ? 'sandbox' : user.kind === 'team_member' ? 'team_member' : 'owner';

    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, businessName: true, industry: true, customDomain: true } });
    if (!vendor) throw new ForbiddenException('Account not found');
    const addonStates = await this.addons.getVendorAddons(vendorId);
    const on = (key: string): boolean => addonStates.find((a) => a.key === key)?.enabled === true;

    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const [term, openInvoice, productsAdded, payCfg, cms, anyLead, newLeads7d, pendingOrders, tracked, campaignCount] = await Promise.all([
      this.prisma.billingTerm.findFirst({ where: { vendorId, isCurrent: true }, select: { planKey: true, status: true, paymentDueAt: true, periodEnd: true, graceDays: true } }),
      this.prisma.invoice.findFirst({
        where: { vendorId, kind: { not: null }, status: { in: [...OPEN_INVOICE_STATUSES] } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, invoiceNumber: true, totalAmount: true, dueDate: true },
      }),
      this.prisma.vendorProduct.count({ where: { vendorId, active: true } }),
      this.prisma.vendorPaymentConfig.findUnique({ where: { vendorId }, select: { enabled: true, razorpayKeyId: true, checkoutMode: true } }),
      this.prisma.vendorCMS.findUnique({ where: { vendorId }, select: { seoTitle: true, seoDesc: true } }),
      this.prisma.campaignLead.count({ where: { vendorId } }),
      this.prisma.campaignLead.count({ where: { vendorId, createdAt: { gte: weekAgo } } }),
      this.prisma.posSale.count({ where: { vendorId, type: 'web', status: 'PENDING_PAYMENT' } }),
      this.prisma.vendorProduct.findMany({ where: { vendorId, trackStock: true, reorderLevel: { not: null } }, select: { stockQty: true, reorderLevel: true } }),
      this.prisma.campaign.count({ where: { vendorId } }),
    ]);

    const plan: VendorPlan | null = (term?.planKey as PlanKey | undefined) ?? (on('leadspace_only') ? 'LEADSPACE' : null);
    const ownerOnlyBilling = principal !== 'team_member';
    return {
      vendorId,
      businessName: vendor.businessName,
      industry: vendor.industry ?? 'general',
      profile: profileOfIndustry(vendor.industry),
      plan,
      planDisplay: planDisplayName(plan),
      custom: on('bos_custom'),
      navV2: on('nav_v2'),
      principal,
      memberAreas: principal === 'team_member' ? user.modules ?? [] : null,
      term: term ? { status: term.status, paymentDueAt: term.paymentDueAt?.toISOString() ?? null, periodEnd: term.periodEnd?.toISOString() ?? null, graceDays: term.graceDays } : null,
      paymentDue: ownerOnlyBilling && openInvoice
        ? { invoiceId: openInvoice.id, invoiceNumber: openInvoice.invoiceNumber, totalPaise: openInvoice.totalAmount, dueDate: openInvoice.dueDate?.toISOString() ?? null, overdue: Boolean(openInvoice.dueDate && openInvoice.dueDate.getTime() < now.getTime()) }
        : null,
      signals: {
        productsAdded,
        paymentsConnected: Boolean(payCfg && (payCfg.checkoutMode === 'ORDER_REQUEST' || (payCfg.enabled && payCfg.razorpayKeyId))),
        domainConnected: Boolean(vendor.customDomain),
        seoBasics: Boolean(cms?.seoTitle && cms?.seoDesc),
        firstLead: anyLead > 0,
        newLeads7d,
        pendingOrders,
        lowStock: tracked.filter((p) => (p.stockQty ?? 0) <= (p.reorderLevel ?? 0)).length,
        hasCampaigns: campaignCount > 0,
      },
    };
  }
}
