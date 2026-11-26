import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { PasswordService } from '../account-security/password.service';
import { AdminTeamService } from '../admin-team/admin-team.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CASH_MAX_AGE_DAYS } from '../plan-billing/core/cash-core';
import { PlanPayLinkService, PayLinkView } from '../plan-billing/pay-link/plan-pay-link.service';
import { PlanOrderService } from '../plan-billing/plan-order.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorWithSiteDto } from '../v3-admin-vendor-site/admin-vendor-site.dto';
import { AdminVendorSiteService } from '../v3-admin-vendor-site/admin-vendor-site.service';
import { PartnersService } from '../v3-partners/partners.service';
import { ReferralsService } from '../v3-referrals/referrals.service';
import { checkEmployee, checkPay, EmployeeInput, isPayType, MonitorView, monitorView, PAY_TYPES, PayType, SiteStanding, siteStandingOf } from './core/telecaller-core';
import { TelecallerSettingsService } from './settings/telecaller-settings';

export interface Caller { id: string; ip?: string | null }
export interface CollectionInput { planKey: string; termMonths: number; idempotencyKey: string }
export interface PayView { partnerId: string; payType: PayType | null; monthlySalaryMinor: number | null; updatedAt: Date | null }
/** One business on a telecaller's own list. The owner's name, e-mail and phone are deliberately not part of it. */
export interface OwnBusinessRow {
  vendorId: string; businessName: string; category: string | null; createdAt: Date; accountStatus: string; subdomain: string | null;
  site: { status: SiteStanding; url: string | null; publishedAt: Date | null; indexable: boolean | null; problemCode: string | null };
}

/**
 * Telecaller backend (E6). A telecaller is a staff login with the TELECALLER label (the SALES rights) linked to a referral partner row, so what they bring in earns commission by the existing ledger.
 * Everything here joins services that already exist; they are found lazily (like the site rebuild port) so this module adds no import cycle. Every telecaller action works only on businesses attributed
 * to that telecaller, and a business of someone else answers like one that does not exist.
 */
@Injectable()
export class TelecallerService {
  private readonly logger = new Logger(TelecallerService.name);
  clock: () => Date = () => new Date();

  constructor(private readonly modules: ModuleRef, private readonly prisma: PrismaService, private readonly settings: TelecallerSettingsService) {}

  private get<T>(t: Type<T>): T { return this.modules.get(t, { strict: false }); }

  // ── A: one-step employee account (admin) ───────────────────────────────────────────

  /** The pay type may be chosen here; a salary amount may not (it is set on the pay route, SUPER_ADMIN only). */
  async createEmployee(input: EmployeeInput & { payType?: unknown; monthlySalaryMinor?: unknown }, actor: Caller): Promise<{ partnerId: string; loginId: string; name: string; email: string; referralCode: string | null; payType: PayType | null; inviteSent: true }> {
    const c = checkEmployee(input);
    const problems: Record<string, string> = c.ok ? {} : { ...c.problems };
    const payType = input?.payType ?? null;
    if (payType !== null && !isPayType(payType)) problems.payType = 'Choose salary plus commission, or commission slabs only (freelancer).';
    if ((input?.monthlySalaryMinor ?? null) !== null) problems.monthlySalaryMinor = 'The salary is set after the account is made, on the pay screen.';
    if (!c.ok || Object.keys(problems).length) throw new BadRequestException({ code: 'TELECALLER_INVALID', message: 'Some details need fixing.', fields: problems });
    const member = await this.get(AdminTeamService).invite({ name: c.value.name, email: c.value.email, ...(c.value.phone ? { phone: c.value.phone } : {}), role: AdminRole.TELECALLER });
    try {
      const partners = this.get(PartnersService);
      const partner = await partners.create({ type: 'SALES_TEAM', name: c.value.name, email: c.value.email, ...(c.value.phone ? { phone: c.value.phone } : {}), staffUserId: member.id }, { id: actor.id, ip: actor.ip ?? null });
      const link = await this.get(ReferralsService).issueLink(partner.id, { id: actor.id, ip: actor.ip ?? null });
      let saved: PayType | null = null;
      if (isPayType(payType)) {
        // the account, partner and code exist by now: a failure here must not remove the login, so the answer says no pay type is set and it can be set on the pay route
        try { await this.prisma.telecallerProfile.create({ data: { partnerId: partner.id, payType, updatedById: actor.id } }); saved = payType; }
        catch (e) { this.logger.warn(`pay type of a new telecaller was not saved: ${e instanceof Error ? e.name : 'error'}`); }
      }
      return { partnerId: partner.id, loginId: member.id, name: c.value.name, email: c.value.email, referralCode: (link as { code?: string } | null)?.code ?? null, payType: saved, inviteSent: true };
    } catch (e) {
      // undo the login made a moment ago, so a half-made employee never exists
      try { await this.prisma.adminTeamMember.update({ where: { id: member.id }, data: { status: 'removed', inviteToken: null } }); } catch { /* the original failure is the one to show */ }
      throw e;
    }
  }

  // ── pay and settings (E9c) ───────────────────────────────────────────

  /** Not found for a partner that is not a telecaller (a freelance referral partner has no telecaller pay). */
  private async assertTelecallerPartner(partnerId: string): Promise<string> {
    const id = String(partnerId).slice(0, 64);
    const partner = await this.prisma.referralPartner.findUnique({ where: { id }, select: { staffUserId: true } });
    const login = partner?.staffUserId ? await this.prisma.adminTeamMember.findUnique({ where: { id: partner.staffUserId }, select: { role: true } }) : null;
    if (login?.role !== AdminRole.TELECALLER) throw new NotFoundException({ code: 'TELECALLER_NOT_FOUND', message: 'That telecaller was not found.' });
    return id;
  }

  private payView(partnerId: string, row: { payType: string; monthlySalaryMinor: number | null; updatedAt: Date } | null): PayView {
    return { partnerId, payType: row && isPayType(row.payType) ? row.payType : null, monthlySalaryMinor: row?.monthlySalaryMinor ?? null, updatedAt: row?.updatedAt ?? null };
  }

  async payOf(partnerId: string): Promise<PayView> {
    const id = await this.assertTelecallerPartner(partnerId);
    return this.payView(id, await this.prisma.telecallerProfile.findUnique({ where: { partnerId: id } }));
  }

  /** Replaces the pay setting: a salary that is left out is cleared. */
  async setPay(partnerId: string, input: { payType?: unknown; monthlySalaryMinor?: unknown }, actor: Caller): Promise<PayView> {
    const id = await this.assertTelecallerPartner(partnerId);
    const c = checkPay(input);
    if (!c.ok) throw new BadRequestException({ code: 'TELECALLER_INVALID', message: 'Some details need fixing.', fields: c.problems });
    const data = { ...c.value, updatedById: actor.id };
    return this.payView(id, await this.prisma.telecallerProfile.upsert({ where: { partnerId: id }, create: { partnerId: id, ...data }, update: data }));
  }

  async settingsView(): Promise<{ dailyCap: number; cashOverdueAfterDays: number; payTypes: readonly PayType[]; settingKeys: { dailyCap: string; cashOverdueAfterDays: string } }> {
    const s = await this.settings.get();
    return { dailyCap: s.telecallerDailyCap, cashOverdueAfterDays: s.telecallerCashOverdueDays, payTypes: PAY_TYPES, settingKeys: { dailyCap: 'telecallerDailyCap', cashOverdueAfterDays: 'telecallerCashOverdueDays' } };
  }

  // ── who is calling ───────────────────────────────────────────────────────────────

  private async partnerOf(u: Pick<AuthenticatedUser, 'sub'>): Promise<{ id: string; name: string }> {
    const p = await this.get(PartnersService).forLogin(u.sub);
    if (!p) throw new ForbiddenException({ code: 'NOT_A_TELECALLER', message: 'This login is not set up as a telecaller.' });
    return { id: p.id, name: p.name };
  }

  /** Not found for a business that is not this telecaller's: the same answer as for one that does not exist. */
  private async ownBusiness(partnerId: string, vendorId: string): Promise<void> {
    const a = await this.prisma.referralAttribution.findUnique({ where: { vendorId: String(vendorId).slice(0, 64) }, select: { partnerId: true } });
    if (!a || a.partnerId !== partnerId) throw new NotFoundException({ code: 'UNKNOWN_VENDOR', message: 'That business was not found.' });
  }

  // ── B: create a business on behalf ───────────────────────────────────────────────

  async createBusiness(u: Pick<AuthenticatedUser, 'sub'>, dto: CreateVendorWithSiteDto, ip: string | null): Promise<{ vendorId: string; subdomain: string; siteUrl: string | null; passwordLinkSentTo: 'EMAIL' }> {
    const partner = await this.partnerOf(u);
    // the daily cap and the admins-only duplicate override are enforced by the creating service, which the general vendor-site route shares
    const made = await this.get(AdminVendorSiteService).create(dto, { id: u.sub, role: 'TELECALLER' });
    await this.get(ReferralsService).setAttribution(made.vendorId, partner.id, 'created by a telecaller', { id: u.sub, ip });
    this.get(PasswordService).requestReset(dto.email, ip ?? undefined);   // the owner sets their own password from the e-mailed link; nobody sees it
    return { vendorId: made.vendorId, subdomain: made.subdomain, siteUrl: made.siteUrl, passwordLinkSentTo: 'EMAIL' };
  }

  // ── B2 (E11b): the businesses this telecaller created ──

  /**
   * "Created by" is the staff login written on the business when it was made (the same rule the draft-edit routes use), never the referral credit, which an
   * admin can move. The login's own id is the only filter, so there is nothing in the request that could widen it.
   */
  async myBusinesses(u: Pick<AuthenticatedUser, 'sub'>, page: { skip: number; take: number }): Promise<{ items: OwnBusinessRow[]; total: number }> {
    await this.partnerOf(u);
    if (!u.sub) throw new ForbiddenException({ code: 'NOT_A_TELECALLER', message: 'This login is not set up as a telecaller.' });   // an empty id must never become an empty filter
    const where = { registeredByStaffId: u.sub };
    const [vendors, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: page.skip, take: page.take,
        select: { id: true, businessName: true, industry: true, status: true, subdomain: true, createdAt: true, siteProvisionStatus: true, siteProvisionCode: true, v3SiteRemoval: { select: { vendorId: true } } },
      }),
      this.prisma.vendor.count({ where }),
    ]);
    const ids = vendors.map((v) => v.id);
    const [live, previews] = ids.length ? await Promise.all([
      this.prisma.v3SitePublication.findMany({ where: { vendorId: { in: ids }, status: 'PUBLISHED' }, select: { vendorId: true, publishedAt: true, indexable: true } }),
      this.prisma.v3SitePublication.findMany({ where: { vendorId: { in: ids }, status: 'DRAFT_PREVIEW' }, distinct: ['vendorId'], select: { vendorId: true } }),
    ]) : [[], []];
    const liveBy = new Map(live.map((p) => [p.vendorId, p]));
    const previewed = new Set(previews.map((p) => p.vendorId));
    const base = process.env.SITE_BASE_DOMAIN || 'get4domain.com';
    return {
      total,
      items: vendors.map((v): OwnBusinessRow => {
        const p = liveBy.get(v.id) ?? null;
        const status = siteStandingOf({ removed: !!v.v3SiteRemoval, live: p !== null, preview: previewed.has(v.id), provisionStatus: v.siteProvisionStatus });
        const isLive = status === 'LIVE';
        return {
          vendorId: v.id, businessName: v.businessName, category: v.industry, createdAt: v.createdAt, accountStatus: v.status, subdomain: v.subdomain,
          site: { status, url: isLive && v.subdomain ? `https://${v.subdomain}.${base}` : null, publishedAt: isLive ? p!.publishedAt : null, indexable: isLive ? p!.indexable : null, problemCode: status === 'FAILED' ? v.siteProvisionCode : null },
        };
      }),
    };
  }

  // ── C: payment collection record ──────────────────────────────────────────────────

  async recordCollection(u: Pick<AuthenticatedUser, 'sub'>, vendorId: string, input: CollectionInput, ip: string | null) {
    const partner = await this.partnerOf(u);
    await this.ownBusiness(partner.id, vendorId);
    // the money is already collected, so the order stays open as long as a confirmation of it is accepted (an admin's own cash order closes after a few days)
    const order = await this.get(PlanOrderService).createCashOrder(String(vendorId).slice(0, 64), { planKey: String(input?.planKey ?? ''), termMonths: Number(input?.termMonths), idempotencyKey: String(input?.idempotencyKey ?? '') }, { type: 'STAFF', id: u.sub, ip }, { openDays: CASH_MAX_AGE_DAYS });
    return { order, state: 'WAITING_FOR_THE_OFFICE', note: 'An admin confirms the cash with the receipt reference. Until then the plan is not started and no commission is made.' };
  }

  // ── D2 (E11e): payment link ──

  /** A payment link for one of this telecaller's businesses: the same ownership rule as a cash collection. Nothing is collected here: the owner pays the gateway. */
  async payLink(u: Pick<AuthenticatedUser, 'sub'>, vendorId: string, input: CollectionInput, ip: string | null): Promise<PayLinkView> {
    const partner = await this.partnerOf(u);
    await this.ownBusiness(partner.id, vendorId);
    return this.get(PlanPayLinkService).create(String(vendorId).slice(0, 64), { planKey: String(input?.planKey ?? ''), termMonths: Number(input?.termMonths), idempotencyKey: String(input?.idempotencyKey ?? '') }, { type: 'STAFF', id: u.sub, ip });
  }

  // ── E: monitoring ────────────────────────────────────────────────────────────────

  async monitorOf(partnerId: string): Promise<MonitorView & { payType: PayType | null }> {
    const [{ telecallerCashOverdueDays }, profile, attrs, lines] = await Promise.all([
      this.settings.get(),
      this.prisma.telecallerProfile.findUnique({ where: { partnerId } }),
      this.prisma.referralAttribution.findMany({ where: { partnerId }, select: { vendorId: true } }),
      this.prisma.commissionLedger.findMany({ where: { partnerId, kind: 'COMMISSION' }, select: { status: true, amountMinor: true } }),
    ]);
    const ids = attrs.map((a) => a.vendorId);
    const orders = ids.length ? await this.prisma.v3PlanOrder.findMany({ where: { vendorId: { in: ids }, gateway: 'cash', status: { in: ['CREATED', 'PENDING_PAYMENT'] } }, select: { createdAt: true } }) : [];
    const now = this.clock().getTime();
    const view = monitorView({ created: ids.length, paid: lines.length, waiting: orders.map((o) => ({ ageMs: now - o.createdAt.getTime() })), overdueAfterDays: telecallerCashOverdueDays, commission: lines });
    return { ...view, payType: this.payView(partnerId, profile).payType };
  }

  async myMonitor(u: Pick<AuthenticatedUser, 'sub'>): Promise<MonitorView & { partnerId: string; payType: PayType | null }> {
    const p = await this.partnerOf(u);
    return { partnerId: p.id, ...(await this.monitorOf(p.id)) };
  }

  /** Every telecaller (a partner linked to a TELECALLER login) with the same numbers, for the admin screen. */
  async allMonitor(): Promise<Array<{ partnerId: string; name: string; email: string; status: string; payType: PayType | null } & MonitorView>> {
    const partners = await this.prisma.referralPartner.findMany({ where: { staffUserId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 200 });
    const logins = await this.prisma.adminTeamMember.findMany({ where: { id: { in: partners.map((p) => p.staffUserId as string) }, role: AdminRole.TELECALLER }, select: { id: true } });
    const telecallers = partners.filter((p) => logins.some((l) => l.id === p.staffUserId));
    return Promise.all(telecallers.map(async (p) => ({ partnerId: p.id, name: p.name, email: p.email, status: p.status, ...(await this.monitorOf(p.id)) })));
  }
}
