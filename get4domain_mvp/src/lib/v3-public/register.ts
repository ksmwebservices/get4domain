import { emailOk } from './claim';
import { isReservedName } from './hostnames';

/**
 * Self-service registration: the rules the form and the server both apply, and the mapping of an API refusal to the field it is about. Pure.
 * Error values are keys of SITE.register.errors; the screens turn them into plain words.
 */
export type RegisterField = 'businessName' | 'category' | 'subdomain' | 'owner' | 'email' | 'phone' | 'password' | 'terms' | 'city' | 'area' | 'pincode' | 'gstin';
export type RegisterErrorKey =
  | 'general' | 'businessName' | 'category' | 'subdomain' | 'subdomainTaken' | 'subdomainReserved' | 'subdomainInvalid' | 'subdomainShort'
  | 'owner' | 'email' | 'emailTaken' | 'phone' | 'password' | 'terms' | 'rate' | 'notAvailable' | 'city' | 'area' | 'pincode' | 'gstin'
  | 'businessDuplicate' | 'businessPossible' | 'mailNotReady' | 'server';
export type FieldErrors = Partial<Record<RegisterField, RegisterErrorKey>>;

export const PLAN_KEYS: readonly string[] = ['free', 'handyman', 'professional', 'ecommerce'];
/** The plan keys that are a Pro (paid) plan: Pro means any paid plan. */
export const PRO_PLAN_KEYS: readonly string[] = ['handyman', 'professional', 'ecommerce'];
export const TERMS: readonly number[] = [3, 6, 12];
/** The three tracks the API's POST /auth/register accepts (IsIn on `track`). */
export const TRACKS = ['handyman', 'professional', 'ecommerce'] as const;
export const DEFAULT_TRACK: (typeof TRACKS)[number] = 'handyman';
/** A plan key or a category minimum tier ('HANDYMAN', 'professional', ...) to a track, or null when it is neither (the free plan, empty, unknown). */
export function trackOfTier(v: string | undefined | null): (typeof TRACKS)[number] | null {
  const t = String(v ?? '').trim().toLowerCase();
  return (TRACKS as readonly string[]).includes(t) ? (t as (typeof TRACKS)[number]) : null;
}
export const SUBDOMAIN_MIN = 3;
export const SUBDOMAIN_MAX = 40;

export interface RegisterInput {
  businessName: string; categoryKey: string; industry: string; subdomain: string; name: string; email: string; phone: string; password: string; acceptedTerms: boolean;
  plan: string; termMonths: number | null;
  /** where the business is: required, and what the duplicate check uses */
  city: string; area: string; pincode: string;
  /** optional; used by the backend only to find an existing business */
  gstin: string;
  /** the answer to "Is this your business?": true = it is a different business (sent only after the backend asked) */
  confirmDistinct: boolean;
}

/** What the visitor typed for the address, cleaned the way the form does it: lower case, spaces trimmed. */
export const cleanSubdomain = (s: string): string => String(s ?? '').trim().toLowerCase();

/** null when the shape is fine; otherwise why not. Reserved names are a separate message (the API has the final say on both, and on taken names). */
export function subdomainProblem(raw: string): RegisterErrorKey | null {
  const s = cleanSubdomain(raw);
  if (!s) return 'subdomain';
  if (!/^[a-z0-9-]+$/.test(s) || s.startsWith('-') || s.endsWith('-') || s.includes('--')) return 'subdomainInvalid';
  if (s.length < SUBDOMAIN_MIN) return 'subdomainShort';
  if (s.length > SUBDOMAIN_MAX) return 'subdomainInvalid';
  if (isReservedName(s)) return 'subdomainReserved';
  return null;
}

/** A six digit Indian postal code (no leading zero). */
export const pincodeOk = (p: string): boolean => /^[1-9][0-9]{5}$/.test(p.trim());
/** A GSTIN has 15 characters; the backend only uses it to find a match, so only the length and the characters are checked here. Empty is fine. */
export const gstinOk = (g: string): boolean => g.trim() === '' || /^[0-9A-Z]{15}$/.test(g.trim().toUpperCase());

export const passwordOk = (p: string): boolean => p.length >= 8 && p.length <= 128 && /[A-Z]/.test(p) && /\d/.test(p);
export const phoneOk = (p: string): boolean => p === '' || /^\+?[0-9][0-9 -]{6,18}[0-9]$/.test(p.trim());

/** Every field problem of a form, so the screen can show them all at once. Empty means the form may be sent. */
export function validateRegister(i: RegisterInput): FieldErrors {
  const e: FieldErrors = {};
  if (!i.businessName.trim() || i.businessName.length > 120) e.businessName = 'businessName';
  if (!i.categoryKey) e.category = 'category';
  const sd = subdomainProblem(i.subdomain);
  if (sd) e.subdomain = sd;
  if (!i.name.trim() || i.name.length > 100) e.owner = 'owner';
  if (!emailOk(i.email.trim())) e.email = 'email';
  if (!phoneOk(i.phone)) e.phone = 'phone';
  if (!passwordOk(i.password)) e.password = 'password';
  if (i.city.trim().length < 2 || i.city.length > 80) e.city = 'city';
  if (i.area.trim().length < 2 || i.area.length > 80) e.area = 'area';
  if (!pincodeOk(i.pincode)) e.pincode = 'pincode';
  if (!gstinOk(i.gstin)) e.gstin = 'gstin';
  if (!i.acceptedTerms) e.terms = 'terms';
  return e;
}

/** The sentences of an API error answer: Nest sends message as a string or a list of strings, plain or inside { data }. */
export function messagesOf(json: unknown): string[] {
  const pick = (o: unknown): unknown => (o && typeof o === 'object' ? (o as Record<string, unknown>).message : undefined);
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const m = pick(root) ?? pick(root.data) ?? pick(root.error);
  if (typeof m === 'string') return [m];
  if (Array.isArray(m)) return m.filter((x): x is string => typeof x === 'string');
  return [];
}

const codeOf = (json: unknown): string => {
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const inner = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : {};
  const c = root.code ?? inner.code;
  return typeof c === 'string' ? c.toUpperCase() : '';
};

/** One API sentence to the field it is about (keywords of the API's own wording), or null when it names none. */
function fieldOfMessage(msg: string, code: string): { field: RegisterField; key: RegisterErrorKey } | null {
  const m = msg.toLowerCase();
  // HOST_UNAVAILABLE (409) is the contract's code for a site address that is taken
  if (code === 'HOST_UNAVAILABLE') return { field: 'subdomain', key: 'subdomainTaken' };
  if (/subdomain|slug|site address/.test(m) || code.includes('SUBDOMAIN') || code.includes('SLUG')) {
    if (/reserved/.test(m) || code.includes('RESERVED')) return { field: 'subdomain', key: 'subdomainReserved' };
    if (/taken|in use|already|exists/.test(m) || code.includes('TAKEN') || code.includes('EXISTS')) return { field: 'subdomain', key: 'subdomainTaken' };
    if (/short|at least|min/.test(m)) return { field: 'subdomain', key: 'subdomainShort' };
    return { field: 'subdomain', key: 'subdomainInvalid' };
  }
  if (/pincode|pin code|postal/.test(m)) return { field: 'pincode', key: 'pincode' };
  if (/gstin/.test(m)) return { field: 'gstin', key: 'gstin' };
  if (/\bcity\b/.test(m)) return { field: 'city', key: 'city' };
  if (/\barea\b/.test(m)) return { field: 'area', key: 'area' };
  if (/password/.test(m)) return { field: 'password', key: 'password' };
  if (/email/.test(m)) return { field: 'email', key: /already|exists|taken|registered/.test(m) ? 'emailTaken' : 'email' };
  if (/phone|mobile/.test(m)) return { field: 'phone', key: 'phone' };
  if (/business ?name|businessname/.test(m)) return { field: 'businessName', key: 'businessName' };
  if (/categor|industry/.test(m)) return { field: 'category', key: 'category' };
  if (/terms|accept|privacy/.test(m)) return { field: 'terms', key: 'terms' };
  if (/\bname\b/.test(m)) return { field: 'owner', key: 'owner' };
  return null;
}

/** The contract's own field names (a 400 lists them in `data.fields`) to the form field they belong to. Unlisted names (referralCode, track, product, unknown) map to nothing. */
const API_FIELD: Readonly<Record<string, { field: RegisterField; key: RegisterErrorKey }>> = {
  name: { field: 'owner', key: 'owner' }, email: { field: 'email', key: 'email' }, password: { field: 'password', key: 'password' }, businessName: { field: 'businessName', key: 'businessName' },
  industry: { field: 'category', key: 'category' }, city: { field: 'city', key: 'city' }, area: { field: 'area', key: 'area' }, pincode: { field: 'pincode', key: 'pincode' }, gstin: { field: 'gstin', key: 'gstin' }, phone: { field: 'phone', key: 'phone' }, subdomain: { field: 'subdomain', key: 'subdomainInvalid' },
};

/** The field names a validation 400 lists in `data.fields` (an array of strings), or an empty list. */
export function apiFieldsOf(json: unknown): string[] {
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const d = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : {};
  return Array.isArray(d.fields) ? d.fields.filter((x): x is string => typeof x === 'string') : [];
}

/** The API's codes for an e-mail service that is switched off or not set up. */
const MAIL_CODES: readonly string[] = ['MAIL_DISABLED', 'EMAIL_NOT_CONFIGURED', 'EMAIL_NOT_LIVE'];

export interface RegisterFailure { fields: FieldErrors; general: RegisterErrorKey | null }

/** An API refusal to field errors and, when it names none, one general message. Status 0 means the API could not be reached. */
export function mapRegisterFailure(status: number, json: unknown): RegisterFailure {
  if (status === 429) return { fields: {}, general: 'rate' };
  const code0 = codeOf(json);
  // a business that already exists: said plainly, but never which business, who owns it or what matched (the API's candidate list is dropped here)
  if (code0 === 'DUPLICATE_BUSINESS') return { fields: {}, general: 'businessDuplicate' };
  if (code0 === 'DUPLICATE_POSSIBLE') return { fields: {}, general: 'businessPossible' };
  if (MAIL_CODES.includes(code0)) return { fields: {}, general: 'mailNotReady' };
  if (status === 0 || status === 404 || status === 405 || status === 501 || status === 502 || status === 503 || status === 504) return { fields: {}, general: 'notAvailable' };
  const code = codeOf(json);
  const fields: FieldErrors = {};
  for (const msg of messagesOf(json)) {
    const hit = fieldOfMessage(msg, code);
    if (hit && !fields[hit.field]) fields[hit.field] = hit.key;
  }
  if (!Object.keys(fields).length && code) {
    const hit = fieldOfMessage('', code);
    if (hit) fields[hit.field] = hit.key;
  }
  if (!Object.keys(fields).length && status === 400) {
    for (const name of apiFieldsOf(json)) {
      const hit = API_FIELD[name];
      if (hit && !fields[hit.field]) fields[hit.field] = hit.key;
    }
  }
  if (!Object.keys(fields).length && status === 409) fields.email = 'emailTaken';
  if (Object.keys(fields).length) return { fields, general: null };
  return { fields: {}, general: status >= 500 ? 'server' : 'general' };
}

export type SubdomainState = 'available' | 'taken' | 'reserved' | 'invalid' | 'short' | 'unknown';

/** The answer of GET /v3/public/subdomain-availability to a state: `{ available, reason: AVAILABLE | INVALID | RESERVED | UNAVAILABLE }`; UNAVAILABLE means the name is taken. */
export function subdomainStateOf(status: number, json: unknown): SubdomainState {
  if (status < 200 || status >= 300) return 'unknown';
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const o = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;
  if (o.available === true) return 'available';
  if (o.available !== false) return 'unknown';
  const reason = typeof o.reason === 'string' ? o.reason.toUpperCase() : '';
  if (reason === 'RESERVED') return 'reserved';
  if (reason === 'INVALID') return 'invalid';
  if (reason === 'TOO_SHORT') return 'short';
  return 'taken'; // UNAVAILABLE (and anything unrecognised that says not available) holds the address back
}

/** One public listing the backend shows for "Is this your business?" (only public facts: no phone, e-mail or owner). */
export interface DuplicateCandidate { slug: string; name: string; category: string | null; city: string | null; area: string | null; claimable: boolean }
export interface DuplicateAsk { candidates: DuplicateCandidate[]; /** the slug of the listing the backend says can be claimed, or null */ claimSlug: string | null }

const dstr = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/**
 * The answer of a 409 DUPLICATE_POSSIBLE to what the form shows: the candidate listings (public facts only) and the claim route's slug.
 * null for any other answer, and for a possible-match answer without a usable listing (then there is nothing to ask about).
 */
export function duplicateAskOf(status: number, json: unknown): DuplicateAsk | null {
  if (status !== 409 || codeOf(json) !== 'DUPLICATE_POSSIBLE') return null;
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const inner = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : {};
  const list = Array.isArray(root.candidates) ? root.candidates : Array.isArray(inner.candidates) ? inner.candidates : [];
  const candidates = list
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c): DuplicateCandidate => ({ slug: dstr(c.slug, 100) ?? '', name: dstr(c.name, 120) ?? '', category: dstr(c.category, 80), city: dstr(c.city, 80), area: dstr(c.area, 80), claimable: c.claimable === true }))
    .filter((c) => c.slug && c.name && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug));
  if (candidates.length === 0) return null;
  const claim = (root.claim ?? inner.claim) as Record<string, unknown> | null | undefined;
  const claimSlug = claim && typeof claim === 'object' ? dstr(claim.businessSlug, 100) : null;
  return { candidates: candidates.slice(0, 5), claimSlug };
}

/** The listing a strong match (409 DUPLICATE_BUSINESS) says can be claimed, or null. */
export function duplicateClaimOf(status: number, json: unknown): string | null {
  if (status !== 409 || codeOf(json) !== 'DUPLICATE_BUSINESS') return null;
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const inner = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : {};
  const claim = (root.claim ?? inner.claim) as Record<string, unknown> | null | undefined;
  const slug = claim && typeof claim === 'object' ? dstr(claim.businessSlug, 100) : null;
  return slug && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? slug : null;
}
