import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { PasswordService } from '../account-security/password.service';
import { AdminTeamService } from '../admin-team/admin-team.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PlanOrderService } from '../plan-billing/plan-order.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorWithSiteDto } from '../v3-admin-vendor-site/admin-vendor-site.dto';
import { AdminVendorSiteService } from '../v3-admin-vendor-site/admin-vendor-site.service';
import { PartnersService } from '../v3-partners/partners.service';
import { ReferralsService } from '../v3-referrals/referrals.service';
import { capReached, checkEmployee, EmployeeInput, MonitorView, monitorView } from './core/telecaller-core';

export interface Caller { id: string; ip?: string | null }
export interface CollectionInput { planKey: string; termMonths: number; idempotencyKey: string }

/**
 * Telecaller backend (E6). A telecaller is a staff login with the TELECALLER label (the SALES rights) linked to a referral partner row, so what they bring in earns commission by the existing ledger.
 * Everything here joins services that already exist; they are found lazily (like the site rebuild port) so this module adds no import cycle. Every telecaller action works only on businesses attributed
 * to that telecaller, and a business of someone else answers like one that does not exist.
 */
@Injectable()
export class TelecallerService {
  /** The most businesses one telecaller may create in a day; null = the owner has not set a cap. */
  dailyCap: number | null = null;
  clock: () => Date = () => new Date();

  constructor(private readonly modules: ModuleRef, private readonly prisma: PrismaService) {}

  private get<T>(t: Type<T>): T { return this.modules.get(t, { strict: false }); }

  // ── A: one-step employee account (admin) ───────────────────────────────────────────

  async createEmployee(input: EmployeeInput, actor: Caller): Promise<{ partnerId: string; loginId: string; name: string; email: string; referralCode: string | null; inviteSent: true }> {
    const c = checkEmployee(input);
    if (!c.ok) throw new BadRequestException({ code: 'TELECALLER_INVALID', message: 'Some details need fixing.', fields: c.problems });
    const member = await this.get(AdminTeamService).invite({ name: c.value.name, email: c.value.email, ...(c.value.phone ? { phone: c.value.phone } : {}), role: AdminRole.TELECALLER });
    try {
      const partners = this.get(PartnersService);
      const partner = await partners.create({ type: 'SALES_TEAM', name: c.value.name, email: c.value.email, ...(c.value.phone ? { phone: c.value.phone } : {}), staffUserId: member.id }, { id: actor.id, ip: actor.ip ?? null });
      const link = await this.get(ReferralsService).issueLink(partner.id, { id: actor.id, ip: actor.ip ?? null });
      return { partnerId: partner.id, loginId: member.id, name: c.value.name, email: c.value.email, referralCode: (link as { code?: string } | null)?.code ?? null, inviteSent: true };
    } catch (e) {
      // undo the login made a moment ago, so a half-made employee never exists
      try { await this.prisma.adminTeamMember.update({ where: { id: member.id }, data: { status: 'removed', inviteToken: null } }); } catch { /* the original failure is the one to show */ }
      throw e;
    }
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
    const start = new Date(this.clock()); start.setHours(0, 0, 0, 0);
    const today = await this.prisma.vendor.count({ where: { registeredByStaffId: u.sub, createdAt: { gte: start } } });
    if (capReached(today, this.dailyCap)) throw new ConflictException({ code: 'TELECALLER_DAILY_CAP', message: 'You have reached the number of businesses you can create today.' });
    const { duplicateOverrideReason: _admins, ...safe } = dto;   // only an admin may create a business that looks like an existing one
    const made = await this.get(AdminVendorSiteService).create(safe as CreateVendorWithSiteDto, { id: u.sub, role: 'TELECALLER' });
    await this.get(ReferralsService).setAttribution(made.vendorId, partner.id, 'created by a telecaller', { id: u.sub, ip });
    this.get(PasswordService).requestReset(safe.email, ip ?? undefined);   // the owner sets their own password from the e-mailed link; nobody sees it
    return { vendorId: made.vendorId, subdomain: made.subdomain, siteUrl: made.siteUrl, passwordLinkSentTo: 'EMAIL' };
  }

  // ── C: payment collection record ──────────────────────────────────────────────────

  async recordCollection(u: Pick<AuthenticatedUser, 'sub'>, vendorId: string, input: CollectionInput, ip: string | null) {
    const partner = await this.partnerOf(u);
    await this.ownBusiness(partner.id, vendorId);
    const order = await this.get(PlanOrderService).createCashOrder(String(vendorId).slice(0, 64), { planKey: String(input?.planKey ?? ''), termMonths: Number(input?.termMonths), idempotencyKey: String(input?.idempotencyKey ?? '') }, { type: 'STAFF', id: u.sub, ip });
    return { order, state: 'WAITING_FOR_THE_OFFICE', note: 'An admin confirms the cash with the receipt reference. Until then the plan is not started and no commission is made.' };
  }

  // ── E: monitoring ────────────────────────────────────────────────────────────────

  async monitorOf(partnerId: string): Promise<MonitorView> {
    const [attrs, lines] = await Promise.all([
      this.prisma.referralAttribution.findMany({ where: { partnerId }, select: { vendorId: true } }),
      this.prisma.commissionLedger.findMany({ where: { partnerId, kind: 'COMMISSION' }, select: { status: true, amountMinor: true } }),
    ]);
    const ids = attrs.map((a) => a.vendorId);
    const orders = ids.length ? await this.prisma.v3PlanOrder.findMany({ where: { vendorId: { in: ids }, gateway: 'cash', status: 'CREATED' }, select: { createdAt: true } }) : [];
    const now = this.clock().getTime();
    return monitorView({ created: ids.length, paid: lines.length, waiting: orders.map((o) => ({ ageDays: Math.floor((now - o.createdAt.getTime()) / 86_400_000) })), commission: lines });
  }

  async myMonitor(u: Pick<AuthenticatedUser, 'sub'>): Promise<MonitorView & { partnerId: string }> {
    const p = await this.partnerOf(u);
    return { partnerId: p.id, ...(await this.monitorOf(p.id)) };
  }

  /** Every telecaller (a partner linked to a TELECALLER login) with the same numbers, for the admin screen. */
  async allMonitor(): Promise<Array<{ partnerId: string; name: string; email: string; status: string } & MonitorView>> {
    const partners = await this.prisma.referralPartner.findMany({ where: { staffUserId: { not: null } }, orderBy: { createdAt: 'desc' }, take: 200 });
    const logins = await this.prisma.adminTeamMember.findMany({ where: { id: { in: partners.map((p) => p.staffUserId as string) }, role: AdminRole.TELECALLER }, select: { id: true } });
    const telecallers = partners.filter((p) => logins.some((l) => l.id === p.staffUserId));
    return Promise.all(telecallers.map(async (p) => ({ partnerId: p.id, name: p.name, email: p.email, status: p.status, ...(await this.monitorOf(p.id)) })));
  }
}
