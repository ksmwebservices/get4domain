import { parseCsv } from '../../seeded-sites/core/seeded';
import { ProfileField } from '../../v3-profile-fields/core/profile-core';

/**
 * Pure rules of the listing import (Wave 2 Part D). The template is: category, business name, phone, email, address, city, state, locality, pincode and services (semicolon separated), then the two staff attestation
 * columns the seeded-site rules already require (source kind, and the "only public facts" tick), then one column per profile field of the category. Headers are matched ignoring case, spaces and punctuation.
 */
export const BASE_COLUMNS = ['category', 'business name', 'phone', 'email', 'address', 'city', 'state', 'locality', 'pincode', 'services (semicolon separated)'] as const;
export const ATTESTATION_COLUMNS = ['source kind', 'source note', 'public facts only'] as const;
/** a header, as the cell key the seeded-site rules read, or the extra the import reads itself */
const ALIASES: Readonly<Record<string, string>> = {
  category: 'category', businessname: 'businessName', phone: 'phone', email: 'email', address: 'address', city: 'city', state: 'state', locality: 'area', area: 'area', pincode: 'pincode', pin: 'pincode', postalcode: 'pincode',
  services: 'services', servicessemicolonseparated: 'services', sourcekind: 'sourceKind', sourcenote: 'sourceNote', publicfactsonly: 'publicFactsOnly', publicfacts: 'publicFactsOnly',
};
/** these profile fields are filled from the base columns, so a column of their own is not offered */
export const COVERED_BY_BASE = ['business_name', 'address_line', 'locality', 'city', 'state', 'pincode', 'phone', 'email', 'services'] as const;
export const REQUIRED_HEADERS = ['category', 'businessName', 'phone', 'city', 'area', 'pincode', 'sourceKind', 'publicFactsOnly'] as const;
const norm = (h: string): string => h.toLowerCase().replace(/[^a-z0-9]+/g, '');
export const PINCODE = /^[1-9][0-9]{5}$/;
export const LISTS_MAX = 30;

export interface ImportRow { line: number; cells: Record<string, string>; state: string; pincode: string; services: string; profile: Record<string, string> }

/** Parses the file. A missing required column refuses the whole file. Columns that are neither base nor a known profile field key are returned in `ignored` (never silently used). */
export function parseImport(text: string, maxRows: number, profileKeys: ReadonlySet<string>): { rows: ImportRow[]; ignored: string[]; error: string | null } {
  if (typeof text !== 'string' || text.length === 0) return { rows: [], ignored: [], error: 'The file is empty.' };
  if (Buffer.byteLength(text) > 1_000_000) return { rows: [], ignored: [], error: 'The file is too large.' };
  const all = parseCsv(text);
  if (all.length === 0) return { rows: [], ignored: [], error: 'The file is empty.' };
  const byNorm = new Map([...profileKeys].map((k) => [norm(k), k] as const));
  const header = all[0].map((h) => ({ raw: h, base: ALIASES[norm(h)] ?? null, profile: ALIASES[norm(h)] ? null : byNorm.get(norm(h)) ?? null }));
  const have = new Set(header.map((h) => h.base).filter((x): x is string => !!x));
  const missing = REQUIRED_HEADERS.filter((c) => !have.has(c));
  if (missing.length) return { rows: [], ignored: [], error: `Missing columns: ${missing.map((m) => (m === 'area' ? 'locality' : m === 'businessName' ? 'business name' : m === 'sourceKind' ? 'source kind' : m === 'publicFactsOnly' ? 'public facts only' : m)).join(', ')}.` };
  const body = all.slice(1);
  if (body.length === 0) return { rows: [], ignored: [], error: 'The file has no rows.' };
  if (body.length > maxRows) return { rows: [], ignored: [], error: `The file has ${body.length} rows; the most allowed in one import is ${maxRows}.` };
  const ignored = header.filter((h) => h.raw.trim() !== '' && !h.base && !h.profile).map((h) => h.raw.trim());
  const rows = body.map((cells, i): ImportRow => {
    const cell = (idx: number): string => (cells[idx] ?? '').trim();
    const r: ImportRow = { line: i + 2, cells: {}, state: '', pincode: '', services: '', profile: {} };
    header.forEach((h, idx) => {
      if (h.base === 'state') r.state = cell(idx); else if (h.base === 'pincode') r.pincode = cell(idx); else if (h.base === 'services') r.services = cell(idx);
      else if (h.base) r.cells[h.base] = cell(idx);
      else if (h.profile && cell(idx) !== '') r.profile[h.profile] = cell(idx);
    });
    return r;
  });
  return { rows, ignored, error: null };
}

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim();
/** "Leak repair: taps and pipes; Bathroom fitting" becomes [{name, description?}, ...]. At most 30 items, a name of 2 to 80 characters. */
export function parseServices(cell: string): { ok: true; value: Array<{ name: string; description?: string }> } | { ok: false; error: string } {
  const parts = cell.split(';').map(clean).filter(Boolean);
  if (parts.length === 0) return { ok: true, value: [] };
  if (parts.length > LISTS_MAX) return { ok: false, error: `services: at most ${LISTS_MAX}` };
  const out: Array<{ name: string; description?: string }> = [];
  for (const p of parts) {
    const i = p.indexOf(':'); const name = clean(i < 0 ? p : p.slice(0, i)); const description = i < 0 ? '' : clean(p.slice(i + 1));
    if (name.length < 2 || name.length > 80) return { ok: false, error: 'services: each name is 2 to 80 characters' };
    out.push(description ? { name, description } : { name });
  }
  return { ok: true, value: out };
}

/** The cell text of a profile column, as the value its field type expects. A picture list cannot be given in a spreadsheet (each picture needs a description): add pictures after the import. */
export function profileCell(f: Pick<ProfileField, 'type'>, cell: string): { ok: true; value: unknown } | { ok: false; error: string } {
  switch (f.type) {
    case 'textlist': return { ok: true, value: cell.split(';').map(clean).filter(Boolean) };
    case 'servicelist': { const s = parseServices(cell); return s.ok ? { ok: true, value: s.value } : s; }
    case 'imagelist': return { ok: false, error: 'pictures cannot be given in the file; add them after the import' };
    case 'number': { const n = Number(cell); return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: 'must be a number' }; }
    case 'bool': return /^(yes|true|1)$/i.test(cell) ? { ok: true, value: true } : /^(no|false|0)$/i.test(cell) ? { ok: true, value: false } : { ok: false, error: 'must be yes or no' };
    case 'multiselect': return { ok: true, value: cell.split(';').map(clean).filter(Boolean) };
    default: return { ok: true, value: cell };
  }
}

/** The key that makes an import repeatable: the phone (or the email when there is none), the business name and the pincode, lower case, letters and digits only. A row with the same key as a business already listed is skipped, not made twice. */
export function importKeyOf(i: { phone?: string | null; email?: string | null; businessName: string; pincode: string }): string {
  const who = (i.phone ?? '').replace(/\D/g, '').slice(-10) || (i.email ?? '').toLowerCase();
  return `${who}|${i.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '')}|${i.pincode}`;
}

/** The template for a category: the base columns, the attestation columns, then one column per profile field that the base columns do not already cover. */
export function templateColumns(fields: ReadonlyArray<Pick<ProfileField, 'fieldKey' | 'type'>>): { columns: string[]; header: string } {
  const covered = new Set<string>(COVERED_BY_BASE);
  const extra = fields.filter((f) => !covered.has(f.fieldKey) && f.type !== 'imagelist' && f.fieldKey !== 'banner_image' && f.fieldKey !== 'banner_image_alt').map((f) => f.fieldKey);
  const columns = [...BASE_COLUMNS, ...ATTESTATION_COLUMNS, ...extra];
  return { columns, header: columns.map((c) => (/[;,"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',') };
}
