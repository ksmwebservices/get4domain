/**
 * The firm profile (Wave 2 Part H3): who the platform's own company is, as DATA in one row, so no invoice, legal text or footer carries the name, the address or the tax number as typed text. Pure: no
 * database, no clock, no environment.
 *
 * The GSTIN and the PAN are optional. With no GSTIN set, every document simply leaves the GSTIN line out (it never prints "pending" or a made-up number).
 */
export interface FirmProfile {
  legalName: string;
  registeredAddress: string;
  /** null until the owner supplies it */
  gstin: string | null;
  pan: string | null;
  registeredEmail: string | null;
  registeredPhone: string | null;
}

/** The first state of the row (the migration inserts the same two values). The owner changes them through the staff route, never by a release. */
export const FIRM_DEFAULTS: Readonly<FirmProfile> = Object.freeze({
  legalName: 'KSM QUANTUM TECHNOLOGIES', registeredAddress: 'Tidel Park, D Block, Tharamani, Chennai 600113', gstin: null, pan: null, registeredEmail: null, registeredPhone: null,
});

/** The state codes a GSTIN may start with: the 37 states and territories of the GST code list (01 to 38; 28 is the older Andhra Pradesh code), 97 other territory and 99 centre jurisdiction. */
export const GST_STATE_CODES: ReadonlySet<string> = new Set([...Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, '0')), '97', '99']);

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_RE = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,255}\.[^\s@<>"]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9 ()-]{6,18}[0-9]$/;

/** null when the GSTIN is acceptable: 15 characters in the GST layout (state code, the PAN, an entity number, Z, a check character) and a known state code. */
export function gstinProblem(g: string): string | null {
  if (!GSTIN_RE.test(g)) return 'must be 15 characters: a 2 digit state code, the 10 character PAN, an entity number, the letter Z and a check character (for example 33ABCDE1234F1Z5)';
  if (!GST_STATE_CODES.has(g.slice(0, 2))) return `has an unknown state code ${g.slice(0, 2)}`;
  return null;
}

export interface FirmEdit { legalName?: unknown; registeredAddress?: unknown; gstin?: unknown; pan?: unknown; registeredEmail?: unknown; registeredPhone?: unknown }
export type FirmCheck = { ok: true; patch: Partial<FirmProfile> } | { ok: false; problems: Record<string, string> };

const clean = (v: unknown): string | null | undefined => (v === undefined ? undefined : v === null ? null : typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : undefined);
const hasControl = (s: string): boolean => /[\u0000-\u0008\u000b-\u001f\u007f<>]/.test(s);

/**
 * Checks a staff edit against the profile it will land on. A field that is not sent is left alone; an empty text or null clears a nullable field. The legal name and the address can never be empty.
 * When the GSTIN and the PAN are both set, the PAN must be the one inside the GSTIN (characters 3 to 12). Returns the cleaned patch, or every problem by field.
 */
export function checkFirmEdit(input: FirmEdit, current: FirmProfile): FirmCheck {
  const problems: Record<string, string> = {}; const patch: Partial<FirmProfile> = {};
  const text = (field: 'legalName' | 'registeredAddress', max: number): void => {
    const raw = input[field]; if (raw === undefined) return;
    if (typeof raw !== 'string') { problems[field] = 'must be text'; return; }
    const v = clean(raw) as string;
    if (!v) problems[field] = 'cannot be empty'; else if (v.length > max) problems[field] = `must be at most ${max} characters`; else if (hasControl(v)) problems[field] = 'has characters that are not allowed'; else patch[field] = v;
  };
  const nullable = (field: 'gstin' | 'pan' | 'registeredEmail' | 'registeredPhone', fix: (v: string) => string, bad: (v: string) => string | null): void => {
    const raw = input[field]; if (raw === undefined) return;
    if (raw !== null && typeof raw !== 'string') { problems[field] = 'must be text or null'; return; }
    const v = raw === null ? '' : fix(clean(raw) as string);
    if (v === '') { patch[field] = null; return; }
    const why = bad(v); if (why) problems[field] = why; else patch[field] = v;
  };
  text('legalName', 120); text('registeredAddress', 400);
  nullable('gstin', (v) => v.replace(/\s/g, '').toUpperCase(), gstinProblem);
  nullable('pan', (v) => v.replace(/\s/g, '').toUpperCase(), (v) => (PAN_RE.test(v) ? null : 'must be 10 characters: 5 letters, 4 digits and a letter (for example ABCDE1234F)'));
  nullable('registeredEmail', (v) => v.toLowerCase(), (v) => (v.length <= 254 && EMAIL_RE.test(v) ? null : 'does not look like an email address'));
  nullable('registeredPhone', (v) => v, (v) => (PHONE_RE.test(v) ? null : 'does not look like a phone number'));
  const gstin = 'gstin' in patch ? patch.gstin : current.gstin; const pan = 'pan' in patch ? patch.pan : current.pan;
  if (gstin && pan && !problems.gstin && !problems.pan && gstin.slice(2, 12) !== pan) problems.pan = 'is not the PAN inside the GSTIN (characters 3 to 12)';
  return Object.keys(problems).length ? { ok: false, problems } : { ok: true, patch };
}

/** What the public footer may show: the name, the address, and the GSTIN only when it is set. Nothing else leaves the server (no PAN, email or phone). */
export function publicFirm(f: FirmProfile): { legalName: string; registeredAddress: string; gstin?: string } {
  return f.gstin ? { legalName: f.legalName, registeredAddress: f.registeredAddress, gstin: f.gstin } : { legalName: f.legalName, registeredAddress: f.registeredAddress };
}

/** The seller block of an invoice, from the profile. An unset field is an empty text, and every renderer leaves an empty line out. */
export function invoiceSeller(f: FirmProfile): { name: string; address: string; gstin: string; pan: string; phone: string; email: string } {
  return { name: f.legalName, address: f.registeredAddress, gstin: f.gstin ?? '', pan: f.pan ?? '', phone: f.registeredPhone ?? '', email: f.registeredEmail ?? '' };
}

/** The tokens a legal text may carry. A token with no value (no GSTIN yet) takes its whole LINE out of the text, so nothing like "GSTIN:" is left hanging. */
export const FIRM_TOKENS = ['firm.name', 'firm.address', 'firm.gstin', 'firm.pan', 'firm.email', 'firm.phone'] as const;
export function applyFirmTokens(text: string, f: FirmProfile): string {
  const value: Record<string, string | null> = { 'firm.name': f.legalName, 'firm.address': f.registeredAddress, 'firm.gstin': f.gstin, 'firm.pan': f.pan, 'firm.email': f.registeredEmail, 'firm.phone': f.registeredPhone };
  const re = /\{\{\s*(firm\.[a-z]+)\s*\}\}/g;
  return text.split('\n').flatMap((line) => {
    let dropped = false;
    const out = line.replace(re, (whole, key: string) => { if (!(key in value)) return whole; const v = value[key]; if (v === null || v === '') { dropped = true; return ''; } return v; });
    return dropped ? [] : [out];
  }).join('\n');
}

/** Lines of a seller block that have a value, joined with a separator; used by the invoice and the proposal so an empty field never leaves a stray dot or a label. */
export function joinPresent(parts: ReadonlyArray<string | null | undefined>, sep: string): string { return parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').join(sep); }
