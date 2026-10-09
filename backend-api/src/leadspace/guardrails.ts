import { Verdict } from './abuse';
import { categoryOf } from './leadspace.types';
import { templateFor } from './templates';

/**
 * AI Studio guardrails for anything LeadSpace writes or posts on a vendor's behalf. They apply to generated copy and to the fallback text alike:
 * no guaranteed outcomes, no price promises that are not on the page, no before-and-after claims, and for regulated trades no claims they may not make.
 */
export const COMMON_BANNED: string[] = [
  'guaranteed', 'guarantee ', '100% result', '100% success', 'assured result', 'assured return', 'risk free', 'risk-free', 'sure shot', 'sure-shot',
  'before and after', 'before & after', 'before/after', 'miracle', 'instant result', 'lowest price in', 'cheapest in', 'best in india', 'number one', 'no. 1', '#1 ',
];

const CLINIC_BANNED = ['cure', 'cures', 'cured', 'treats all', 'no side effect', 'painless', 'permanent solution', 'best doctor', 'best clinic'];
const ADVOCATE_BANNED = ['win your case', 'we will win', 'best lawyer', 'best advocate', 'top lawyer', 'expert in all', 'solicit'];
const REALESTATE_BANNED = ['assured returns', 'guaranteed returns', 'double your money', 'zero risk', 'price will rise', 'price will go up'];

/** The instructions given to the AI writer for a trade. */
export function guardrailPrompt(category: string): string {
  const reg = categoryOf(category)?.regulated;
  const lines = [
    'Never promise or guarantee an outcome, result, income or return.',
    'Mention a price only if it is listed on the business page, and use exactly that price.',
    'Never use before-and-after claims, comparisons with other businesses, or superlatives such as best, cheapest or number one.',
    'Plain honest language for an Indian local business. No fake urgency, no invented offers, no invented reviews.',
  ];
  if (reg === 'clinic') lines.push('Medical business: no claims about curing, treating or outcomes; give information and invite an appointment request only.');
  if (reg === 'advocate') lines.push('Legal business: information only. Do not solicit, do not claim expertise in winning, do not compare with other advocates.');
  if (reg === 'realEstate') lines.push('Real estate: no promised returns or price rises; every post must carry the RERA registration number.');
  return lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
}

const PRICE = /(?:rs\.?|inr|₹)\s?([0-9][0-9,]*(?:\.[0-9]+)?)|\b([0-9][0-9,]*)\s?\/-/gi;

/** Every rupee amount mentioned in a text. */
export function pricesIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(PRICE)) {
    const n = Number((m[1] ?? m[2] ?? '').replace(/,/g, ''));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** True when the text is allowed to go out for this trade. `pagePrices` are the prices (in rupees) printed on the vendor's page. */
export function checkCopy(text: string, category: string, pagePrices: number[], opts: { rera?: string | null } = {}): Verdict {
  const t = ` ${text.toLowerCase()} `;
  const reg = categoryOf(category)?.regulated;
  const banned = [...COMMON_BANNED, ...(templateFor(category).forbiddenClaims ?? []), ...(reg === 'clinic' ? CLINIC_BANNED : []), ...(reg === 'advocate' ? ADVOCATE_BANNED : []), ...(reg === 'realEstate' ? REALESTATE_BANNED : [])];
  for (const b of banned) if (t.includes(b.toLowerCase())) return { ok: false, reason: `The text uses a claim we do not allow ("${b.trim()}").` };
  const allowed = new Set(pagePrices.map((p) => Math.round(p)));
  for (const p of pricesIn(text)) if (!allowed.has(Math.round(p))) return { ok: false, reason: `The text mentions a price (Rs ${p}) that is not on the page.` };
  if (reg === 'realEstate' && (!opts.rera || !text.includes(opts.rera))) return { ok: false, reason: 'Real estate posts must carry the RERA registration number.' };
  return { ok: true };
}
