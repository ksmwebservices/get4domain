import { isUnsafeSeoText } from '../../site-publish/seo/seo-text';
import { hasRankingClaim } from './ranking-claims';

/**
 * SEO block slice 5: the backlink block a vendor site (or partner page) shows: ONE brand link to the directory, and up to FOUR directory links whose anchor text rotates. Pure.
 *   - which links: the vendor's own city + category page, then its locality + category page, then its category page, then its city page; only pages that are LISTED (in the sitemap list),
 *     and none at all while the directory pages are not indexable (a link to a noindex page does nothing for anyone);
 *   - rotation: each link has several honest wordings; the one shown is chosen by a stable hash of the business id (and an optional period), so a page does not change wording on every render
 *     but two businesses in the same city do not all use the same words;
 *   - no ranking promise in any anchor (ranking-claims.ts), no price, no markup.
 */
export const MAX_DIRECTORY_LINKS = 4;
export interface BacklinkPage { kind: 'cityCategory' | 'localityCategory' | 'category' | 'city'; path: string; place?: string; city?: string; plural?: string; singular?: string }
export interface BacklinkLink { href: string; text: string }
export interface BacklinkBlock { brand: BacklinkLink; links: BacklinkLink[]; html: string }

const ANCHORS: Record<BacklinkPage['kind'], string[]> = {
  cityCategory: ['{plural} in {place}', '{place} {plural}', 'Find a {singular} in {place}', '{singular} directory for {place}'],
  localityCategory: ['{plural} in {place}', '{place} {plural}', '{singular} in {place}, {city}', 'Find a {singular} in {place}'],
  category: ['{plural}', '{singular} directory', 'More {plural}', '{plural} on Get4Domain'],
  city: ['Businesses in {place}', '{place} business directory', 'Local businesses in {place}'],
};
const ORDER: BacklinkPage['kind'][] = ['cityCategory', 'localityCategory', 'category', 'city'];

/** FNV-1a, 32 bit: small, stable across runtimes, and nothing here needs to be secret. */
export function stableHash(s: string): number { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (t: string, p: BacklinkPage): string | null => {
  let missing = false;
  const out = t.replace(/\{(place|city|plural|singular)\}/g, (_m, k: string) => { const v = (p as unknown as Record<string, string | undefined>)[k] ?? ''; if (!v) missing = true; return v; });
  return missing ? null : out.replace(/\s+/g, ' ').trim();
};

/** The anchor texts one page could carry, in rotation order, with any that would be unsafe or claim a rank removed. */
export function anchorCandidates(p: BacklinkPage): string[] { return ANCHORS[p.kind].map((t) => fill(t, p)).filter((x): x is string => !!x && !isUnsafeSeoText(x) && !hasRankingClaim(x)); }

export function buildBacklinkBlock(o: { origin: string; seed: string; period?: string; pages: readonly BacklinkPage[]; listed: ReadonlySet<string> | null; indexable: boolean }): BacklinkBlock {
  const brand: BacklinkLink = { href: `${o.origin}/`, text: 'Get4Domain' };
  const links: BacklinkLink[] = [];
  if (o.indexable && o.origin) {
    const used = new Set<string>();
    for (const kind of ORDER) {
      for (const p of o.pages.filter((x) => x.kind === kind)) {
        if (links.length >= MAX_DIRECTORY_LINKS) break;
        if (used.has(p.path) || (o.listed && !o.listed.has(p.path))) continue;
        const cands = anchorCandidates(p);
        if (!cands.length) continue;
        used.add(p.path);
        links.push({ href: `${o.origin}${p.path}`, text: cands[stableHash(`${o.seed}|${o.period ?? ''}|${p.path}`) % cands.length] });
      }
    }
  }
  return { brand, links, html: backlinkHtml(brand, links) };
}

/** The block as HTML a theme or partner can drop in. Every value is escaped; no script, no style, no tracking. */
export function backlinkHtml(brand: BacklinkLink, links: readonly BacklinkLink[]): string {
  const a = (l: BacklinkLink): string => `<a href="${esc(l.href)}" rel="noopener">${esc(l.text)}</a>`;
  return `<p class="g4d-backlinks">Listed on ${a(brand)}${links.length ? ` &middot; ${links.map(a).join(' &middot; ')}` : ''}</p>`;
}
