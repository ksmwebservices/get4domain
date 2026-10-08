import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SpecialArrangement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Actor, CommercialAuditService, CommercialMessenger } from './foundation.services';
import {
  ArrangementInput, ChannelT, SpecToCheck, arrangementViolations, expiryAction, isArrangementActive, pickActive, validateArrangementInput,
} from './arrangement-rules';

export type ArrangementFilter = 'all' | 'active' | 'expiring' | 'expired';

export interface ArrangementRow extends SpecialArrangement {
  vendor: { id: string; businessName: string; subdomain: string | null } | null;
  plan: { planKey: string; cycleMonths: number; gstMode: string } | null;
  state: 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'ENDED';
}

export interface ArrangementSummary { active: boolean; allowHalfYear: boolean; gstMode: string; allowedChannels: string[]; validUntil: Date | null; reason: string | null }

const DAY = 86_400_000;

function stateOf(a: SpecialArrangement, now: Date): ArrangementRow['state'] {
  if (!a.active || a.endedAt) return 'ENDED';
  if (a.validUntil.getTime() <= now.getTime()) return 'EXPIRED';
  return a.validUntil.getTime() - now.getTime() <= 30 * DAY ? 'EXPIRING' : 'ACTIVE';
}

function toBadRequest<T>(fn: () => T): T {
  try { return fn(); } catch (e) { if (e instanceof RangeError) throw new BadRequestException(e.message); throw e; }
}

/**
 * Admin-controlled exceptions to the standard commercial rule (annual, Razorpay only, GST 18% on top). Everything KSM changes here is written
 * to the arrangement's own history AND to the commercial audit log. Nothing in this class touches an invoice, a term or any vendor data.
 */
@Injectable()
export class ArrangementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: CommercialAuditService,
    private readonly messenger: CommercialMessenger,
  ) {}

  /** The arrangement that applies to this vendor right now, or null. `db` lets a caller read inside its own transaction. */
  async activeFor(vendorId: string | null | undefined, now = new Date(), db: Pick<PrismaService, 'specialArrangement'> | Prisma.TransactionClient = this.prisma): Promise<SpecialArrangement | null> {
    if (!vendorId) return null;
    const rows = await db.specialArrangement.findMany({ where: { vendorId, active: true } });
    return pickActive(rows, now);
  }

  /** Server-side enforcement used by the deal builder and plan changes: throws a clear 400 when the spec needs an arrangement the vendor does not have. */
  async assertAllowed(spec: SpecToCheck, vendorId: string | null | undefined, now = new Date()): Promise<void> {
    const problems = arrangementViolations(spec, await this.activeFor(vendorId, now), now);
    if (problems.length) throw new BadRequestException(problems.join(' '));
  }

  summary(a: SpecialArrangement | null): ArrangementSummary | null {
    return a ? { active: true, allowHalfYear: a.allowHalfYear, gstMode: a.gstMode, allowedChannels: a.allowedChannels, validUntil: a.validUntil, reason: a.reason } : null;
  }

  // ── Admin page ──────────────────────────────────────────────────────────────────────────────────────

  async list(filter: ArrangementFilter = 'all', now = new Date()): Promise<ArrangementRow[]> {
    const rows = await this.prisma.specialArrangement.findMany({ orderBy: { validUntil: 'asc' }, take: 500 });
    const out: ArrangementRow[] = [];
    for (const a of rows) {
      const state = stateOf(a, now);
      if (filter === 'active' && !(state === 'ACTIVE' || state === 'EXPIRING')) continue;
      if (filter === 'expiring' && state !== 'EXPIRING') continue;
      if (filter === 'expired' && state !== 'EXPIRED') continue;
      const [vendor, term] = await Promise.all([
        this.prisma.vendor.findUnique({ where: { id: a.vendorId }, select: { id: true, businessName: true, subdomain: true } }),
        this.prisma.billingTerm.findFirst({ where: { vendorId: a.vendorId, isCurrent: true }, select: { planKey: true, cycleMonths: true, gstMode: true } }),
      ]);
      out.push({ ...a, vendor, plan: term, state });
    }
    return out;
  }

  async forVendor(vendorId: string, now = new Date()): Promise<{ active: ArrangementSummary | null; all: SpecialArrangement[] }> {
    const all = await this.prisma.specialArrangement.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
    return { active: this.summary(pickActive(all, now)), all };
  }

  async create(input: ArrangementInput & { vendorId: string }, actor: Actor, now = new Date()): Promise<SpecialArrangement> {
    const clean = toBadRequest(() => validateArrangementInput(input, now));
    const vendor = await this.prisma.vendor.findUnique({ where: { id: input.vendorId }, select: { id: true } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    const existing = await this.activeFor(input.vendorId, now);
    if (existing) throw new ConflictException('This client already has an active arrangement. Edit or end it instead of creating a second one.');
    const entry = { at: now.toISOString(), by: actor.email || actor.id, action: 'created', ...this.snapshot(clean) };
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.specialArrangement.create({
        data: { vendorId: input.vendorId, allowHalfYear: clean.allowHalfYear, gstMode: clean.gstMode, allowedChannels: clean.allowedChannels, validUntil: clean.validUntil, reason: clean.reason, createdBy: actor.email || actor.id, history: [entry] as Prisma.InputJsonValue },
      });
      await this.audit.log(actor, 'arrangement.created', 'SpecialArrangement', created.id, { vendorId: input.vendorId, ...this.snapshot(clean) }, tx);
      await this.audit.log(actor, 'arrangement.created', 'Vendor', input.vendorId, { arrangementId: created.id, reason: clean.reason }, tx);
      return created;
    });
    return row;
  }

  async update(id: string, input: ArrangementInput, actor: Actor, now = new Date()): Promise<SpecialArrangement> {
    const cur = await this.prisma.specialArrangement.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('Arrangement not found');
    if (!cur.active || cur.endedAt) throw new ConflictException('This arrangement has ended. Create a new one instead.');
    const clean = toBadRequest(() => validateArrangementInput({
      allowHalfYear: input.allowHalfYear ?? cur.allowHalfYear, gstMode: input.gstMode ?? cur.gstMode, allowedChannels: input.allowedChannels ?? (cur.allowedChannels as ChannelT[]),
      validUntil: input.validUntil ?? cur.validUntil, reason: input.reason,
    }, now));
    const entry = { at: now.toISOString(), by: actor.email || actor.id, action: 'edited', ...this.snapshot(clean) };
    const endChanged = clean.validUntil.getTime() !== cur.validUntil.getTime();
    return this.prisma.$transaction(async (tx) => {
      const history = [...(Array.isArray(cur.history) ? (cur.history as unknown[]) : []), entry];
      const updated = await tx.specialArrangement.update({
        where: { id },
        data: {
          allowHalfYear: clean.allowHalfYear, gstMode: clean.gstMode, allowedChannels: clean.allowedChannels, validUntil: clean.validUntil, reason: clean.reason,
          history: history as Prisma.InputJsonValue,
          ...(endChanged ? { expiryWarnedAt: null, expiredNotifiedAt: null } : {}), // a moved end date earns its own notices
        },
      });
      await this.audit.log(actor, 'arrangement.edited', 'SpecialArrangement', id, { vendorId: cur.vendorId, before: this.snapshot(cur), after: this.snapshot(clean) }, tx);
      await this.audit.log(actor, 'arrangement.edited', 'Vendor', cur.vendorId, { arrangementId: id, reason: clean.reason }, tx);
      return updated;
    });
  }

  async end(id: string, reason: string, actor: Actor, now = new Date()): Promise<SpecialArrangement> {
    if ((reason ?? '').trim().length < 10) throw new BadRequestException('A reason of at least 10 characters is required to end an arrangement.');
    const cur = await this.prisma.specialArrangement.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('Arrangement not found');
    if (!cur.active || cur.endedAt) throw new ConflictException('This arrangement has already ended.');
    const entry = { at: now.toISOString(), by: actor.email || actor.id, action: 'ended', reason: reason.trim() };
    return this.prisma.$transaction(async (tx) => {
      const history = [...(Array.isArray(cur.history) ? (cur.history as unknown[]) : []), entry];
      const ended = await tx.specialArrangement.update({ where: { id }, data: { active: false, endedAt: now, endedBy: actor.email || actor.id, endReason: reason.trim(), history: history as Prisma.InputJsonValue } });
      await this.audit.log(actor, 'arrangement.ended', 'SpecialArrangement', id, { vendorId: cur.vendorId, reason: reason.trim() }, tx);
      await this.audit.log(actor, 'arrangement.ended', 'Vendor', cur.vendorId, { arrangementId: id, reason: reason.trim() }, tx);
      return ended;
    });
  }

  async history(id: string): Promise<{ history: unknown[]; audit: unknown[] }> {
    const row = await this.prisma.specialArrangement.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Arrangement not found');
    const audit = await this.prisma.commercialAuditLog.findMany({ where: { entityType: 'SpecialArrangement', entityId: id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return { history: Array.isArray(row.history) ? (row.history as unknown[]) : [], audit };
  }

  private snapshot(a: { allowHalfYear: boolean; gstMode: string; allowedChannels: string[]; validUntil: Date; reason: string }) {
    return { allowHalfYear: a.allowHalfYear, gstMode: a.gstMode, allowedChannels: [...a.allowedChannels], validUntil: a.validUntil.toISOString(), reason: a.reason };
  }

  // ── "GST not collected" report for the CA ──────────────────────────────────────────────────────────

  /** Per month and per client: the GST that special-arrangement invoices did NOT carry. Void/cancelled invoices are left out. */
  async gstReport(range: { from?: string; to?: string } = {}): Promise<{ rows: { month: string; vendorId: string; businessName: string; invoices: number; gstForgonePaise: number; paidGstForgonePaise: number }[]; totalPaise: number; paidTotalPaise: number }> {
    const where: Prisma.InvoiceWhereInput = { gstForgonePaise: { gt: 0 }, status: { notIn: ['VOID', 'CANCELLED'] } };
    if (range.from || range.to) where.createdAt = { ...(range.from ? { gte: new Date(range.from) } : {}), ...(range.to ? { lte: new Date(range.to) } : {}) };
    const invoices = await this.prisma.invoice.findMany({ where, select: { vendorId: true, createdAt: true, gstForgonePaise: true, status: true } });
    const vendors = new Map<string, string>();
    const buckets = new Map<string, { month: string; vendorId: string; invoices: number; gstForgonePaise: number; paidGstForgonePaise: number }>();
    for (const inv of invoices) {
      const month = inv.createdAt.toISOString().slice(0, 7);
      const key = `${month}|${inv.vendorId}`;
      const b = buckets.get(key) ?? { month, vendorId: inv.vendorId, invoices: 0, gstForgonePaise: 0, paidGstForgonePaise: 0 };
      b.invoices += 1;
      b.gstForgonePaise += inv.gstForgonePaise ?? 0;
      if (inv.status === 'PAID') b.paidGstForgonePaise += inv.gstForgonePaise ?? 0;
      buckets.set(key, b);
    }
    for (const b of buckets.values()) {
      if (!vendors.has(b.vendorId)) vendors.set(b.vendorId, (await this.prisma.vendor.findUnique({ where: { id: b.vendorId }, select: { businessName: true } }))?.businessName ?? b.vendorId);
    }
    const rows = [...buckets.values()].map((b) => ({ ...b, businessName: vendors.get(b.vendorId) ?? b.vendorId })).sort((a, b) => a.month.localeCompare(b.month) || a.businessName.localeCompare(b.businessName));
    return { rows, totalPaise: rows.reduce((s, r) => s + r.gstForgonePaise, 0), paidTotalPaise: rows.reduce((s, r) => s + r.paidGstForgonePaise, 0) };
  }

  // ── Daily notices (called from the 06:00 IST job) ───────────────────────────────────────────────────

  /**
   * 15 days before an arrangement ends, and once when it has ended, KSM gets an in-app admin notification. Idempotent: each notice is
   * claimed with a conditional update before it is sent, so a re-run, a second server or a manual run never repeats it.
   */
  async runNotices(now = new Date()): Promise<{ warned: number; expired: number }> {
    const rows = await this.prisma.specialArrangement.findMany({ where: { active: true } });
    let warned = 0;
    let expired = 0;
    for (const a of rows) {
      const action = expiryAction(a, now);
      if (action === 'NONE') continue;
      const vendor = await this.prisma.vendor.findUnique({ where: { id: a.vendorId }, select: { businessName: true } });
      const name = vendor?.businessName ?? a.vendorId;
      const when = a.validUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
      if (action === 'WARN') {
        const claim = await this.prisma.specialArrangement.updateMany({ where: { id: a.id, expiryWarnedAt: null }, data: { expiryWarnedAt: now } });
        if (claim.count === 0) continue;
        await this.messenger.admin('Special arrangement ending soon', `${name}'s special arrangement ends on ${when}. After that their next invoice reverts to annual, Razorpay, GST on top. Renew it on the Special arrangements page if you want it to continue.`, { arrangementId: a.id, vendorId: a.vendorId });
        warned += 1;
      } else {
        const claim = await this.prisma.specialArrangement.updateMany({ where: { id: a.id, expiredNotifiedAt: null }, data: { expiredNotifiedAt: now } });
        if (claim.count === 0) continue;
        await this.messenger.admin('Special arrangement ended', `${name}'s special arrangement ended on ${when}. Their next invoice will be annual, Razorpay only, GST 18% on top.`, { arrangementId: a.id, vendorId: a.vendorId });
        await this.audit.log('system', 'arrangement.expired', 'SpecialArrangement', a.id, { vendorId: a.vendorId, validUntil: a.validUntil.toISOString() });
        expired += 1;
      }
    }
    return { warned, expired };
  }

  /** Used by tests and the admin page: is this row in force right now? */
  inForce(a: SpecialArrangement, now = new Date()): boolean { return isArrangementActive(a, now); }
}
