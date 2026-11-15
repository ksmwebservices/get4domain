import { isUnsafeSeoText } from '../../site-publish/seo/seo-text';
import { parseCsv } from './category-keywords';
import { cleanKeyword } from './keyword-text';
import { hasRankingClaim } from './ranking-claims';
import { DESCRIPTION_MAX, H1_MAX, TITLE_MAX } from './template-engine';
import { parsePath } from './url-scheme';

/**
 * SEO block slice 5: keyword targets. A target is "this keyword should lead to this directory page". Pure: no clock, database or network.
 * Rules that hold everywhere below: a path is a directory path at page 1 (never a page 2, a query or a host); every text is checked by the same safety rule as the page templates
 * (no price, no retired product name, no markup); nothing here can promise a ranking, because nothing here states a result, only which page a keyword is aimed at.
 */
export const TARGET_STATUSES = ['PLANNED', 'ACTIVE', 'PAUSED'] as const;
export type TargetStatus = (typeof TARGET_STATUSES)[number];
export const TARGET_SOURCES = ['STAFF', 'PLAN'] as const;
export type TargetSource = (typeof TARGET_SOURCES)[number];
export const COMPETITIONS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type Competition = (typeof COMPETITIONS)[number];
export const MAX_VOLUME = 2_000_000_000;
export const MAX_IMPORT_ROWS = 5000;
export const NOTES_MAX = 300;

export interface TargetInput {
  keyword: string; path: string; pageType: string; status: TargetStatus; priority: number;
  titleOverride: string | null; descriptionOverride: string | null; h1Override: string | null; notes: string | null; source: TargetSource;
  /** average monthly searches and competition: only ever from an imported Keyword Planner file or typed by staff; null = unknown */
  volume: number | null; competition: Competition | null;
}
export interface TargetRow extends TargetInput { id: string; createdAt: Date; updatedAt: Date }
export const targetKey = (keyword: string, path: string): string => `${keyword}\u0000${path}`;

/** The directory path at page 1 and the kind of page it is, or null when the text is not a directory page path. "/chennai/plumbers-in-adyar" is a locality page; "/chennai/plumbers" a city one. */
export function normalizeTargetPath(input: unknown): { path: string; pageType: string } | null {
  const raw = String(input ?? '').trim();
  if (!raw.startsWith('/') || raw.startsWith('//') || /[\s\\]/.test(raw)) return null;
  const clean = raw.split('#')[0].split('?')[0].toLowerCase().replace(/\/+$/, '') || '/';
  const parsed = parsePath(clean);
  if (!parsed || ('page' in parsed && parsed.page !== 1)) return null;
  const pageType = parsed.type === 'cityRest' ? (parsed.rest.includes('-in-') ? 'localityCategory' : 'cityCategory') : parsed.type;
  return { path: clean, pageType };
}

/** A staff-written text for title, description or h1: capped, one line, no markup, no price, no ranking claim. undefined = not given, null = given empty, string = ok, 'INVALID' = refuse. */
export function cleanOverride(v: unknown, max: number): string | null | undefined | 'INVALID' {
  if (v === undefined) return undefined;
  const t = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (t.length > max || /[<>]/.test(t) || isUnsafeSeoText(t) || hasRankingClaim(t)) return 'INVALID';
  return t;
}

const isStatus = (v: unknown): v is TargetStatus => (TARGET_STATUSES as readonly string[]).includes(String(v));
const isSource = (v: unknown): v is TargetSource => (TARGET_SOURCES as readonly string[]).includes(String(v));

/** A search volume from a cell: a whole number (commas and spaces allowed). A range such as "1K - 10K", a decimal, a negative or nothing is NOT a volume: null (never guessed). */
export function parseVolume(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= MAX_VOLUME ? v : null;
  const t = String(v ?? '').replace(/[,\s]/g, '');
  if (!/^\d{1,10}$/.test(t)) return null;
  const n = Number(t); return n <= MAX_VOLUME ? n : null;
}
/** Keyword Planner's words, in any case, as ours; anything else (including its numeric index) is unknown. */
export function parseCompetition(v: unknown): Competition | null { const t = String(v ?? '').trim().toUpperCase(); return (COMPETITIONS as readonly string[]).includes(t) ? (t as Competition) : null; }

export type TargetCheck = { ok: true; value: TargetInput } | { ok: false; problem: string };

/** One target from loosely typed input (a JSON body or a CSV row). Missing optional fields take their defaults. */
export function checkTarget(raw: Record<string, unknown>): TargetCheck {
  const keyword = cleanKeyword(raw.keyword);
  if (!keyword) return { ok: false, problem: 'keyword: is not an acceptable keyword (letters, digits, spaces, hyphens; up to 80; no price or markup)' };
  const p = normalizeTargetPath(raw.path);
  if (!p) return { ok: false, problem: 'path: must be a directory page path at page 1, such as /chennai/plumbers' };
  const status = raw.status === undefined || raw.status === '' ? 'PLANNED' : String(raw.status).toUpperCase();
  if (!isStatus(status)) return { ok: false, problem: `status: must be one of ${TARGET_STATUSES.join(', ')}` };
  const priority = raw.priority === undefined || raw.priority === '' ? 2 : Number(raw.priority);
  if (!Number.isInteger(priority) || priority < 1 || priority > 3) return { ok: false, problem: 'priority: must be 1, 2 or 3 (1 = most important)' };
  const source = raw.source === undefined || raw.source === '' ? 'STAFF' : String(raw.source).toUpperCase();
  if (!isSource(source)) return { ok: false, problem: `source: must be one of ${TARGET_SOURCES.join(', ')}` };
  let volume: number | null = null;
  if (raw.volume !== undefined && raw.volume !== null && String(raw.volume).trim() !== '') { volume = parseVolume(raw.volume); if (volume === null) return { ok: false, problem: 'volume: must be a whole number of searches per month (not a range)' }; }
  let competition: Competition | null = null;
  if (raw.competition !== undefined && raw.competition !== null && String(raw.competition).trim() !== '') { competition = parseCompetition(raw.competition); if (competition === null) return { ok: false, problem: `competition: must be one of ${COMPETITIONS.join(', ')}` }; }
  const out: Array<string | null> = [];
  for (const [field, max] of [['titleOverride', TITLE_MAX], ['descriptionOverride', DESCRIPTION_MAX], ['h1Override', H1_MAX], ['notes', NOTES_MAX]] as const) {
    const c = cleanOverride(raw[field], max);
    if (c === 'INVALID') return { ok: false, problem: `${field}: at most ${max} characters, no markup, no price, no retired product name, no ranking claim` };
    out.push(c ?? null);
  }
  return { ok: true, value: { keyword, path: p.path, pageType: p.pageType, status, priority, titleOverride: out[0], descriptionOverride: out[1], h1Override: out[2], notes: out[3], source, volume, competition } };
}

// ─── CSV ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const TARGET_CSV_COLUMNS = ['keyword', 'path', 'status', 'priority', 'title', 'description', 'h1', 'notes', 'source', 'volume', 'competition'] as const;
const COLUMN_FIELD: Record<(typeof TARGET_CSV_COLUMNS)[number], string> = { keyword: 'keyword', path: 'path', status: 'status', priority: 'priority', title: 'titleOverride', description: 'descriptionOverride', h1: 'h1Override', notes: 'notes', source: 'source', volume: 'volume', competition: 'competition' };

/** One CSV cell. A cell a spreadsheet would run as a formula (= + - @ first) gets a leading apostrophe; quotes, commas and line breaks are quoted. */
export function csvCell(v: unknown): string {
  let t = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
/** The apostrophe csvCell adds is taken off again on the way in, so an export re-imports unchanged. */
const uncell = (t: string): string => t.replace(/^'(?=[=+\-@\t\r])/, '');

export const targetsToCsv = (rows: ReadonlyArray<Pick<TargetInput, 'keyword' | 'path' | 'status' | 'priority' | 'titleOverride' | 'descriptionOverride' | 'h1Override' | 'notes' | 'source'> & Partial<Pick<TargetInput, 'volume' | 'competition'>>>): string =>
  [TARGET_CSV_COLUMNS.join(','), ...rows.map((r) => [r.keyword, r.path, r.status, r.priority, r.titleOverride, r.descriptionOverride, r.h1Override, r.notes, r.source, r.volume ?? null, r.competition ?? null].map(csvCell).join(','))].join('\n') + '\n';

export interface TargetImportPlan {
  create: TargetInput[];
  /** a row that already exists (same keyword and path): only the columns that are filled in the CSV change; a blank cell never clears a value (use the edit route to clear) */
  update: Array<{ id: string; patch: Partial<TargetInput> }>;
  unchanged: number; problems: string[]; total: number;
}

const PATCHABLE = ['status', 'priority', 'titleOverride', 'descriptionOverride', 'h1Override', 'notes', 'source', 'volume', 'competition'] as const;

/** What an import would do. Pure and idempotent: importing the same file twice changes nothing the second time. Any problem in any row blocks the whole apply (the caller checks `problems`). */
export function planTargetImport(csv: string, existing: ReadonlyMap<string, { id: string } & TargetInput>): TargetImportPlan {
  const plan: TargetImportPlan = { create: [], update: [], unchanged: 0, problems: [], total: 0 };
  const rows = parseCsv(csv);
  if (!rows.length) { plan.problems.push('The file is empty.'); return plan; }
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const index = new Map<string, number>(); head.forEach((h, i) => { if (!index.has(h)) index.set(h, i); });
  for (const need of ['keyword', 'path']) if (!index.has(need)) plan.problems.push(`The file needs the columns keyword and path (found: ${head.filter(Boolean).join(', ') || 'none'}).`);
  const unknown = head.filter((h) => h && !(TARGET_CSV_COLUMNS as readonly string[]).includes(h));
  if (unknown.length) plan.problems.push(`Unknown column${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Allowed: ${TARGET_CSV_COLUMNS.join(', ')}.`);
  if (plan.problems.length) return plan;
  const body = rows.slice(1);
  plan.total = body.length;
  if (body.length > MAX_IMPORT_ROWS) { plan.problems.push(`At most ${MAX_IMPORT_ROWS} rows in one import (this file has ${body.length}).`); return plan; }
  const seen = new Set<string>();
  body.forEach((r, n) => {
    const line = n + 2;
    const cell = (c: (typeof TARGET_CSV_COLUMNS)[number]): string | undefined => { const i = index.get(c); return i === undefined ? undefined : uncell((r[i] ?? '').trim()); };
    const raw: Record<string, unknown> = {};
    for (const c of TARGET_CSV_COLUMNS) { const v = cell(c); if (v !== undefined) raw[COLUMN_FIELD[c]] = v; }
    const checked = checkTarget(raw);
    if (!checked.ok) { plan.problems.push(`Row ${line}: ${checked.problem}`); return; }
    const t = checked.value; const key = targetKey(t.keyword, t.path);
    if (seen.has(key)) { plan.problems.push(`Row ${line}: "${t.keyword}" for ${t.path} appears twice.`); return; }
    seen.add(key);
    const have = existing.get(key);
    if (!have) { plan.create.push(t); return; }
    const patch: Partial<TargetInput> = {};
    for (const f of PATCHABLE) {
      const colName = (Object.keys(COLUMN_FIELD) as Array<keyof typeof COLUMN_FIELD>).find((k) => COLUMN_FIELD[k] === f)!;
      const given = cell(colName);
      if (given === undefined || given === '') continue;   // not in the file, or blank: keep what is stored
      if (t[f] !== have[f]) (patch as Record<string, unknown>)[f] = t[f];
    }
    if (Object.keys(patch).length) plan.update.push({ id: have.id, patch }); else plan.unchanged++;
  });
  return plan;
}

/** The override a page uses: the ACTIVE targets of that exact path with any text of their own, the lowest priority number first, then the oldest. null when there is none. */
export function pickOverride(rows: ReadonlyArray<Pick<TargetRow, 'id' | 'status' | 'priority' | 'createdAt' | 'titleOverride' | 'descriptionOverride' | 'h1Override'>>): { id: string; title: string | null; description: string | null; h1: string | null } | null {
  const live = rows.filter((r) => r.status === 'ACTIVE').sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1));
  const top = live[0];
  if (!top) return null;
  // every ACTIVE target names the page, so the click attribution always has an id; the text comes from the best one that has any
  const withText = live.find((r) => r.titleOverride || r.descriptionOverride || r.h1Override) ?? top;
  return { id: top.id, title: withText.titleOverride, description: withText.descriptionOverride, h1: withText.h1Override };
}
