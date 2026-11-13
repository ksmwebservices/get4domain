import { Injectable, Logger, Optional } from '@nestjs/common';
import { ActivityBus } from '../common/activity-bus';
import { Actor } from '../plans/admin/audit.service';
import { EmailPort } from '../v3-mail/email.port';
import { checkMessageBody, checkNewTicket, isStatus, looksLikeEmail, oneLine, staffReplyNotice, statusAfterStaffReply, statusAfterVendorReply, TicketStatus, underCreateLimit } from './core/support-core';
import { SupportSettingsService } from './settings/support-settings';
import { MessageRow, SupportStore, TicketFilter, TicketRow } from './support.store';
import { supportError } from './support.errors';

const HOUR_MS = 3_600_000;
const ticketView = (t: TicketRow) => ({ id: t.id, subject: t.subject, category: t.category, status: t.status, requesterType: t.requesterType, createdAt: t.createdAt, lastMessageAt: t.lastMessageAt, resolvedAt: t.resolvedAt });
const staffTicketView = (t: TicketRow) => ({ ...ticketView(t), vendorId: t.vendorId, requesterName: t.requesterName, requesterEmail: t.requesterEmail, assignedToStaffId: t.assignedToStaffId });
const msgView = (m: MessageRow) => ({ id: m.id, author: m.authorType, body: m.body, attachmentPictureId: m.attachmentPictureId, createdAt: m.createdAt });
const notFound = () => supportError(404, 'TICKET_NOT_FOUND', 'That ticket was not found.');

/** Tells a business that staff replied. A port so a test records it and the product sends a lane 1 notice (flag-gated like every lane 1 send). Never throws into the reply. */
export abstract class TicketNotifier { abstract staffReplied(t: { requesterType: string; vendorId: string | null; requesterEmail: string | null; subject: string; replyBody: string }): Promise<void> }
@Injectable()
export class EmailTicketNotifier extends TicketNotifier {
  private readonly logger = new Logger(EmailTicketNotifier.name);
  constructor(private readonly email: EmailPort, private readonly store: SupportStore) { super(); }
  async staffReplied(t: { requesterType: string; vendorId: string | null; requesterEmail: string | null; subject: string; replyBody: string }): Promise<void> {
    try {
      const visitor = t.requesterType === 'CUSTOMER';
      const to = visitor ? t.requesterEmail : t.vendorId ? await this.store.vendorEmail(t.vendorId) : null;
      if (!to) return;
      // A business is pointed at the signed-in area; a visitor has no account, so the reply text itself goes in the message.
      const n = staffReplyNotice(t.subject);
      await this.email.send({ lane: 'SYSTEM', kind: 'ACCOUNT_NOTICE', to, subject: n.subject, text: !visitor ? n.text : `${t.replyBody}\n\nIf you need more help, send a new request from the same page.` });
    } catch (e) { this.logger.warn(`ticket notice not sent: ${(e as { response?: { code?: string } }).response?.code ?? 'error'}`); }
  }
}
export class FakeTicketNotifier extends TicketNotifier {
  calls: Array<{ requesterType: string; vendorId: string | null; requesterEmail: string | null; subject: string; replyBody: string }> = [];
  async staffReplied(t: { requesterType: string; vendorId: string | null; requesterEmail: string | null; subject: string; replyBody: string }): Promise<void> { this.calls.push(t); }
}

/**
 * Support tickets (Amendment 08 B5). A business opens, lists and answers its own tickets (every query names the business). Staff list every ticket, assign, reply and set the status (OPERATIONS and
 * SUPER_ADMIN; MARKETING refused). A visitor of a business's site may open a ticket through the public form (off until its limit is set). Messages are append-only. Attachments are pictures of the
 * business that went through the media library's own upload path and limits. Creation is rate limited per business (and per visitor address). No AI.
 */
@Injectable()
export class SupportService {
  clock: () => Date = () => new Date();
  constructor(private readonly store: SupportStore, private readonly settings: SupportSettingsService, private readonly notifier: TicketNotifier, @Optional() private readonly bus?: ActivityBus) {}

  // ── a business ──
  async create(vendorId: string, actor: Actor, i: { subject?: unknown; category?: unknown; body?: unknown; attachmentPictureId?: unknown }) {
    const s = await this.settings.get(); if (s.ticketCreatePerHour === null) throw supportError(503, 'TICKET_NOT_CONFIGURED', 'Support requests are not switched on yet.');
    const c = checkNewTicket(i); if (!c.ok) throw supportError(400, 'TICKET_INVALID', c.problems.join('; '));
    const attachment = await this.attachment(vendorId, i.attachmentPictureId);
    const now = this.clock();
    if (!underCreateLimit(await this.store.countCreatedSince({ vendorId }, new Date(now.getTime() - HOUR_MS)), s.ticketCreatePerHour)) throw supportError(429, 'TICKET_RATE_LIMITED', 'You have opened several requests already. Please wait before opening another.');
    const r = await this.store.createTicket({ vendorId, requesterType: 'VENDOR', requesterName: null, requesterEmail: null, subject: c.value.subject, category: c.value.category, body: c.value.body, attachmentPictureId: attachment }, now);
    return { ...ticketView(r.ticket), messages: [msgView(r.message)] };
  }
  async list(vendorId: string, page: number, pageSize: number) { const r = await this.store.listForVendor(vendorId, (page - 1) * pageSize, pageSize); return { items: r.items.map(ticketView), total: r.total }; }
  async get(vendorId: string, id: string) { const r = await this.store.getForVendor(vendorId, id); if (!r) throw notFound(); return { ...ticketView(r.ticket), messages: r.messages.map(msgView) }; }
  async reply(vendorId: string, actor: Actor, id: string, i: { body?: unknown; attachmentPictureId?: unknown }) {
    const body = checkMessageBody(i.body); if (!body) throw supportError(400, 'TICKET_INVALID', 'message must be 1 to 5000 characters');
    const attachment = await this.attachment(vendorId, i.attachmentPictureId);
    const r = await this.store.addMessage({ ticketId: id, vendorId }, { authorType: 'VENDOR', authorId: vendorId, body, attachmentPictureId: attachment }, (cur) => (isStatus(cur) ? statusAfterVendorReply(cur) : cur), this.clock());
    if (!r) throw notFound();
    return { ...ticketView(r.ticket), message: msgView(r.message) };
  }

  // ── a visitor ──
  async createPublic(i: { subdomain?: unknown; name?: unknown; email?: unknown; subject?: unknown; category?: unknown; body?: unknown }) {
    const s = await this.settings.get(); if (s.ticketPublicPerHour === null) throw supportError(503, 'TICKET_NOT_CONFIGURED', 'Support requests are not switched on yet.');
    const email = typeof i.email === 'string' ? i.email.trim().toLowerCase() : ''; if (!looksLikeEmail(email)) throw supportError(400, 'TICKET_INVALID', 'a valid email address is needed so we can answer');
    const name = i.name === undefined ? null : oneLine(i.name, 1, 100); if (i.name !== undefined && !name) throw supportError(400, 'TICKET_INVALID', 'name must be 1 to 100 characters');
    const c = checkNewTicket(i); if (!c.ok) throw supportError(400, 'TICKET_INVALID', c.problems.join('; '));
    const vendorId = typeof i.subdomain === 'string' && i.subdomain ? await this.store.vendorBySubdomain(i.subdomain.toLowerCase()) : null;
    const now = this.clock();
    if (!underCreateLimit(await this.store.countCreatedSince({ requesterEmail: email }, new Date(now.getTime() - HOUR_MS)), s.ticketPublicPerHour)) throw supportError(429, 'TICKET_RATE_LIMITED', 'Several requests were sent from this address already. Please wait before sending another.');
    const r = await this.store.createTicket({ vendorId, requesterType: 'CUSTOMER', requesterName: name, requesterEmail: email, subject: c.value.subject, category: c.value.category, body: c.value.body, attachmentPictureId: null }, now);
    this.emit('ticket.created', vendorId, r.ticket.id, { type: 'SYSTEM', id: null, ip: null }, { requester: 'CUSTOMER' });
    return { id: r.ticket.id, received: true };
  }

  // ── staff ──
  async adminList(f: TicketFilter, page: number, pageSize: number) { const r = await this.store.listAll(f, (page - 1) * pageSize, pageSize); return { items: r.items.map(staffTicketView), total: r.total }; }
  async adminGet(id: string) { const r = await this.store.getAny(id); if (!r) throw notFound(); return { ...staffTicketView(r.ticket), messages: r.messages.map(msgView) }; }
  async adminAssign(actor: Actor, id: string, staffId: string | null) {
    if (staffId !== null && (typeof staffId !== 'string' || staffId.length === 0 || staffId.length > 64)) throw supportError(400, 'TICKET_INVALID', 'staffId is not valid');
    const t = await this.store.assign(id, staffId, this.clock()); if (!t) throw notFound();
    return staffTicketView(t);
  }
  async adminSetStatus(actor: Actor, id: string, status: unknown, expected?: unknown) {
    if (!isStatus(status)) throw supportError(400, 'TICKET_INVALID', 'status is not valid');
    if (expected !== undefined && !isStatus(expected)) throw supportError(400, 'TICKET_INVALID', 'expectedStatus is not valid');
    const t = await this.store.setStatus(id, status, (expected as TicketStatus | undefined) ?? null, this.clock());
    if (!t) { if (await this.store.getAny(id)) throw supportError(409, 'TICKET_STATE_CHANGED', 'Someone changed this ticket just now. Reload it and try again.'); throw notFound(); }
    return staffTicketView(t);
  }
  async adminReply(actor: Actor, id: string, i: { body?: unknown }) {
    const body = checkMessageBody(i.body); if (!body) throw supportError(400, 'TICKET_INVALID', 'message must be 1 to 5000 characters');
    const r = await this.store.addMessage({ ticketId: id }, { authorType: 'STAFF', authorId: actor.id, body, attachmentPictureId: null }, (cur) => (isStatus(cur) ? statusAfterStaffReply(cur) : cur), this.clock());
    if (!r) throw notFound();
    await this.notifier.staffReplied({ requesterType: r.ticket.requesterType, vendorId: r.ticket.vendorId, requesterEmail: r.ticket.requesterEmail, subject: r.ticket.subject, replyBody: body });
    return { ...staffTicketView(r.ticket), message: msgView(r.message) };
  }

  /** An attachment must be a picture of this business, uploaded through the media library (so the upload limits already applied). */
  private async attachment(vendorId: string, v: unknown): Promise<string | null> {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v !== 'string' || v.length > 64 || !(await this.store.pictureExists(vendorId, v))) throw supportError(400, 'TICKET_ATTACHMENT_INVALID', 'Attach a picture from your own media library.');
    return v;
  }
  /** Only the PUBLIC form is written through the bus: every signed-in route under /v3/me and /v3/admin is already logged by the activity interceptor, and a second row would double it. */
  private emit(type: string, vendorId: string | null, ticketId: string, actor: Actor, data: Record<string, unknown>): void { void this.bus?.emit({ type, vendorId: vendorId ?? '', at: this.clock(), actor: { type: actor.type, id: actor.id }, data: { ticketId, ...data } }); }
}
