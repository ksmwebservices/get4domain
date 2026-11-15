/**
 * Pack records (Wave 2 Part A). PURE: no clock, no database. A vendor's record on a pack tab is a small JSON document checked against the tab's field list (platform data, staff editable).
 * Rules that never bend: unknown fields are refused, a value must have the field's type, a text is length-capped and may not carry markup, money is a whole number of MINOR units (paise) and
 * is never shown as GST-inclusive, a record is never hard deleted.
 */
export const FIELD_TYPES = ['text', 'longtext', 'number', 'money', 'date', 'datetime', 'select', 'multiselect', 'bool', 'phone', 'email', 'url', 'image', 'status'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export const isFieldType = (v: unknown): v is FieldType => typeof v === 'string' && (FIELD_TYPES as readonly string[]).includes(v);

/** The status every record carries (a fixed set, not a field a vendor can redefine). The Free-trial front end only needs OPEN and DONE. */
export const RECORD_STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];
export const isRecordStatus = (v: unknown): v is RecordStatus => typeof v === 'string' && (RECORD_STATUSES as readonly string[]).includes(v);

export interface FieldDef {
  key: string; label: string; type: FieldType; required: boolean; options: string[]; sortOrder: number; listColumn: boolean; searchable: boolean;
}

export const LIMITS = { text: 200, longtext: 4000, url: 500, email: 254, selectOption: 80, multiselectMax: 20, money: 1_000_000_000_000, number: 1_000_000_000_000, fieldsPerTab: 40, dataBytes: 16_000, search: 80, page: 100 } as const;

const FIELD_KEY = /^[a-z][a-z0-9_]{0,39}$/;
export const isFieldKey = (v: unknown): v is string => typeof v === 'string' && FIELD_KEY.test(v);

/** Markup and control characters are refused outright (a record is data, never HTML). */
const MARKUP = /[<>]|&#|&lt|&gt|javascript:/i;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type FieldErrors = Record<string, string>;

export function cleanText(v: unknown, max: number, multiline: boolean): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof v !== 'string') return { ok: false, error: 'Enter text.' };
  const t = (multiline ? v.replace(/\r\n?/g, '\n') : v.replace(/\s+/g, ' ')).trim();
  if (CONTROL.test(t)) return { ok: false, error: 'This has characters that are not allowed.' };
  if (MARKUP.test(t)) return { ok: false, error: 'Remove the markup, only plain text is kept.' };
  if (t.length > max) return { ok: false, error: `Keep this to ${max} characters or fewer.` };
  return { ok: true, value: t };
}

const isEmpty = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

function validDay(s: string): boolean {
  if (!DAY.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** One value against one field. Returns the cleaned value, or an error sentence. `undefined` as a cleaned value means "leave it out". */
export function checkValue(f: FieldDef, v: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  switch (f.type) {
    case 'text': return cleanText(v, LIMITS.text, false);
    case 'longtext': return cleanText(v, LIMITS.longtext, true);
    case 'number': {
      if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > LIMITS.number) return { ok: false, error: 'Enter a number.' };
      return { ok: true, value: v };
    }
    case 'money': {
      // minor units (paise), a whole number, never negative. The amount is the price BEFORE GST: the value is never grossed up or shown as tax-inclusive.
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > LIMITS.money) return { ok: false, error: 'Enter the amount as a whole number of paise, zero or more.' };
      return { ok: true, value: v };
    }
    case 'date': return typeof v === 'string' && validDay(v) ? { ok: true, value: v } : { ok: false, error: 'Enter a date as YYYY-MM-DD.' };
    case 'datetime': {
      if (typeof v !== 'string' || v.length > 40) return { ok: false, error: 'Enter a date and time.' };
      const d = new Date(v);
      return Number.isNaN(d.getTime()) || !/^\d{4}-\d{2}-\d{2}T/.test(v) ? { ok: false, error: 'Enter a date and time.' } : { ok: true, value: d.toISOString() };
    }
    case 'select': return typeof v === 'string' && f.options.includes(v) ? { ok: true, value: v } : { ok: false, error: 'Pick one of the listed choices.' };
    case 'multiselect': {
      if (!Array.isArray(v) || v.length > LIMITS.multiselectMax || v.some((x) => typeof x !== 'string' || !f.options.includes(x))) return { ok: false, error: 'Pick from the listed choices.' };
      return { ok: true, value: [...new Set(v as string[])] };
    }
    case 'bool': return typeof v === 'boolean' ? { ok: true, value: v } : { ok: false, error: 'Choose yes or no.' };
    case 'phone': {
      if (typeof v !== 'string') return { ok: false, error: 'Enter a phone number.' };
      const p = v.replace(/[\s-]/g, '');
      return /^\+?\d{7,15}$/.test(p) ? { ok: true, value: p } : { ok: false, error: 'Enter a phone number with 7 to 15 digits.' };
    }
    case 'email': {
      if (typeof v !== 'string') return { ok: false, error: 'Enter an email address.' };
      const e = v.trim().toLowerCase();
      return e.length <= LIMITS.email && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e) ? { ok: true, value: e } : { ok: false, error: 'Enter an email address.' };
    }
    case 'url':
    case 'image': {
      if (typeof v !== 'string' || v.length > LIMITS.url || MARKUP.test(v)) return { ok: false, error: 'Enter a web address.' };
      try {
        const u = new URL(v.trim());
        const okProtocol = f.type === 'image' ? u.protocol === 'https:' : u.protocol === 'https:' || u.protocol === 'http:';
        return okProtocol ? { ok: true, value: u.toString() } : { ok: false, error: f.type === 'image' ? 'A picture address must start with https.' : 'A web address must start with http or https.' };
      } catch { return { ok: false, error: 'Enter a web address.' }; }
    }
    case 'status': return isRecordStatus(v) ? { ok: true, value: v } : { ok: false, error: 'Pick a status from the list.' };
  }
}

export interface Checked { ok: boolean; data: Record<string, unknown>; status: RecordStatus | null; errors: FieldErrors }

/**
 * Checks a whole write. `existing` is the record's current data on an update: only the keys sent are checked, but the merged record must still satisfy every required field.
 * A field of type `status` is lifted out of the data into the row's status. Sending `null` for an optional field clears it.
 */
export function checkRecord(fields: readonly FieldDef[], input: unknown, existing: Record<string, unknown> = {}): Checked {
  const errors: FieldErrors = {}; const data: Record<string, unknown> = { ...existing }; let status: RecordStatus | null = null;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, data, status, errors: { _: 'Send the record as an object of fields.' } };
  const byKey = new Map(fields.map((f) => [f.key, f] as const));
  for (const [k, raw] of Object.entries(input as Record<string, unknown>)) {
    const f = byKey.get(k);
    if (!f) { errors[k] = 'This field is not part of this record.'; continue; }
    if (isEmpty(raw)) { delete data[k]; if (f.type === 'status') status = null; continue; }
    const r = checkValue(f, raw);
    if (!r.ok) { errors[k] = r.error; continue; }
    if (f.type === 'status') { status = r.value as RecordStatus; delete data[k]; continue; }
    data[k] = r.value;
  }
  for (const f of fields) if (f.required && f.type !== 'status' && isEmpty(data[f.key])) errors[f.key] ??= 'This is required.';
  if (JSON.stringify(data).length > LIMITS.dataBytes) errors._ = 'This record is too large.';
  return { ok: Object.keys(errors).length === 0, data, status, errors };
}

/** The lower-cased text a search looks in: the values of the searchable fields only. */
export function searchTextOf(fields: readonly FieldDef[], data: Record<string, unknown>): string {
  return fields.filter((f) => f.searchable).map((f) => data[f.key]).filter((v): v is string | number => typeof v === 'string' || typeof v === 'number').map((v) => String(v).toLowerCase()).join(' ').slice(0, 1000);
}

/** What a screen needs to draw the form and the list. Money fields say they are minor units before GST. */
export function schemaView(fields: readonly FieldDef[]): { fields: Array<FieldDef & { unit?: 'MINOR'; taxNote?: string }>; listColumns: string[]; statuses: readonly RecordStatus[] } {
  const ordered = [...fields].sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
  return {
    fields: ordered.map((f) => (f.type === 'money' ? { ...f, unit: 'MINOR' as const, taxNote: 'Before GST' } : f)),
    listColumns: ordered.filter((f) => f.listColumn).map((f) => f.key), statuses: RECORD_STATUSES,
  };
}

/** The checks staff edits of a field list must pass (used by the loader and by the staff route). Returns problems. */
export function checkFieldDefs(fields: ReadonlyArray<{ key: unknown; label: unknown; type: unknown; options?: unknown }>): string[] {
  const problems: string[] = []; const seen = new Set<string>();
  if (fields.length > LIMITS.fieldsPerTab) problems.push(`A tab has at most ${LIMITS.fieldsPerTab} fields.`);
  for (const f of fields) {
    if (!isFieldKey(f.key)) { problems.push(`Bad field key ${String(f.key)}.`); continue; }
    if (seen.has(f.key)) problems.push(`Duplicate field ${f.key}.`); seen.add(f.key);
    if (typeof f.label !== 'string' || f.label.trim().length === 0 || f.label.length > 80 || MARKUP.test(f.label)) problems.push(`Bad label on ${f.key}.`);
    if (!isFieldType(f.type)) problems.push(`Bad type on ${f.key}.`);
    const needsOptions = f.type === 'select' || f.type === 'multiselect';
    const opts = Array.isArray(f.options) ? f.options : [];
    if (needsOptions && (opts.length === 0 || opts.some((o) => typeof o !== 'string' || o.length === 0 || o.length > LIMITS.selectOption || MARKUP.test(o)))) problems.push(`Field ${f.key} needs its choices.`);
  }
  return problems;
}

/** Page arguments: 1-based page, size 1 to 100 (default 25). */
export function pageOf(page: unknown, pageSize: unknown): { page: number; pageSize: number; skip: number } {
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  const s = Math.min(LIMITS.page, Math.max(1, Math.floor(Number(pageSize)) || 25));
  return { page: p, pageSize: s, skip: (p - 1) * s };
}

export const cleanSearch = (q: unknown): string => (typeof q === 'string' ? q.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, LIMITS.search) : '');

/**
 * Record tabs a team member may not open (money and contract records). DATA: a key is `tab` or `OWNER:tab`; everything else a team member may use, as the tab list already hides what their area does
 * not allow. The owner opens every record tab their plan allows.
 */
export const OWNER_ONLY_RECORD_TABS: ReadonlySet<string> = new Set([
  'billing', 'fees', 'retainers', 'deposit', 'advance_payments', 'rent_roll', 'per_day_pricing', 'bulk_price_tiers', 'plans_and_renewals', 'proposals', 'brokerage', 'product_sales', 'amc_contracts', 'quotations',
]);
export const isOwnerOnlyTab = (ownerKey: string, tabKey: string): boolean => OWNER_ONLY_RECORD_TABS.has(tabKey) || OWNER_ONLY_RECORD_TABS.has(`${ownerKey}:${tabKey}`);

/** The row's title for a list: the first required text field, else the first text field, else null. */
export function titleOf(fields: readonly FieldDef[], data: Record<string, unknown>): string | null {
  const ordered = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);
  const f = ordered.find((x) => x.type === 'text' && x.required) ?? ordered.find((x) => x.type === 'text');
  const v = f ? data[f.key] : undefined;
  return typeof v === 'string' && v.length > 0 ? v : null;
}
