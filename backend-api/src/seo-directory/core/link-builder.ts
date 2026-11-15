import { normalizeTargetPath } from './keyword-target';
import { canonicalOrigin } from './url-scheme';

/**
 * SEO block slice 5: the link builder. A tracked link to a directory page for outreach, a social post or a partner site: the canonical address of the page plus utm_source, utm_medium,
 * utm_campaign and, when the link was built for a keyword target, kw. Pure. The page then reports the visit through the page-visit beacon (utm-capture.ts).
 * The three UTM values are short lower-case tokens (a-z, 0-9, dash, underscore), so a link can never carry free text, a URL or markup into the aggregate.
 */
export const UTM_TOKEN = /^[a-z0-9][a-z0-9_-]{0,29}$/;
export const TARGET_ID = /^[A-Za-z0-9_-]{1,40}$/;

export interface LinkInput { path: string; source: string; medium: string; campaign: string; keywordTargetId?: string | null }
export type LinkResult = { ok: true; url: string; path: string } | { ok: false; problem: string };

export function buildTrackedLink(appUrl: string, i: LinkInput): LinkResult {
  const origin = canonicalOrigin(appUrl);
  if (!origin) return { ok: false, problem: 'The public site address is not set.' };
  const p = normalizeTargetPath(i.path);
  if (!p) return { ok: false, problem: 'path: must be a directory page path at page 1, such as /chennai/plumbers' };
  const tokens = { utm_source: String(i.source ?? '').trim().toLowerCase(), utm_medium: String(i.medium ?? '').trim().toLowerCase(), utm_campaign: String(i.campaign ?? '').trim().toLowerCase() };
  for (const [k, v] of Object.entries(tokens)) if (!UTM_TOKEN.test(v)) return { ok: false, problem: `${k.replace('utm_', '')}: use 1 to 30 lower-case letters, digits, dashes or underscores` };
  const kw = i.keywordTargetId ? String(i.keywordTargetId) : null;
  if (kw !== null && !TARGET_ID.test(kw)) return { ok: false, problem: 'keywordTargetId: is not a keyword target id' };
  const q = new URLSearchParams(tokens);
  if (kw) q.set('kw', kw);
  return { ok: true, path: p.path, url: `${origin}${p.path === '/' ? '/' : p.path}?${q.toString()}` };
}
