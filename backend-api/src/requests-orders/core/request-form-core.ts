/**
 * The request form of a vendor site (S1 shell, platform side), pure: no clock, no randomness, no database. The extra questions a business asks before it can quote (a builder: site visit date, time and
 * site; an ambulance: pickup place; a plumber: address and time) are DATA per industry pack and per registration category, with a default for everything else. The same data draws the form on the page
 * and checks what comes back on the server, so a browser can never add a field the data does not name.
 *
 * Which fields a business gets: the category's own list if it has one, else its industry pack's list, else the default. A list replaces the one below it (it is not merged), so what a vendor
 * sees is exactly one reviewed list.
 */
export type RequestFieldType = 'text' | 'longtext' | 'date' | 'time' | 'phone' | 'number' | 'select';
export interface RequestField { key: string; label: string; type: RequestFieldType; required: boolean; options?: string[] }
export interface RequestFormData { defaults: RequestField[]; packs: Record<string, RequestField[]>; categories: Record<string, RequestField[]> }

export const REQUEST_FIELD_TYPES: readonly RequestFieldType[] = ['text', 'longtext', 'date', 'time', 'phone', 'number', 'select'];
export const MAX_REQUEST_FIELDS = 8;
const KEY = /^[a-z][a-z0-9_]{0,31}$/;
const MARKUP = /[<>]/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** The fields for one business: category, then pack, then the default. `category` is the registration category id; `kitCategory` is the kit category the site is drawn from (tried second). */
export function formFor(data: RequestFormData, o: { pack?: string | null; category?: string | null; kitCategory?: string | null }): RequestField[] {
  const own = (o.category && data.categories[o.category]) || (o.kitCategory && data.categories[o.kitCategory]) || null;
  return (own ?? (o.pack ? data.packs[o.pack] : null) ?? data.defaults).map((f) => ({ ...f, ...(f.options ? { options: [...f.options] } : {}) }));
}

/** Problems with the data itself (a test runs this over the shipped data so a bad edit cannot ship). */
export function dataProblems(data: RequestFormData): string[] {
  const out: string[] = [];
  const check = (where: string, list: RequestField[]): void => {
    if (list.length > MAX_REQUEST_FIELDS) out.push(`${where}: more than ${MAX_REQUEST_FIELDS} fields`);
    const seen = new Set<string>();
    for (const f of list) {
      if (!KEY.test(f.key)) out.push(`${where}.${f.key}: bad key`);
      if (seen.has(f.key)) out.push(`${where}.${f.key}: duplicate key`);
      seen.add(f.key);
      if (f.key === 'name' || f.key === 'phone' || f.key === 'message' || f.key === 'item' || f.key === 'consent' || f.key === 'email') out.push(`${where}.${f.key}: reserved key`);
      if (!REQUEST_FIELD_TYPES.includes(f.type)) out.push(`${where}.${f.key}: bad type`);
      if (!f.label || f.label.length > 80 || MARKUP.test(f.label)) out.push(`${where}.${f.key}: bad label`);
      if (f.type === 'select' && (!f.options || f.options.length < 2 || f.options.length > 12 || f.options.some((x) => !x || x.length > 60 || MARKUP.test(x)))) out.push(`${where}.${f.key}: bad options`);
      if (f.type !== 'select' && f.options) out.push(`${where}.${f.key}: options on a field that is not a select`);
    }
  };
  check('defaults', data.defaults);
  for (const [k, v] of Object.entries(data.packs)) check(`packs.${k}`, v);
  for (const [k, v] of Object.entries(data.categories)) check(`categories.${k}`, v);
  return out;
}

const validDate = (v: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return false;
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
};

const one = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : typeof v === 'number' ? String(v) : '').trim();

/**
 * Checks what a visitor sent against the fields of that business. Only declared fields are read; anything else is ignored and never stored. A required field must be there; an empty optional one is left
 * out. Returns the clean values (strings) or every problem, each named by field.
 */
export function validateDetails(fields: readonly RequestField[], input: Record<string, unknown>): { ok: true; values: Record<string, string> } | { ok: false; errors: string[] } {
  const values: Record<string, string> = {}; const errors: string[] = [];
  for (const f of fields) {
    const raw = one(input[f.key]).replace(/\r\n/g, '\n');
    const v = f.type === 'longtext' ? raw : raw.replace(/\s+/g, ' ');
    if (v === '') { if (f.required) errors.push(`${f.key}: required`); continue; }
    if (CONTROL.test(v) || MARKUP.test(v)) { errors.push(`${f.key}: remove the < and > characters`); continue; }
    switch (f.type) {
      case 'text': if (v.length > 200) errors.push(`${f.key}: at most 200 characters`); else values[f.key] = v; break;
      case 'longtext': if (v.length > 1000) errors.push(`${f.key}: at most 1000 characters`); else values[f.key] = v; break;
      case 'date': if (!validDate(v)) errors.push(`${f.key}: a date like 2026-12-31`); else values[f.key] = v; break;
      case 'time': if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) errors.push(`${f.key}: a time like 14:30`); else values[f.key] = v; break;
      case 'number': if (!/^\d{1,6}$/.test(v) || Number(v) < 1) errors.push(`${f.key}: a whole number`); else values[f.key] = String(Number(v)); break;
      case 'phone': { const digits = v.replace(/\D/g, ''); if (!/^\+?[0-9][0-9 ()-]*$/.test(v) || digits.length < 7 || digits.length > 15) errors.push(`${f.key}: a phone number`); else values[f.key] = v; break; }
      case 'select': if (!(f.options ?? []).includes(v)) errors.push(`${f.key}: choose one of the listed answers`); else values[f.key] = v; break;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, values };
}

/** The answers as readable lines for the business inbox copy: `Label: value`. Only fields of the form, in form order. */
export function detailLines(fields: readonly RequestField[], values: Record<string, string>): string[] {
  return fields.filter((f) => values[f.key] !== undefined).map((f) => `${f.label}: ${values[f.key]}`);
}
