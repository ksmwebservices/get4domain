export interface TicketRow {
  id: string; vendorId: string | null; requesterType: string; requesterName: string | null; requesterEmail: string | null; subject: string; category: string; status: string;
  assignedToStaffId: string | null; resolvedAt: Date | null; createdAt: Date; updatedAt: Date; lastMessageAt: Date;
}
export interface MessageRow { id: string; ticketId: string; authorType: string; authorId: string | null; body: string; attachmentPictureId: string | null; createdAt: Date }
export interface NewTicket { vendorId: string | null; requesterType: string; requesterName: string | null; requesterEmail: string | null; subject: string; category: string; body: string; attachmentPictureId: string | null }
export interface TicketFilter { status?: string; vendorId?: string; assignedToStaffId?: string; requesterType?: string }

/** Every vendor-side query names the vendor. The staff queries take no vendor on purpose (staff see every ticket) and are reached only through the staff routes. */
export abstract class SupportStore {
  abstract createTicket(d: NewTicket, at: Date): Promise<{ ticket: TicketRow; message: MessageRow }>;
  abstract countCreatedSince(by: { vendorId?: string; requesterEmail?: string }, since: Date): Promise<number>;
  abstract listForVendor(vendorId: string, skip: number, take: number): Promise<{ items: TicketRow[]; total: number }>;
  abstract getForVendor(vendorId: string, id: string): Promise<{ ticket: TicketRow; messages: MessageRow[] } | null>;
  abstract listAll(f: TicketFilter, skip: number, take: number): Promise<{ items: TicketRow[]; total: number }>;
  abstract getAny(id: string): Promise<{ ticket: TicketRow; messages: MessageRow[] } | null>;
  /** Appends the message and moves the status in ONE transaction. Returns null when the ticket does not exist or is not the caller's (when `vendorId` is given). */
  abstract addMessage(scope: { ticketId: string; vendorId?: string }, m: { authorType: string; authorId: string | null; body: string; attachmentPictureId: string | null }, nextStatus: (current: string) => string, at: Date): Promise<{ ticket: TicketRow; message: MessageRow } | null>;
  /** Sets the status. When `expected` is given the change happens only if the ticket still has that status (compare-and-set); returns null otherwise. */
  abstract setStatus(id: string, status: string, expected: string | null, at: Date): Promise<TicketRow | null>;
  abstract assign(id: string, staffId: string | null, at: Date): Promise<TicketRow | null>;
  abstract vendorEmail(vendorId: string): Promise<string | null>;
  abstract pictureExists(vendorId: string, pictureId: string): Promise<boolean>;
  abstract vendorBySubdomain(subdomain: string): Promise<string | null>;
}
