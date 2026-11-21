import { parseCsv } from './category-keywords';
import { Competition, parseCompetition, parseVolume, TargetInput, TargetRow } from './keyword-target';
import { cleanKeyword } from './keyword-text';
import { ResearchRow } from './keyword-research';

/**
 * SEO block (prompt 8d): reading back a Keyword Planner export (saved as CSV) into keyword targets. Pure. No scraping and no invented numbers: a row only counts when it carries a whole
 * number of monthly searches (a range such as "1K - 10K", a blank or a decimal is skipped and listed); competition is Low, Medium or High or nothing. A keyword that is neither a target nor
 * one of OUR research keywords is ignored (it is not ours, so it maps to no page).
 */
export interface VolumeRow { keyword: string; volume: number; competition: Competition | null }
export interface VolumeFile { rows: VolumeRow[]; /** `row` counts the file's non-blank rows from the first (a title line above the header counts) */
  skipped: Array<{ row: number; keyword: string; reason: string }>; problems: string[]; total: number; duplicates: number }
export const MAX_VOLUME_ROWS = 50_000;
export const MAX_REPORTED = 50;
const KEYWORD_HEADS = ['keyword', 'keywords'];
const VOLUME_HEADS = ['avg. monthly searches', 'avg monthly searches', 'avg. monthly searches (volume)', 'monthly search volume', 'monthly searches', 'search volume', 'volume'];
const COMPETITION_HEADS = ['competition'];

export function parseVolumeCsv(csv: string): VolumeFile {
  const out: VolumeFile = { rows: [], skipped: [], problems: [], total: 0, duplicates: 0 };
  const rows = parseCsv(csv);
  // Keyword Planner puts a title line or two above the header, so the header is the first of the opening rows that names a keyword column
  const at = rows.slice(0, 10).findIndex((r) => r.some((c) => KEYWORD_HEADS.includes(c.trim().toLowerCase())));
  if (at < 0) { out.problems.push('No header row with a Keyword column was found in the first 10 rows.'); return out; }
  const head = rows[at].map((h) => h.trim().toLowerCase());
  const col = (names: readonly string[]): number => head.findIndex((h) => names.includes(h));
  const [iK, iV, iC] = [col(KEYWORD_HEADS), col(VOLUME_HEADS), col(COMPETITION_HEADS)];
  if (iV < 0) { out.problems.push(`No monthly searches column was found (looked for: ${VOLUME_HEADS.slice(0, 4).join(', ')}).`); return out; }
  const body = rows.slice(at + 1); out.total = body.length;
  if (body.length > MAX_VOLUME_ROWS) { out.problems.push(`At most ${MAX_VOLUME_ROWS} rows in one import (this file has ${body.length}).`); return out; }
  const byKeyword = new Map<string, VolumeRow>();
  body.forEach((r, n) => {
    const row = at + n + 2; const raw = (r[iK] ?? '').trim();
    const skip = (reason: string): void => { if (out.skipped.length < MAX_REPORTED) out.skipped.push({ row, keyword: raw.slice(0, 60), reason }); };
    const keyword = cleanKeyword(raw);
    if (!keyword) { skip('not an acceptable keyword'); return; }
    const volume = parseVolume(r[iV] ?? '');
    if (volume === null) { skip('no whole number of monthly searches (a range or a blank is not a volume)'); return; }
    if (byKeyword.has(keyword)) out.duplicates++;
    byKeyword.set(keyword, { keyword, volume, competition: iC >= 0 ? parseCompetition(r[iC] ?? '') : null });   // a repeated keyword: the later row wins
  });
  out.rows = [...byKeyword.values()];
  return out;
}

export interface VolumePlan {
  update: Array<{ id: string; patch: Partial<TargetInput> }>; create: TargetInput[]; unchanged: number;
  /** keywords in the file that are not ours: neither a target nor a research keyword (first 50 listed) */
  unmatched: string[]; unmatchedCount: number;
}

/**
 * What an import would do. A keyword that is already a target gets the volume (and competition when the file has one) on every target of that keyword. A keyword that is one of OUR
 * research keywords but not yet a target becomes PLANNED targets (source PLAN) for the pages it maps to, so the research list never has to be imported whole first; a volume of 0 does not
 * create a target (nothing to prioritise). Anything else is unmatched.
 */
export function planVolumeImport(file: readonly VolumeRow[], targets: readonly TargetRow[], research: ReadonlyMap<string, readonly ResearchRow[]>): VolumePlan {
  const byKeyword = new Map<string, TargetRow[]>();
  for (const t of targets) byKeyword.set(t.keyword, [...(byKeyword.get(t.keyword) ?? []), t]);
  const plan: VolumePlan = { update: [], create: [], unchanged: 0, unmatched: [], unmatchedCount: 0 };
  for (const v of file) {
    const have = byKeyword.get(v.keyword);
    if (have?.length) {
      for (const t of have) {
        const patch: Partial<TargetInput> = {};
        if (t.volume !== v.volume) patch.volume = v.volume;
        if (v.competition && t.competition !== v.competition) patch.competition = v.competition;
        if (Object.keys(patch).length) plan.update.push({ id: t.id, patch }); else plan.unchanged++;
      }
      continue;
    }
    const ours = research.get(v.keyword);
    if (ours?.length) {
      if (v.volume > 0) for (const r of ours.slice(0, 5)) plan.create.push({ keyword: v.keyword, path: r.path, pageType: pageTypeOfPath(r.path), status: 'PLANNED', priority: r.kind === 'place' ? 1 : 2, titleOverride: null, descriptionOverride: null, h1Override: null, notes: null, source: 'PLAN', volume: v.volume, competition: v.competition });
    } else { plan.unmatchedCount++; if (plan.unmatched.length < MAX_REPORTED) plan.unmatched.push(v.keyword); }
  }
  return plan;
}

function pageTypeOfPath(path: string): string {
  if (path.startsWith('/business/')) return 'business';
  if (path.startsWith('/category/')) return 'category';
  if (path.startsWith('/pincode/')) return 'pincodeCategory';
  const parts = path.split('/').filter(Boolean);
  return parts.length === 2 ? (parts[1].includes('-in-') ? 'localityCategory' : 'cityCategory') : 'city';
}
