import { BadRequestException } from '@nestjs/common';
import { EventType } from './leadspace.types';

/** Version of the words shown next to the "Send me a code" button. Stored with every consent record. */
export const CONSENT_TEXT_VERSION = 'ls-consent-v1';
export const CONSENT_TEXT =
  'I agree that this business, and Get4Domain on its behalf, may contact me on this number about my request, and that my name, number and request are shared with this business. I can ask for them to be deleted at any time.';

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
/** Plain text only: control characters out, angle brackets out (nothing here is ever rendered as HTML), trimmed and capped. */
export const clean = (v: unknown, max: number): string => String(v ?? '').replace(CONTROL, '').replace(/[<>]/g, '').trim().slice(0, max);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function dateField(v: unknown, label: string): string {
  const s = clean(v, 10);
  if (!ISO_DATE.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) throw new BadRequestException(`Choose a valid ${label}.`);
  const day = Date.parse(`${s}T00:00:00Z`);
  const today = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  if (day < today) throw new BadRequestException(`The ${label} cannot be in the past. Choose today or a later day.`);
  if (day - today > 180 * 86_400_000) throw new BadRequestException(`Choose a ${label} within the next 6 months.`);
  return s;
}

export interface CartItem { name: string; qty: number; pricePaise?: number }

/**
 * Goal flows. Each event type has the fields the customer fills in; anything else is dropped.
 * Enquiry: name, phone, message. Booking and appointment: date, time slot, service. Site visit: date, property or project.
 * Cart order: items, quantity, delivery details, notes. No payment is taken on a LeadSpace page.
 */
export function validatePayload(type: EventType, raw: unknown): Record<string, unknown> {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const notes = clean(p.notes, 500);
  const need = (v: string, sentence: string): string => { if (!v) throw new BadRequestException(sentence); return v; };
  switch (type) {
    case 'ENQUIRY':
      return { message: need(clean(p.message, 1000), 'Write a short message so the business knows what you need.'), ...(notes ? { notes } : {}) };
    case 'BOOKING':
    case 'APPOINTMENT':
      return {
        date: dateField(p.date, 'date'),
        time: need(clean(p.time, 40), 'Choose a time slot.'),
        service: need(clean(p.service, 120), 'Choose the service you want.'),
        ...(clean(p.message, 500) ? { message: clean(p.message, 500) } : {}),
        ...(notes ? { notes } : {}),
      };
    case 'SITE_VISIT':
      return {
        date: dateField(p.date, 'visit date'),
        property: need(clean(p.property, 160), 'Tell us which property or project you want to see.'),
        ...(clean(p.time, 40) ? { time: clean(p.time, 40) } : {}),
        ...(notes ? { notes } : {}),
      };
    case 'CART_ORDER': {
      const itemsIn = Array.isArray(p.items) ? p.items : [];
      if (itemsIn.length < 1 || itemsIn.length > 30) throw new BadRequestException('Add between 1 and 30 items to your order.');
      const items: CartItem[] = itemsIn.map((i) => {
        const o = (i && typeof i === 'object' ? i : {}) as Record<string, unknown>;
        const name = need(clean(o.name, 120), 'Every item needs a name.');
        const qty = Math.floor(Number(o.qty));
        if (!Number.isFinite(qty) || qty < 1 || qty > 99) throw new BadRequestException('Choose a quantity between 1 and 99 for every item.');
        const price = Math.floor(Number(o.pricePaise));
        return { name, qty, ...(Number.isFinite(price) && price >= 0 && price <= 100_000_000 ? { pricePaise: price } : {}) };
      });
      const address = need(clean(p.address, 400), 'Enter the delivery address so the business can reach you.');
      if (address.length < 10) throw new BadRequestException('Enter the full delivery address: house or shop number, street and area.');
      return { items, address, ...(notes ? { notes } : {}) };
    }
    default:
      throw new BadRequestException('This kind of request is not supported.');
  }
}

/** The one-line summary shown in alerts and lists. */
export function summarise(type: EventType, payload: Record<string, unknown>): string {
  switch (type) {
    case 'ENQUIRY': return clean(payload.message, 80);
    case 'BOOKING':
    case 'APPOINTMENT': return `${clean(payload.service, 40)} on ${clean(payload.date, 10)} ${clean(payload.time, 20)}`.trim();
    case 'SITE_VISIT': return `${clean(payload.property, 50)} on ${clean(payload.date, 10)}`;
    case 'CART_ORDER': {
      const items = (payload.items as CartItem[] | undefined) ?? [];
      return items.slice(0, 3).map((i) => `${i.qty} x ${i.name}`).join(', ') + (items.length > 3 ? ` and ${items.length - 3} more` : '');
    }
  }
}
