import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { buildUpiLink, isValidVpa, upiQrDataUrl } from './upi';
export { BillingGateService, BillingGateModule } from './billing-gate.service';
export type { GatedAction } from './billing-gate.service';

/** Who did a thing — carried into the audit log. */
export interface Actor { id: string; email: string; role: string; adminRole?: string }

export function actorOf(user: AuthenticatedUser): Actor {
  return { id: user.sub, email: user.email, role: user.role, adminRole: user.adminRole };
}

// ── Admin guard ─────────────────────────────────────────────────────────────────────────────────

/**
 * Explicit platform-admin check for every commercial admin endpoint (S7 — admin sub-roles — is still
 * open platform-wide, so this does not rely on any other guard). Accepts only the bootstrap admin
 * (role ADMIN/SUPER_ADMIN) or an invited internal staff member (`kind === 'admin_member'`); rejects
 * vendors, vendor team members and demo-sandbox principals outright.
 *
 * The MARKETING staff role is excluded from EVERY commerce endpoint, reads included (KSM, 2026-10-07: commerce
 * holds payee bank details, payment proofs and negotiated prices). The nav hides the section too, but this
 * guard is the real control. `MoneyAdminGuard` is kept on the money-moving routes as a second, explicit line.
 */
@Injectable()
export class CommercialAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) throw new ForbiddenException('Admin access required');
    const isStaffRole = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    const isBadKind = user.kind === 'team_member' || user.kind === 'sandbox';
    if (!isStaffRole || isBadKind) throw new ForbiddenException('Admin access required');
    if (user.adminRole === 'MARKETING') throw new ForbiddenException('Your staff role cannot access commerce');
    return true;
  }
}

@Injectable()
export class MoneyAdminGuard extends CommercialAdminGuard {
  canActivate(context: ExecutionContext): boolean {
    super.canActivate(context);
    const user = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user;
    // Redundant with the base guard on purpose: money routes must stay closed to MARKETING even if the base rule is relaxed.
    if (user.adminRole === 'MARKETING') throw new ForbiddenException('Your staff role cannot perform payment or billing-term actions');
    return true;
  }
}

// ── Audit ───────────────────────────────────────────────────────────────────────────────────────

@Injectable()
export class CommercialAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(actor: Actor | string, action: string, entityType: string, entityId: string, detail?: Record<string, unknown>, tx?: Prisma.TransactionClient): Promise<void> {
    const a = typeof actor === 'string' ? { id: actor, role: 'system' } : { id: actor.email || actor.id, role: actor.adminRole ?? actor.role };
    await (tx ?? this.prisma).commercialAuditLog.create({
      data: { actor: a.id, actorRole: a.role, action, entityType, entityId, detail: (detail ?? {}) as Prisma.InputJsonValue },
    });
  }

  list(entityType: string, entityId: string) {
    return this.prisma.commercialAuditLog.findMany({ where: { entityType, entityId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  /**
   * Everything recorded about ONE vendor's billing: entries filed under the vendor itself AND under its deals, invoices, terms,
   * plan-change requests and payment submissions (those actions are logged on their own entity, so reading only entityType='Vendor'
   * left the vendor's Audit trail empty — "Nothing recorded yet" — even after a deal, an invoice and an activation).
   */
  async listForVendor(vendorId: string) {
    const [deals, invoices, terms, changes] = await Promise.all([
      this.prisma.billingDeal.findMany({ where: { vendorId }, select: { id: true } }),
      this.prisma.invoice.findMany({ where: { vendorId }, select: { id: true } }),
      this.prisma.billingTerm.findMany({ where: { vendorId }, select: { id: true } }),
      this.prisma.planChangeRequest.findMany({ where: { vendorId }, select: { id: true } }),
    ]);
    const invoiceIds = invoices.map((r) => r.id);
    const subs = invoiceIds.length ? await this.prisma.manualPaymentSubmission.findMany({ where: { invoiceId: { in: invoiceIds } }, select: { id: true } }) : [];
    const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
    return this.prisma.commercialAuditLog.findMany({
      where: {
        OR: [
          { entityType: 'Vendor', entityId: vendorId },
          { entityType: 'BillingDeal', entityId: { in: ids(deals) } },
          { entityType: 'Invoice', entityId: { in: invoiceIds } },
          { entityType: 'BillingTerm', entityId: { in: ids(terms) } },
          { entityType: 'PlanChangeRequest', entityId: { in: ids(changes) } },
          { entityType: 'ManualPaymentSubmission', entityId: { in: ids(subs) } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}

// ── Messenger ───────────────────────────────────────────────────────────────────────────────────

export interface Recipient { vendorId?: string; name?: string | null; email?: string | null; phone?: string | null }

/** Best-effort multi-channel notifier over the EXISTING email / WhatsApp / in-app senders. Never throws. */
@Injectable()
export class CommercialMessenger {
  private readonly logger = new Logger(CommercialMessenger.name);
  constructor(
    private readonly email: EmailService,
    private readonly whatsapp: WhatsappService,
    private readonly notifications: NotificationsService,
  ) {}

  async send(to: Recipient, subject: string, text: string, link?: string): Promise<{ email: boolean; whatsapp: boolean }> {
    const body = link ? `${text}\n\n${link}` : text;
    let email = false;
    let whatsapp = false;
    if (to.email) {
      try {
        const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0f172a"><h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>${text.split('\n').map((l) => `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`).join('')}${link ? `<p style="margin:16px 0"><a href="${escapeHtml(link)}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open</a></p><p style="font-size:12px;color:#64748b">${escapeHtml(link)}</p>` : ''}</div>`;
        await this.email.sendGeneric(to.email, subject, html);
        email = true;
      } catch (e) { this.logger.warn(`Email to ${to.email} failed: ${e instanceof Error ? e.message : 'error'}`); }
    }
    if (to.phone) {
      try { const r = await this.whatsapp.sendMessage(to.phone, `${subject} — ${body}`.replace(/\s+/g, ' ').slice(0, 900)); whatsapp = r.status !== 'failed'; }
      catch (e) { this.logger.warn(`WhatsApp to ${to.phone} failed: ${e instanceof Error ? e.message : 'error'}`); }
    }
    if (to.vendorId) {
      try { await this.notifications.notifyVendor(to.vendorId, 'billing', subject, text, { priority: 'INFO' }); } catch { /* best effort */ }
    }
    return { email, whatsapp };
  }

  async admin(subject: string, text: string, actionData?: Record<string, unknown>): Promise<void> {
    try { await this.notifications.notifyAdmin('commerce', subject, text, { priority: 'INFO', actionData: actionData as never }); } catch { /* best effort */ }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

// ── Payee settings ──────────────────────────────────────────────────────────────────────────────

export interface PayeeInput {
  upiId?: string | null; payeeName?: string | null; qrImageUrl?: string | null;
  bankName?: string | null; bankAccountName?: string | null; bankAccountNumber?: string | null; bankIfsc?: string | null; bankBranch?: string | null;
  instructions?: string | null;
}

@Injectable()
export class PayeeService {
  constructor(private readonly prisma: PrismaService, private readonly audit: CommercialAuditService) {}

  get() { return this.prisma.payeeSettings.findUnique({ where: { key: 'default' } }); }

  /** What payers will scan, for the admin to check: a ₹1.00 sample with the note PREVIEW. Generated by the server like the real one. */
  async preview(): Promise<{ configured: boolean; upiLink?: string; qrDataUrl?: string }> {
    const p = await this.get();
    if (!p?.upiId || !isValidVpa(p.upiId)) return { configured: false };
    const upiLink = buildUpiLink({ vpa: p.upiId, payeeName: p.payeeName ?? 'Get4Domain', amountPaise: 100, note: 'PREVIEW' });
    return { configured: true, upiLink, qrDataUrl: await upiQrDataUrl(upiLink) };
  }

  /** Public-safe view embedded in the pay page (only what a payer needs to send money). */
  async publicView() {
    const p = await this.get();
    if (!p) return null;
    return {
      upiId: p.upiId, payeeName: p.payeeName, qrImageUrl: p.qrImageUrl, instructions: p.instructions,
      bank: p.bankAccountNumber ? { bankName: p.bankName, accountName: p.bankAccountName, accountNumber: p.bankAccountNumber, ifsc: p.bankIfsc, branch: p.bankBranch } : null,
    };
  }

  async update(input: PayeeInput, actor: Actor) {
    const clean = (v: string | null | undefined, max: number) => (v == null || v.trim() === '' ? null : v.trim().slice(0, max));
    if (input.upiId && !isValidVpa(input.upiId)) throw new BadRequestException('That UPI ID does not look valid (expected name@bank)');
    if (input.bankIfsc && !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(input.bankIfsc.trim())) throw new BadRequestException('IFSC code looks invalid');
    if (input.qrImageUrl && !/^https?:\/\//i.test(input.qrImageUrl)) throw new BadRequestException('QR image must be an http(s) URL');
    const data = {
      upiId: clean(input.upiId, 256), payeeName: clean(input.payeeName, 80), qrImageUrl: clean(input.qrImageUrl, 500),
      bankName: clean(input.bankName, 80), bankAccountName: clean(input.bankAccountName, 80), bankAccountNumber: clean(input.bankAccountNumber, 30),
      bankIfsc: clean(input.bankIfsc, 11)?.toUpperCase() ?? null, bankBranch: clean(input.bankBranch, 80), instructions: clean(input.instructions, 1000),
      updatedBy: actor.email,
    };
    const row = await this.prisma.payeeSettings.upsert({ where: { key: 'default' }, create: { key: 'default', ...data }, update: data });
    await this.audit.log(actor, 'payee.update', 'PayeeSettings', row.id, { upiId: data.upiId, payeeName: data.payeeName, hasBank: Boolean(data.bankAccountNumber) });
    return row;
  }
}
