import { createHash, randomBytes } from 'crypto';

/** Pure helpers of slice 5.7b (directory visits). No clock, randomness source or database is read here: the caller passes them in. */

/** The counter day: the UTC calendar day, as YYYY-MM-DD. */
export function dayOf(d: Date): string { return d.toISOString().slice(0, 10); }

/** The inclusive list of days from `from` to `to` (both YYYY-MM-DD). At most 400 days, so a bad range cannot build a huge list. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const a = Date.parse(`${from}T00:00:00.000Z`); const b = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return out;
  for (let t = a; t <= b && out.length < 400; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** An opaque, unguessable reference (24 random bytes, URL safe). */
export function newVisitRef(rand: (n: number) => Buffer = randomBytes): string { return rand(24).toString('base64url'); }
/** Only this hash is stored; the reference itself exists only in the visitor's link. */
export function hashVisitRef(ref: string): string { return createHash('sha256').update(`visit-ref:${ref}`).digest('hex'); }
/** A reference has the shape we issue (so nonsense is refused before any lookup). */
export function looksLikeVisitRef(ref: unknown): ref is string { return typeof ref === 'string' && /^[A-Za-z0-9_-]{32}$/.test(ref); }

/** The Visit link: the business's own site address plus the attribution parameters. */
export function visitUrl(siteUrl: string, ref: string): string { return `${siteUrl}${siteUrl.includes('?') ? '&' : '?'}src=dir&ref=${encodeURIComponent(ref)}`; }

/** One bucket per (visitor network, business, day): the key the in-memory dedupe uses. The raw address is hashed with a keyed hash before it gets here; nothing is stored. */
export function dedupeKey(ipHash: string | null, businessId: string, day: string): string { return `${ipHash ?? 'noip'}|${businessId}|${day}`; }

export interface DayCount { day: string; count: number; searchCount: number }
/** Fills the missing days with zeros so a chart has a point for every day, and adds the totals. */
export function fillDays(rows: readonly DayCount[], from: string, to: string): { days: DayCount[]; total: number; searchTotal: number } {
  const by = new Map(rows.map((r) => [r.day, r]));
  const days = daysBetween(from, to).map((d) => by.get(d) ?? { day: d, count: 0, searchCount: 0 });
  return { days, total: days.reduce((n, d) => n + d.count, 0), searchTotal: days.reduce((n, d) => n + d.searchCount, 0) };
}

export type SiteState = 'SEEDED' | 'CLAIMED_FREE' | 'PRO';
export interface SiteFacts { subdomain: string | null; proActive: boolean }
/**
 * What the directory shows about the business's own site. The Visit link always goes to the SUBDOMAIN (owner rule 1 and 4). SEEDED = nobody has claimed the page yet; CLAIMED_FREE = claimed,
 * on the Free plan (or Pro lapsed); PRO = claimed with a running paid plan.
 */
export function siteStateOf(status: string, f: SiteFacts | null): SiteState {
  if (status !== 'CLAIMED') return 'SEEDED';
  return f?.proActive ? 'PRO' : 'CLAIMED_FREE';
}
export function badgesOf(status: string, f: SiteFacts | null): string[] { return status === 'CLAIMED' && f?.proActive ? ['VERIFIED'] : []; }
export function siteUrlOf(f: SiteFacts | null, baseDomain: string): string | null { return f?.subdomain ? `https://${f.subdomain}.${baseDomain}` : null; }
