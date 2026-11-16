import { emailOk } from './claim';
import { isReservedName } from './hostnames';

/**
 * Self-service registration: the rules the form and the server both apply, and the mapping of an API refusal to the field it is about. Pure.
 * Error values are keys of SITE.register.errors; the screens turn them into plain words.
 */
export type RegisterField = 'businessName' | 'category' | 'subdomain' | 'owner' | 'email' | 'phone' | 'password' | 'terms';
export type RegisterErrorKey =
  | 'general' | 'businessName' | 'category' | 'subdomain' | 'subdomainTaken' | 'subdomainReserved' | 'subdomainInvalid' | 'subdomainShort'
  | 'owner' | 'email' | 'emailTaken' | 'phone' | 'password' | 'terms' | 'rate' | 'notAvailable';
export type FieldErrors = Partial<Record<RegisterField, RegisterErrorKey>>;

export const PLAN_KEYS: readonly string[] = ['free', 'handyman', 'professional', 'ecommerce'];
export const TERMS: readonly number[] = [3, 6, 12];
export const SUBDOMAIN_MIN = 3;
export const SUBDOMAIN_MAX = 40;

export interface RegisterInput {
  businessName: string; categoryKey: string; industry: string; subdomain: string; name: string; email: string; phone: string; password: string; acceptedTerms: boolean;
  plan: string; termMonths: number | null;
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
  if (/subdomain|slug|site address/.test(m) || code.includes('SUBDOMAIN') || code.includes('SLUG')) {
    if (/reserved/.test(m) || code.includes('RESERVED')) return { field: 'subdomain', key: 'subdomainReserved' };
    if (/taken|in use|already|exists/.test(m) || code.includes('TAKEN') || code.includes('EXISTS')) return { field: 'subdomain', key: 'subdomainTaken' };
    if (/short|at least|min/.test(m)) return { field: 'subdomain', key: 'subdomainShort' };
    return { field: 'subdomain', key: 'subdomainInvalid' };
  }
  if (/password/.test(m)) return { field: 'password', key: 'password' };
  if (/email/.test(m)) return { field: 'email', key: /already|exists|taken|registered/.test(m) ? 'emailTaken' : 'email' };
  if (/phone|mobile/.test(m)) return { field: 'phone', key: 'phone' };
  if (/business ?name|businessname/.test(m)) return { field: 'businessName', key: 'businessName' };
  if (/categor|industry/.test(m)) return { field: 'category', key: 'category' };
  if (/terms|accept|privacy/.test(m)) return { field: 'terms', key: 'terms' };
  if (/\bname\b/.test(m)) return { field: 'owner', key: 'owner' };
  return null;
}

export interface RegisterFailure { fields: FieldErrors; general: RegisterErrorKey | null }

/** An API refusal to field errors and, when it names none, one general message. Status 0 means the API could not be reached. */
export function mapRegisterFailure(status: number, json: unknown): RegisterFailure {
  if (status === 429) return { fields: {}, general: 'rate' };
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
  if (!Object.keys(fields).length && status === 409) fields.email = 'emailTaken';
  return Object.keys(fields).length ? { fields, general: null } : { fields: {}, general: 'general' };
}

export type SubdomainState = 'available' | 'taken' | 'reserved' | 'invalid' | 'short' | 'unknown';

/** The answer of the (assumed) availability route to a state. */
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
  return 'taken';
}
