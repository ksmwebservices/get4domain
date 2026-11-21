import { checkWording } from './wording-core';
import { RASTER_TYPES, WebsiteSettings } from '../settings/website-settings';

/**
 * Media and the Banner Library (slice 5.5b), pure: what an upload must satisfy, alt text, per-vendor storage paths, the banner manifest, the loader plan and
 * the regulated-category rule. Nothing here reads a file, a clock or a database; the loader and the services pass everything in.
 */
export type Fail = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Fail => ({ ok: false, code, message });

const LABEL: Readonly<Record<string, string>> = { 'image/jpg': 'image/jpeg' };
const EXT: Readonly<Record<string, string>> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const extFor = (type: string): string => EXT[type] ?? 'bin';

/** Null when the upload is acceptable. The detected type is what the BYTES say; the declared type is what the client claimed. */
export function checkUpload(s: Pick<WebsiteSettings, 'mediaMaxBytes' | 'mediaAllowedTypes' | 'mediaMaxPixels'>, u: { size: number; declared: string; detected: string | null }): Fail | null {
  if (s.mediaMaxBytes === null || s.mediaAllowedTypes === null || s.mediaMaxPixels === null) return fail('MEDIA_NOT_CONFIGURED', 'Picture uploads are not switched on yet.');
  if (!Number.isFinite(u.size) || u.size <= 0) return fail('MEDIA_INVALID', 'No picture was received.');
  if (u.size > s.mediaMaxBytes) return fail('MEDIA_TOO_LARGE', 'That picture is too large.');
  if (!u.detected || !(RASTER_TYPES as readonly string[]).includes(u.detected) || !s.mediaAllowedTypes.includes(u.detected)) return fail('MEDIA_TYPE_NOT_ALLOWED', 'That kind of picture is not accepted.');
  if ((LABEL[u.declared] ?? u.declared) !== u.detected) return fail('MEDIA_TYPE_MISMATCH', 'The file is not the kind of picture its name says.');
  return null;
}

/** Alt text is required for every image, plain text, up to 160 characters, and free of promises. */
export function checkAlt(alt: unknown): { ok: true; alt: string } | Fail {
  const a = typeof alt === 'string' ? alt.trim() : '';
  if (!a) return fail('ALT_REQUIRED', 'Describe the picture for people who cannot see it.');
  if (a.length > 160 || /[<>]/.test(a) || /[\u0000-\u001F\u007F]/.test(a)) return fail('FIELD_INVALID', 'The picture description is 1 to 160 characters of plain text.');
  if (!checkWording(a, { strict: false }).ok) return fail('WORDING_NOT_ALLOWED', 'That description promises results or a ranking.');
  return { ok: true, alt: a };
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** vendors/<vendorId>/media/<sha256>.<ext>: one folder per vendor, the file named by its content. */
export function storagePathFor(vendorId: string, sha256: string, type: string): string {
  if (!SAFE_ID.test(vendorId) || !/^[a-f0-9]{6,64}$/.test(sha256)) throw new Error('unsafe storage path input');
  return `vendors/${vendorId}/media/${sha256}.${extFor(type)}`;
}

// ── banner manifest ─────────────────────────────────────────────────────────────────────────────────

export interface ManifestRow { file: string; sourceUrl: string; author: string; licence: string; obtainedOn: string; category: string; alt: string; hasPeople: boolean }

const isDate = (s: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= days;
};
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Every image needs every field. `today` (YYYY-MM-DD) is passed in so this stays pure; the date obtained cannot be in the future. */
export function validateManifest(json: unknown, knownCategories: readonly string[], today: string): { rows: ManifestRow[]; errors: string[] } {
  const errors: string[] = []; const rows: ManifestRow[] = [];
  if (!Array.isArray(json)) return { rows, errors: ['The manifest must be a list with one row per image.'] };
  const seen = new Set<string>();
  json.forEach((r, i) => {
    const w = `row ${i + 1}`;
    if (!r || typeof r !== 'object') { errors.push(`${w}: is not an object`); return; }
    const o = r as Record<string, unknown>;
    const row = { file: text(o.file), sourceUrl: text(o.sourceUrl), author: text(o.author), licence: text(o.licence), obtainedOn: text(o.obtainedOn), category: text(o.category), alt: text(o.alt), hasPeople: o.hasPeople };
    for (const k of ['file', 'sourceUrl', 'author', 'licence', 'obtainedOn', 'category', 'alt'] as const) if (!row[k]) errors.push(`${w}: ${k} is required`);
    if (typeof row.hasPeople !== 'boolean') errors.push(`${w}: hasPeople must be true or false`);
    if (row.file && (/[\\/]/.test(row.file) || row.file.includes('..'))) errors.push(`${w}: file must be a plain file name`);
    if (row.file && seen.has(row.file)) errors.push(`${w}: ${row.file} appears twice`);
    seen.add(row.file);
    if (row.sourceUrl && !/^https:\/\/[^\s]+\.[^\s]+$/.test(row.sourceUrl)) errors.push(`${w}: sourceUrl must be an https link`);
    if (row.category && !knownCategories.includes(row.category)) errors.push(`${w}: category ${row.category} is not a known category`);
    if (row.obtainedOn && (!isDate(row.obtainedOn) || row.obtainedOn > today)) errors.push(`${w}: obtainedOn must be a real date, not in the future`);
    if (row.alt && (row.alt.length > 160 || /[<>]/.test(row.alt))) errors.push(`${w}: alt is 1 to 160 characters of plain text`);
    if (!errors.some((e) => e.startsWith(`${w}:`))) rows.push({ ...row, hasPeople: row.hasPeople as boolean });
  });
  return { rows, errors };
}

export interface ExistingBanner { categoryId: string; sha256: string; author: string; licenceName: string; sourceUrl: string; obtainedOn: string; altText: string; hasPeople: boolean }
export interface LoadPlan {
  create: Array<{ file: string; sha256: string; row: ManifestRow }>;
  update: Array<{ file: string; sha256: string; row: ManifestRow }>;
  unchanged: Array<{ file: string }>;
  /** a file in the folder with no manifest row: never loaded */
  refused: Array<{ file: string; reason: 'NO_MANIFEST_ROW' }>;
  /** a manifest row with no file in the folder: reported, nothing to load */
  rowsWithoutFile: string[];
}

/** What the loader would do. A file with no manifest row is REFUSED; a file already loaded for its category is unchanged unless its licence data changed (then an update). */
export function planBannerLoad(files: ReadonlyArray<{ name: string; sha256: string }>, rows: readonly ManifestRow[], existing: readonly ExistingBanner[]): LoadPlan {
  const byFile = new Map(rows.map((r) => [r.file, r]));
  const plan: LoadPlan = { create: [], update: [], unchanged: [], refused: [], rowsWithoutFile: [] };
  for (const f of files) {
    const row = byFile.get(f.name);
    if (!row) { plan.refused.push({ file: f.name, reason: 'NO_MANIFEST_ROW' }); continue; }
    const have = existing.find((e) => e.categoryId === row.category && e.sha256 === f.sha256);
    if (!have) plan.create.push({ file: f.name, sha256: f.sha256, row });
    else if (have.author !== row.author || have.licenceName !== row.licence || have.sourceUrl !== row.sourceUrl || have.obtainedOn !== row.obtainedOn || have.altText !== row.alt || have.hasPeople !== row.hasPeople) plan.update.push({ file: f.name, sha256: f.sha256, row });
    else plan.unchanged.push({ file: f.name });
  }
  const present = new Set(files.map((f) => f.name));
  plan.rowsWithoutFile = rows.filter((r) => !present.has(r.file)).map((r) => r.file);
  return plan;
}

// ── choosing a banner ───────────────────────────────────────────────────────────────────────────────

/** Owner decision: healthcare and legal-finance (the kit's families for healthcare, legal and finance) default to banners without identifiable people. */
const REGULATED_FAMILIES: ReadonlySet<string> = new Set(['healthcare', 'legal-finance']);
export const isRegulatedFamily = (family: string | null | undefined): boolean => !!family && REGULATED_FAMILIES.has(family);

export function bannerChoices<T extends { categoryId: string; hasPeople: boolean; active: boolean }>(all: readonly T[], who: { categoryId: string; family: string | null }, o: { includePeople?: boolean } = {}): T[] {
  const hidePeople = isRegulatedFamily(who.family) && o.includePeople !== true;
  return all.filter((b) => b.active && b.categoryId === who.categoryId && !(hidePeople && b.hasPeople));
}
