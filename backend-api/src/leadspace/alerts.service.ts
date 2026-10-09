import { Injectable, Logger } from '@nestjs/common';
import { LeadEvent, LeadspaceProfile } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsappGatewayService } from '../messaging/whatsapp/whatsapp-gateway.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventType, EVENT_LABEL, maskPhone, normalizePhone, rupeesText } from './leadspace.types';

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dashboardUrl = (path: string): string => `${process.env.PUBLIC_APP_URL ?? process.env.FRONTEND_URL ?? 'https://get4domain.com'}${path}`;

/** Vendor alerts: in-app and push (through the notification service), e-mail, and WhatsApp from the common number (utility templates only). Every send is best effort and never blocks a capture. */
@Injectable()
export class LeadAlertsService {
  private readonly logger = new Logger(LeadAlertsService.name);
  private heldAt = new Map<string, number>();

  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService, private readonly email: EmailService, private readonly gateway: WhatsappGatewayService) {}

  private async vendor(vendorId: string): Promise<{ email: string; phone: string | null; businessName: string } | null> {
    return this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { email: true, phone: true, businessName: true } });
  }

  private target(p: Pick<LeadspaceProfile, 'alertWhatsapp' | 'phone'> | null, v: { phone: string | null } | null): string | null {
    return normalizePhone(p?.alertWhatsapp) ?? normalizePhone(p?.phone) ?? normalizePhone(v?.phone);
  }

  private async safely(label: string, job: () => Promise<unknown>): Promise<void> {
    try { await job(); } catch (e) { this.logger.warn(`LeadSpace alert (${label}) failed: ${e instanceof Error ? e.message : 'unknown'}`); }
  }

  async newLead(ev: LeadEvent, profile: LeadspaceProfile, detail: string): Promise<void> {
    const v = await this.vendor(ev.vendorId);
    const label = EVENT_LABEL[ev.type as EventType] ?? 'Enquiry';
    await this.safely('in-app', () => this.notifications.notifyVendor(ev.vendorId, 'LEADSPACE_LEAD', `New ${label.toLowerCase()}`, `${ev.customerName} - ${detail}`, { data: { link: '/dashboard?tab=leadspace' } }));
    if (v) await this.safely('email', () => this.email.sendGeneric(v.email, `New ${label.toLowerCase()} from ${ev.customerName}`, `<p>You have a new ${esc(label.toLowerCase())} on your LeadSpace page.</p><p><b>${esc(ev.customerName)}</b> - ${esc(ev.customerPhone)}<br>${esc(detail)}</p><p><a href="${esc(dashboardUrl('/dashboard'))}">Open your leads</a></p>`));
    const to = this.target(profile, v);
    const ten = normalizePhone(ev.customerPhone);
    if (to && ten) await this.safely('whatsapp', () => this.gateway.send({ template: 'leadspace_new_lead', phone: to, variables: [label.toLowerCase(), profile.businessName, ev.customerName, detail, `https://wa.me/91${ten}`], vendorId: ev.vendorId }));
  }

  /** A customer is waiting but the wallet is empty. At most one alert an hour per vendor. */
  async held(vendorId: string, heldCount: number): Promise<void> {
    const last = this.heldAt.get(vendorId) ?? 0;
    if (Date.now() - last < 3_600_000) return;
    this.heldAt.set(vendorId, Date.now());
    const [v, p] = await Promise.all([this.vendor(vendorId), this.prisma.leadspaceProfile.findUnique({ where: { vendorId } })]);
    await this.safely('held in-app', () => this.notifications.notifyVendor(vendorId, 'LEADSPACE_HELD', `${heldCount} customer${heldCount === 1 ? ' is' : 's are'} waiting`, 'Refill your LeadSpace wallet to see their details.', { data: { link: '/dashboard?tab=leadspace-wallet' } }));
    if (v) await this.safely('held email', () => this.email.sendGeneric(v.email, `${heldCount} customer${heldCount === 1 ? ' is' : 's are'} waiting for you`, `<p>${heldCount} verified customer${heldCount === 1 ? ' is' : 's are'} waiting on your LeadSpace page. Refill your wallet to see their details; the oldest are released first.</p><p><a href="${esc(dashboardUrl('/dashboard'))}">Open your wallet</a></p>`));
    const to = this.target(p, v);
    if (to) await this.safely('held whatsapp', () => this.gateway.send({ template: 'leadspace_held_leads', phone: to, variables: [String(heldCount), p?.businessName ?? v?.businessName ?? 'your business', dashboardUrl('/dashboard')], vendorId }));
  }

  /** Called when a debit takes the balance across one of the configured thresholds. */
  async lowBalance(vendorId: string, balancePaise: number): Promise<void> {
    const [v, p] = await Promise.all([this.vendor(vendorId), this.prisma.leadspaceProfile.findUnique({ where: { vendorId } })]);
    const left = rupeesText(balancePaise);
    await this.safely('low in-app', () => this.notifications.notifyVendor(vendorId, 'LEADSPACE_LOW_BALANCE', 'Your LeadSpace wallet is low', `${left} left. Refill to keep receiving customers.`, { data: { link: '/dashboard?tab=leadspace-wallet' } }));
    if (v) await this.safely('low email', () => this.email.sendGeneric(v.email, 'Your LeadSpace wallet is low', `<p>Your LeadSpace wallet has ${esc(left)} left. Your page keeps working; new customers are held for you if the balance runs out.</p><p><a href="${esc(dashboardUrl('/dashboard'))}">Refill now</a></p>`));
    const to = this.target(p, v);
    if (to) await this.safely('low whatsapp', () => this.gateway.send({ template: 'leadspace_low_balance', phone: to, variables: [p?.businessName ?? v?.businessName ?? 'your business', left, dashboardUrl('/dashboard')], vendorId }));
  }

  async released(vendorId: string, count: number): Promise<void> {
    if (count < 1) return;
    await this.safely('released', () => this.notifications.notifyVendor(vendorId, 'LEADSPACE_RELEASED', `${count} waiting customer${count === 1 ? '' : 's'} released`, 'Their details are now in your Leads list.', { data: { link: '/dashboard?tab=leadspace' } }));
  }

  /** Masked contact line for a held lead. */
  static maskedContact(phone: string): string { const t = normalizePhone(phone); return t ? maskPhone(t) : 'hidden'; }
}
