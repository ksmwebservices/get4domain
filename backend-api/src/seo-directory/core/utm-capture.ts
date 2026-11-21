import { TARGET_ID, UTM_TOKEN } from './link-builder';
import { normalizeTargetPath } from './keyword-target';

/**
 * SEO block slice 5: what a directory page visit with UTM parameters is reduced to before anything is stored. Pure. A visit with none of utm_source, utm_medium, utm_campaign or kw is NOT
 * recorded at all (the aggregate is for campaigns, not for traffic counting). A value that is not a short token is dropped, not cleaned into something that looks valid.
 * Stored: the day, the page type, the three tokens and the keyword target id, as a count. Never an address, a user agent, a referrer URL, a business or a visitor.
 */
export interface UtmVisit { pageType: string; source: string; medium: string; campaign: string; keywordKey: string }

const token = (v: unknown): string => { const t = typeof v === 'string' ? v.trim().toLowerCase() : ''; return UTM_TOKEN.test(t) ? t : ''; };

/** The page type of a path. Page 2 and later of a listing are real directory pages: their type is the type of their base page. */
function pageTypeOf(path: unknown): string | null {
  const raw = String(path ?? '').split('#')[0].split('?')[0];
  return normalizeTargetPath(raw.replace(/\/page\/[0-9]{1,4}\/?$/i, ''))?.pageType ?? null;
}

export function utmVisitOf(input: { path?: unknown; utm_source?: unknown; utm_medium?: unknown; utm_campaign?: unknown; kw?: unknown }): UtmVisit | null {
  const pageType = pageTypeOf(input.path);
  if (!pageType) return null;
  const v: UtmVisit = { pageType, source: token(input.utm_source), medium: token(input.utm_medium), campaign: token(input.utm_campaign), keywordKey: typeof input.kw === 'string' && TARGET_ID.test(input.kw) ? input.kw : '' };
  return v.source || v.medium || v.campaign || v.keywordKey ? v : null;
}

/**
 * Bounds how many different (source, medium, campaign, keyword) combinations one process records in a day, so a flood of invented values cannot grow the table without limit. Past the cap a
 * visit is recorded under "other". It is per process and approximate across processes; the beacon is also rate limited per address.
 */
export class UtmCardinalityGuard {
  private day = ''; private seen = new Set<string>();
  constructor(private readonly cap = 2000) {}
  apply(day: string, v: UtmVisit): UtmVisit {
    if (day !== this.day) { this.day = day; this.seen = new Set(); }
    const key = `${v.pageType}|${v.source}|${v.medium}|${v.campaign}|${v.keywordKey}`;
    if (this.seen.has(key)) return v;
    if (this.seen.size < this.cap) { this.seen.add(key); return v; }
    return { pageType: v.pageType, source: 'other', medium: 'other', campaign: 'other', keywordKey: '' };
  }
}
