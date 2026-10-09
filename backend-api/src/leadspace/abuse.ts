import { categoryOf } from './leadspace.types';

export interface Verdict { ok: boolean; reason?: string }

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Looks for blocked words (any trade) and claims a regulated trade may not make. Whole-word, case-insensitive.
 * The reason is a plain sentence that tells the vendor what to change, and never reveals the whole list.
 */
export function scanText(fields: Record<string, string | null | undefined>, blocklist: string[], forbiddenClaims: string[] = []): Verdict {
  for (const [label, raw] of Object.entries(fields)) {
    const text = String(raw ?? '').toLowerCase();
    if (!text) continue;
    for (const w of blocklist) {
      if (w && new RegExp(`(^|[^a-z0-9])${escapeRe(w.toLowerCase())}($|[^a-z0-9])`).test(text)) return { ok: false, reason: `The ${label} contains a word we do not allow on LeadSpace pages ("${w}"). Remove it and save again.` };
    }
    for (const c of forbiddenClaims) {
      if (c && text.includes(c.toLowerCase())) return { ok: false, reason: `The ${label} makes a claim this kind of business may not make ("${c}"). Remove it and save again.` };
    }
  }
  return { ok: true };
}

/** Business name and category sanity check run before any page can be published. */
export function checkBusiness(name: string, categoryId: string): Verdict {
  const n = name.trim();
  if (n.length < 2 || n.length > 80) return { ok: false, reason: 'Enter your business name (2 to 80 characters).' };
  if (!/[a-zA-Zऀ-෿]/.test(n)) return { ok: false, reason: 'The business name needs some letters.' };
  if (/https?:\/\/|www\.|\.com\b|\b\d{10}\b/i.test(n)) return { ok: false, reason: 'Leave web addresses and phone numbers out of the business name.' };
  if (!categoryOf(categoryId)) return { ok: false, reason: 'Choose one of the listed trades.' };
  return { ok: true };
}

/** A RERA registration number looks like TN/29/Building/0123/2020: letters, digits, slashes, dashes. We check the shape, not the register. */
export function reraLooksValid(v: string | null | undefined): boolean {
  const s = String(v ?? '').trim();
  return s.length >= 6 && s.length <= 60 && /^[A-Za-z0-9][A-Za-z0-9/\-\s.]+$/.test(s);
}

export interface PromotionInput { category: string; status: string; verificationStatus: string; reraNumber?: string | null; regulated?: unknown }

/**
 * May Get4Domain promote this vendor's page? Unverified pages are never promoted. Advocates (information and enquiry only) and clinics are not promoted
 * unless an admin switches it on for that vendor; a real-estate page needs a RERA number, which is then shown on the page and on every post.
 */
export function promotionGate(p: PromotionInput): Verdict {
  if (p.status !== 'PUBLISHED') return { ok: false, reason: 'Publish your page first.' };
  if (p.verificationStatus !== 'VERIFIED') return { ok: false, reason: 'Verify your phone number first. Pages that are not verified are not promoted.' };
  const kind = categoryOf(p.category)?.regulated;
  const flags = (p.regulated && typeof p.regulated === 'object' ? p.regulated : {}) as { adminAllowPromotion?: boolean; reviewed?: boolean };
  if (kind === 'advocate' && !flags.adminAllowPromotion) return { ok: false, reason: 'Advocate pages give information and take enquiries only. They are not promoted.' };
  if (kind === 'clinic' && !flags.adminAllowPromotion) return { ok: false, reason: 'Clinic pages are not promoted unless our team switches it on for you. Contact support.' };
  if (kind === 'realEstate' && !reraLooksValid(p.reraNumber)) return { ok: false, reason: 'Add your RERA registration number to promote real estate. It is shown on your page and on every post.' };
  return { ok: true };
}
