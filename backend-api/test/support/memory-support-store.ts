import { MessageRow, NewTicket, SupportStore, TicketFilter, TicketRow } from '../../src/v3-support/support.store';

export class MemorySupportStore extends SupportStore {
  tickets: TicketRow[] = []; messages: MessageRow[] = []; emails = new Map<string, string>(); pictures = new Set<string>(); subdomains = new Map<string, string>();
  private n = 0;
  async createTicket(d: NewTicket, at: Date) {
    const ticket: TicketRow = { id: `t${++this.n}`, vendorId: d.vendorId, requesterType: d.requesterType, requesterName: d.requesterName, requesterEmail: d.requesterEmail, subject: d.subject, category: d.category, status: 'OPEN', assignedToStaffId: null, resolvedAt: null, createdAt: at, updatedAt: at, lastMessageAt: at };
    const message: MessageRow = { id: `m${++this.n}`, ticketId: ticket.id, authorType: d.requesterType, authorId: d.vendorId, body: d.body, attachmentPictureId: d.attachmentPictureId, createdAt: at };
    this.tickets.push(ticket); this.messages.push(message); return { ticket, message };
  }
  async countCreatedSince(by: { vendorId?: string; requesterEmail?: string }, since: Date) { return this.tickets.filter((t) => t.createdAt >= since && (!by.vendorId || t.vendorId === by.vendorId) && (!by.requesterEmail || t.requesterEmail === by.requesterEmail)).length; }
  async listForVendor(vendorId: string, skip: number, take: number) { const all = this.tickets.filter((t) => t.vendorId === vendorId && t.requesterType === 'VENDOR').sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()); return { items: all.slice(skip, skip + take), total: all.length }; }
  async getForVendor(vendorId: string, id: string) { const t = this.tickets.find((x) => x.id === id && x.vendorId === vendorId && x.requesterType === 'VENDOR'); return t ? { ticket: t, messages: this.messages.filter((m) => m.ticketId === id) } : null; }
  async listAll(f: TicketFilter, skip: number, take: number) {
    const all = this.tickets.filter((t) => (!f.status || t.status === f.status) && (!f.vendorId || t.vendorId === f.vendorId) && (!f.assignedToStaffId || t.assignedToStaffId === f.assignedToStaffId) && (!f.requesterType || t.requesterType === f.requesterType));
    return { items: all.slice(skip, skip + take), total: all.length };
  }
  async getAny(id: string) { const t = this.tickets.find((x) => x.id === id); return t ? { ticket: t, messages: this.messages.filter((m) => m.ticketId === id) } : null; }
  async addMessage(scope: { ticketId: string; vendorId?: string }, m: { authorType: string; authorId: string | null; body: string; attachmentPictureId: string | null }, next: (c: string) => string, at: Date) {
    const t = this.tickets.find((x) => x.id === scope.ticketId && (!scope.vendorId || (x.vendorId === scope.vendorId && x.requesterType === 'VENDOR'))); if (!t) return null;
    const message: MessageRow = { id: `m${++this.n}`, ticketId: t.id, ...m, createdAt: at }; this.messages.push(message);
    t.status = next(t.status); t.lastMessageAt = at; t.resolvedAt = t.status === 'RESOLVED' ? (t.resolvedAt ?? at) : null; return { ticket: t, message };
  }
  async setStatus(id: string, status: string, expected: string | null, at: Date) { const t = this.tickets.find((x) => x.id === id); if (!t || (expected && t.status !== expected)) return null; t.status = status; t.resolvedAt = status === 'RESOLVED' ? at : null; return t; }
  async assign(id: string, staffId: string | null) { const t = this.tickets.find((x) => x.id === id); if (!t) return null; t.assignedToStaffId = staffId; return t; }
  async vendorEmail(vendorId: string) { return this.emails.get(vendorId) ?? null; }
  async pictureExists(vendorId: string, pictureId: string) { return this.pictures.has(`${vendorId}:${pictureId}`); }
  async vendorBySubdomain(sub: string) { return this.subdomains.get(sub) ?? null; }
}
