/** Pure rules of support tickets (Amendment 08 B5). No clock, no database, no environment. */
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_VENDOR', 'RESOLVED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_CATEGORIES = ['GENERAL', 'BILLING', 'SITE', 'DOMAIN', 'ORDER', 'OTHER'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type AuthorType = 'VENDOR' | 'STAFF' | 'CUSTOMER';
export type RequesterType = 'VENDOR' | 'CUSTOMER';

export const isStatus = (v: unknown): v is TicketStatus => (TICKET_STATUSES as readonly string[]).includes(v as string);
export const isCategory = (v: unknown): v is TicketCategory => (TICKET_CATEGORIES as readonly string[]).includes(v as string);

const clean = (v: unknown, min: number, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
  return t.length >= min && t.length <= max ? t : null;
};
export const oneLine = (v: unknown, min: number, max: number): string | null => clean(typeof v === 'string' ? v.replace(/\n+/g, ' ') : v, min, max);

export interface TicketInput { subject?: unknown; category?: unknown; body?: unknown }
export type Checked<T> = { ok: true; value: T } | { ok: false; problems: string[] };

export function checkNewTicket(i: TicketInput): Checked<{ subject: string; category: TicketCategory; body: string }> {
  const problems: string[] = [];
  const subject = oneLine(i.subject, 3, 120); if (!subject) problems.push('subject must be 3 to 120 characters');
  const category = i.category === undefined ? 'GENERAL' : i.category; if (!isCategory(category)) problems.push(`category must be one of ${TICKET_CATEGORIES.join(', ')}`);
  const body = clean(i.body, 1, 5000); if (!body) problems.push('message must be 1 to 5000 characters');
  return problems.length ? { ok: false, problems } : { ok: true, value: { subject: subject!, category: category as TicketCategory, body: body! } };
}
export const checkMessageBody = (v: unknown): string | null => clean(v, 1, 5000);

/** A vendor writing back wakes a ticket that was waiting on them or already closed. */
export const statusAfterVendorReply = (s: TicketStatus): TicketStatus => (s === 'WAITING_VENDOR' || s === 'RESOLVED' ? 'OPEN' : s);
/** Staff answering a ticket that is open or being worked now waits for the requester. A resolved ticket stays resolved until the requester writes back. */
export const statusAfterStaffReply = (s: TicketStatus): TicketStatus => (s === 'OPEN' || s === 'IN_PROGRESS' ? 'WAITING_VENDOR' : s);
export const underCreateLimit = (createdInWindow: number, limit: number): boolean => createdInWindow < limit;
/** What a business is told when staff reply: a pointer, never the reply text (it stays in the signed-in area). */
export const staffReplyNotice = (subject: string): { subject: string; text: string } => ({ subject: `Re: ${subject}`.slice(0, 200), text: 'Our team replied to your support request. Please sign in to read the reply and answer.' });
export const looksLikeEmail = (v: unknown): v is string => typeof v === 'string' && v.length <= 254 && /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(v);
