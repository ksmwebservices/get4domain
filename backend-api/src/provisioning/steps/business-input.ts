import { StepError } from '../provisioning.errors';

export const TRACK_NAMES = ['handyman', 'professional', 'ecommerce'] as const;
export type TrackName = (typeof TRACK_NAMES)[number];

export interface BusinessInput {
  businessName: string;
  track: TrackName;
  category: string;
  ownerName: string;
  phone: string;       // normalised: +91XXXXXXXXXX, or + and 8 to 15 digits for another country
  phoneKey: string;    // the last 10 digits, used to find duplicates whatever way the number was typed
  email: string;       // lower case (for a SEEDED job: the placeholder login nobody can use until the owner claims the page)
  /** slice 5.13a: a SEEDED job comes from public facts and has no owner yet */
  seeded?: boolean;
  city: string;
  language: string;    // for example "en", "ta"; wording per language is a later slice
  /** SEEDED jobs only: the public address facts the staff recorded */
  area?: string; addressLine?: string; description?: string;
}

/** Digits only, then: strip 0091 / 91 / a trunk 0 from an Indian mobile. Anything else with a leading + keeps its country code (8 to 15 digits). */
export function normalisePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const international = trimmed.startsWith('+');
  let d = trimmed.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (!international) {
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    if (d.length === 10 && /^[6-9]/.test(d)) return `+91${d}`;
    if (d.length === 12 && d.startsWith('91')) return `+${d}`;
    return null;
  }
  if (d.length === 12 && d.startsWith('91') && /^[6-9]/.test(d.slice(2))) return `+${d}`;
  return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
}

export const phoneKey = (normalised: string): string => normalised.replace(/\D/g, '').slice(-10);

export function normaliseEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

const RESERVED = new Set(['www', 'app', 'api', 'gapi', 'admin', 'mail', 'cdn', 'static', 'staging', 'demo', 'dashboard', 'login', 'register', 'support', 'help', 'blog', 'ftp', 'smtp', 'test', 'dev']);

/** A lower-case site address base: letters, digits and dashes, 3 to 40 characters, never a reserved name. */
export function slugifySubdomain(businessName: string): string {
  let s = businessName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40).replace(/-$/, '');
  if (s.length === 0) s = 'site';
  if (s.length < 3) s = `${s}-site`;
  if (RESERVED.has(s)) s = `${s}-site`;
  return s;
}

const str = (v: unknown, min: number, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s+/g, ' ');
  return t.length >= min && t.length <= max ? t : null;
};

/** Validates the job input again at run time (it was validated on the way in, but a job row can be edited in the database). Permanent failure on any problem. */
export function parseBusinessInput(raw: unknown): BusinessInput {
  const bad = (): never => { throw new StepError('INVALID_INPUT', false); };
  if (typeof raw !== 'object' || raw === null) return bad();
  const r = raw as Record<string, unknown>;
  const seeded = r.mode === 'SEEDED';
  const businessName = str(r.businessName, 2, 120); const ownerName = seeded ? (str(r.ownerName, 2, 120) ?? 'Business owner') : str(r.ownerName, 2, 120); const city = str(r.city, 2, 80);
  const category = str(r.category, 2, 60); const language = typeof r.language === 'string' && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(r.language) ? r.language : null;
  const track = TRACK_NAMES.find((t) => t === r.track);
  // a SEEDED job never uses a public email as a login: it carries a placeholder address (made when the job was created) that no mailbox exists for
  const email = typeof (seeded ? r.placeholderEmail : r.email) === 'string' ? normaliseEmail((seeded ? r.placeholderEmail : r.email) as string) : null;
  const phone = typeof r.phone === 'string' ? normalisePhone(r.phone) : null;
  if (!businessName || !ownerName || !city || !category || !language || !track || !email || !phone) return bad();
  const extra = seeded ? { seeded: true as const, ...(str(r.area, 2, 80) ? { area: str(r.area, 2, 80)! } : {}), ...(str(r.addressLine, 2, 300) ? { addressLine: str(r.addressLine, 2, 300)! } : {}), ...(str(r.description, 2, 600) ? { description: str(r.description, 2, 600)! } : {}) } : {};
  return { businessName, track, category, ownerName, phone, phoneKey: phoneKey(phone), email, city, language, ...extra };
}
