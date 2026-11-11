import { checkWording } from './wording-core';

/**
 * Testimonials (slice B4, amendment 08), pure. A Pro-only page section of words the business owner chose to show: a first name or initials, text of up to 300 characters, an optional date, and a
 * required confirmation by the vendor that the customer agreed to the words being shown. They are labelled on the site as words shared by the business owner. There is NO star rating, NO aggregate
 * rating and NO review markup, ever: an item has exactly these four fields and any other key (rating, stars, score, url ...) is refused, not dropped. The wording check (promises, a price, a retired
 * product name) applies. The count cap is a staff setting with no default: until staff set it, nothing can be saved.
 */
export const TESTIMONIAL_LABEL = 'Words shared by the business owner';
export const TESTIMONIAL_TEXT_MAX = 300;
export const TESTIMONIAL_NAME_MAX = 40;

export interface Testimonial { name: string; text: string; date?: string; consent: true }
export type TestimonialFail = { ok: false; code: string; message: string; field: string };
const fail = (code: string, message: string, field: string): TestimonialFail => ({ ok: false, code, message, field });

const KEYS = ['name', 'text', 'date', 'consent'];
const TOKEN = "[\\p{L}][\\p{L}\\p{M}.'-]*";
const NAME = new RegExp(`^${TOKEN}(?: ${TOKEN})?$`, 'u');
const CONTROL = /[\u0000-\u001F\u007F]/;

function realDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]); const mo = Number(m[2]); const d = m[3] === undefined ? 1 : Number(m[3]);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= days;
}

export function validateTestimonials(input: unknown, o: { maxCount: number | null }): { ok: true; items: Testimonial[] } | TestimonialFail {
  if (!Array.isArray(input)) return fail('FIELD_INVALID', 'Send the testimonials as a list.', 'testimonials');
  if (input.length === 0) return { ok: true, items: [] };   // clearing is always allowed
  if (o.maxCount === null) return fail('TESTIMONIALS_NOT_CONFIGURED', 'Testimonials are not switched on yet.', 'testimonials');
  if (input.length > o.maxCount) return fail('LIMIT_REACHED', `You can show up to ${o.maxCount} testimonials.`, 'testimonials');
  const out: Testimonial[] = [];
  for (const [i, raw] of input.entries()) {
    const w = `testimonials[${i}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('FIELD_INVALID', 'Each testimonial must be an object.', w);
    const t = raw as Record<string, unknown>;
    for (const k of Object.keys(t)) if (!KEYS.includes(k)) return fail('FIELD_LOCKED', 'A testimonial has a name, the words, an optional date and your confirmation. Ratings and links are not allowed.', `${w}.${k}`);
    const name = typeof t.name === 'string' ? t.name.trim() : '';
    if (!name || name.length > TESTIMONIAL_NAME_MAX || !NAME.test(name)) return fail('NAME_NOT_ALLOWED', 'Use a first name or initials only.', `${w}.name`);
    if (t.consent !== true) return fail('CONSENT_REQUIRED', 'Confirm that the customer agreed to these words being shown.', `${w}.consent`);
    const text = typeof t.text === 'string' ? t.text.trim() : '';
    if (!text || text.length > TESTIMONIAL_TEXT_MAX || /[<>]/.test(text) || CONTROL.test(text)) return fail('FIELD_INVALID', `The words are 1 to ${TESTIMONIAL_TEXT_MAX} characters of plain text.`, `${w}.text`);
    if (!checkWording(text, { strict: true }).ok) return fail('WORDING_NOT_ALLOWED', 'Those words promise results or a ranking, or carry a price or a retired product name.', `${w}.text`);
    const item: Testimonial = { name, text, consent: true };
    if (t.date !== undefined && t.date !== null) {
      if (typeof t.date !== 'string' || !realDate(t.date.trim())) return fail('FIELD_INVALID', 'Use a real date such as 2026-09 or 2026-09-14.', `${w}.date`);
      item.date = t.date.trim();
    }
    out.push(item);
  }
  return { ok: true, items: out };
}
