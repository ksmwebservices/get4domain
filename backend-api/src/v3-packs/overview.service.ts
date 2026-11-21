import { Injectable } from '@nestjs/common';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppShell, AppShellService } from './app-shell.service';
import { OVERVIEW_MATRIX, overviewParts, OverviewPart } from './core/overview-access';
import { isTeamMember, ShellPrincipal } from './core/shell-access';

/** An order is "open" until it ends: delivered, cancelled or returned. */
const ENDED_ORDER_STATUSES = ['DELIVERED', 'CANCELLED', 'RETURNED'] as const;

export interface Overview {
  actor: 'OWNER' | 'TEAM_MEMBER';
  /** the parts this caller was given, from the matrix (core/overview-access.ts) */
  parts: OverviewPart[];
  /** the whole app-shell answer (menu, plan words, packs, inbox count, next steps), cut by its own matrix */
  shell: AppShell;
  business: { name: string; subdomain: string | null; customDomain: string | null; industry: string | null } | null;
  site: { published: boolean; version: number | null; publishedAt: string | null; themeId: string | null } | null;
  /** counts only; locked:true means the plan does not include the feature, so no number is given */
  orders: { locked: boolean; open: number | null; total: number | null } | null;
  customers: { locked: boolean; total: number | null } | null;
}

/**
 * What the vendor Home screen needs in ONE read-only answer. It composes the app-shell (unchanged) and adds the business identity, the site state and two counts, each cut by the matrix as data.
 * Nothing here is a price, a money amount, a sender, a subject or a customer detail, and no figure is made up: a count is a row count of the business's own records, or null when locked.
 */
@Injectable()
export class OverviewService {
  constructor(private readonly shell: AppShellService, private readonly prisma: PrismaService, private readonly entitlements: EntitlementsService) {}

  async get(vendorId: string, who: ShellPrincipal): Promise<Overview> {
    const parts = overviewParts(who); const has = (p: OverviewPart): boolean => parts.includes(p);
    const [shell, business, site, orders, customers] = await Promise.all([
      this.shell.get(vendorId, who),
      has('business') ? this.business(vendorId) : null,
      has('site') ? this.site(vendorId) : null,
      has('orders') ? this.orders(vendorId) : null,
      has('customers') ? this.customers(vendorId) : null,
    ]);
    return { actor: isTeamMember(who) ? 'TEAM_MEMBER' : 'OWNER', parts, shell, business, site, orders, customers };
  }

  private async locked(vendorId: string, part: OverviewPart): Promise<boolean> {
    const feature = OVERVIEW_MATRIX[part].feature;
    return feature ? !(await this.entitlements.can(vendorId, feature)).allowed : false;
  }

  private async business(vendorId: string): Promise<Overview['business']> {
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { businessName: true, subdomain: true, customDomain: true, industry: true } });
    return v ? { name: v.businessName, subdomain: v.subdomain, customDomain: v.customDomain, industry: v.industry } : null;
  }

  private async site(vendorId: string): Promise<Overview['site']> {
    const p = await this.prisma.v3SitePublication.findFirst({ where: { vendorId, currentVendorId: vendorId }, select: { version: true, publishedAt: true, themeId: true } });
    return { published: !!p, version: p?.version ?? null, publishedAt: p?.publishedAt?.toISOString() ?? null, themeId: p?.themeId ?? null };
  }

  private async orders(vendorId: string): Promise<Overview['orders']> {
    if (await this.locked(vendorId, 'orders')) return { locked: true, open: null, total: null };
    const [total, open] = await Promise.all([
      this.prisma.v3Order.count({ where: { vendorId } }),
      this.prisma.v3Order.count({ where: { vendorId, status: { notIn: [...ENDED_ORDER_STATUSES] } } }),
    ]);
    return { locked: false, open, total };
  }

  private async customers(vendorId: string): Promise<Overview['customers']> {
    if (await this.locked(vendorId, 'customers')) return { locked: true, total: null };
    return { locked: false, total: await this.prisma.v3Customer.count({ where: { vendorId, archivedAt: null } }) };
  }
}
