import { createHmac } from 'crypto';

/** Pure rules of messaging in slice 5.14: who gets which message by which route, and how a template becomes text. Sandbox only in this batch; nothing here sends anything. */

export type Channel = 'WHATSAPP' | 'SMS' | 'EMAIL';
export type SenderRoute = 'GET4DOMAIN_WHATSAPP_NUMBER' | 'REGISTERED_SMS_SENDER' | 'GET4DOMAIN_EMAIL_WITH_BUSINESS_NAME_REPLY_TO' | 'DASHBOARD';
const ROUTE: Record<Channel, SenderRoute> = { WHATSAPP: 'GET4DOMAIN_WHATSAPP_NUMBER', SMS: 'REGISTERED_SMS_SENDER', EMAIL: 'GET4DOMAIN_EMAIL_WITH_BUSINESS_NAME_REPLY_TO' };
export const FALLBACK_ORDER: readonly Channel[] = ['WHATSAPP', 'SMS', 'EMAIL'];

export interface Recipient { phone?: string | null; email?: string | null }
export interface Suppressed { WHATSAPP: boolean; SMS: boolean; EMAIL: boolean }

/**
 * The attempts for one message, in order: WhatsApp, then SMS (both need a phone), then email (needs an address). A channel the recipient said STOP on is skipped. When no channel is
 * left the only route is the dashboard (the vendor sees it there). The sender is Get4Domain's own number, the registered SMS sender, or Get4Domain's email carrying the business name and
 * a reply-to; the sender is NEVER the vendor's personal number.
 */
export function chooseRoutes(to: Recipient, suppressed: Suppressed): Array<{ channel: Channel | 'DASHBOARD'; senderRoute: SenderRoute }> {
  const out: Array<{ channel: Channel | 'DASHBOARD'; senderRoute: SenderRoute }> = [];
  for (const c of FALLBACK_ORDER) {
    const can = c === 'EMAIL' ? !!to.email : !!to.phone;
    if (can && !suppressed[c]) out.push({ channel: c, senderRoute: ROUTE[c] });
  }
  if (!out.length) out.push({ channel: 'DASHBOARD', senderRoute: 'DASHBOARD' });
  return out;
}

/** A keyed hash of the address (so a STOP can be matched without storing the address) and a masked form for staff. */
export function addressHash(channel: Channel, address: string, pepper: string): string { return createHmac('sha256', pepper).update(`msg:${channel}:${address.trim().toLowerCase()}`).digest('hex'); }
export function maskAddress(channel: Channel, address: string): string {
  if (channel === 'EMAIL') { const [u, d] = address.split('@'); return `${(u ?? '').slice(0, 1)}•••@${d ?? ''}`; }
  const s = address.replace(/\s/g, ''); return s.length <= 5 ? '•••' : `${s.slice(0, 3)}${'•'.repeat(Math.max(3, s.length - 6))}${s.slice(-3)}`;
}

export interface TemplateVars { customerName?: string; businessName: string; reference?: string; trackingUrl?: string; orderNo?: string; amount?: string; status?: string }
const clean = (v: string | undefined): string => String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[<>]/g, '').slice(0, 120);

/**
 * Fills {{variables}} from a fixed list (an unknown variable is left empty; an empty one is never shown as the raw braces). EVERY message names the business: if the text does not already
 * contain the business name it is put in front. Customer messages carry the bridge line (what Get4Domain does and does not do) when `bridgeLine` is given.
 */
export function renderMessage(template: string, v: TemplateVars, bridgeLine?: string): string {
  let text = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, name: string) => clean((v as unknown as Record<string, string | undefined>)[name]));
  text = text.replace(/\s{2,}/g, ' ').trim();
  if (v.businessName && !text.toLowerCase().includes(v.businessName.toLowerCase())) text = `${clean(v.businessName)}: ${text}`;
  if (bridgeLine && bridgeLine.trim()) text = `${text} ${bridgeLine.trim()}`;
  return text;
}
