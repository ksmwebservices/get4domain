import { DEFAULT_SEO_TEMPLATES, PageTemplate, SEO_PAGE_TYPES, SeoPageType, SeoTemplates } from '../core/default-templates';
import { SEO_PLACEHOLDERS, placeholdersIn } from '../core/template-engine';
import { isUnsafeSeoText } from '../../site-publish/seo/seo-text';
import { hasRankingClaim } from '../core/ranking-claims';

/**
 * Editable SEO settings (stored in g4d_plan_settings). They are NOT registered with the generic plan-settings API (that one is SUPER_ADMIN only); staff edit them through the
 * SEO routes, which allow ADMIN and SUPER_ADMIN and write an audit row.
 */
export const SEO_TEMPLATES_KEY = 'seoPageTemplates';
export const SEO_SETTING_KEYS = [SEO_TEMPLATES_KEY] as const;

const FIELDS = ['title', 'description', 'h1'] as const;
const MAX_CANDIDATES = 6;
const MAX_TEMPLATE_CHARS = 200;

/** null when the templates are acceptable; otherwise the first problem, in words. A partial object is fine: a missing page type or field keeps its default. */
export function seoTemplatesProblem(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'must be an object with one entry per page type';
  const allowed = new Set<string>(SEO_PLACEHOLDERS);
  for (const [type, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!(SEO_PAGE_TYPES as readonly string[]).includes(type)) return `${type}: is not a page type (${SEO_PAGE_TYPES.join(', ')})`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return `${type}: must be an object with title, description and h1`;
    for (const [field, list] of Object.entries(entry as Record<string, unknown>)) {
      if (!(FIELDS as readonly string[]).includes(field)) return `${type}.${field}: is not title, description or h1`;
      if (!Array.isArray(list) || list.length < 1 || list.length > MAX_CANDIDATES) return `${type}.${field}: must be a list of 1 to ${MAX_CANDIDATES} templates, longest first`;
      for (const t of list) {
        if (typeof t !== 'string' || !t.trim()) return `${type}.${field}: every template must be a non-empty text`;
        if (t.length > MAX_TEMPLATE_CHARS) return `${type}.${field}: a template is at most ${MAX_TEMPLATE_CHARS} characters`;
        if (/[<>]/.test(t)) return `${type}.${field}: a template cannot contain markup`;
        const bad = placeholdersIn(t).find((p) => !allowed.has(p));
        if (bad) return `${type}.${field}: {${bad}} is not a placeholder (${SEO_PLACEHOLDERS.join(', ')})`;
        if (isUnsafeSeoText(t)) return `${type}.${field}: a template cannot carry a price or a retired product name`;
        if (hasRankingClaim(t)) return `${type}.${field}: a template cannot claim a rank or a result (best, top, first, guaranteed, rank)`;
      }
    }
  }
  return null;
}

/** The defaults overlaid with the stored templates that pass validation; an invalid stored value is ignored whole, so a bad edit can never blank a title. */
export function resolveSeoTemplates(stored: unknown): SeoTemplates {
  const out = {} as Record<SeoPageType, PageTemplate>;
  const ok = stored !== undefined && stored !== null && seoTemplatesProblem(stored) === null ? (stored as Partial<Record<SeoPageType, Partial<PageTemplate>>>) : {};
  for (const t of SEO_PAGE_TYPES) out[t] = { ...DEFAULT_SEO_TEMPLATES[t], ...(ok[t] ?? {}) } as PageTemplate;
  return out;
}

// ─── the crawler list (SEO block slice 4; the vendor site robots.txt of slice 6 reads it too) ────────────────────────────────────────────────────────
export const SEO_CRAWLERS_KEY = 'seoCrawlerAgents';
export const MAX_CRAWLERS = 60;
/** Search and AI crawlers named explicitly, each with Allow: /. Editable by SUPER_ADMIN only. */
export const DEFAULT_SEO_CRAWLERS: readonly string[] = [
  'Googlebot', 'Bingbot', 'DuckDuckBot', 'Applebot', 'YandexBot', 'Baiduspider', 'facebookexternalhit', 'Twitterbot', 'LinkedInBot', 'WhatsApp', 'Slackbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Amazonbot', 'Meta-ExternalAgent', 'DuckAssistBot', 'cohere-ai',
];
const AGENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

export function seoCrawlersProblem(value: unknown): string | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_CRAWLERS) return `must be a list of 1 to ${MAX_CRAWLERS} crawler names`;
  const seen = new Set<string>();
  for (const v of value) {
    if (typeof v !== 'string' || !AGENT.test(v)) return `"${String(v).slice(0, 40)}" is not a crawler name (letters, digits, dot, dash, underscore; up to 40)`;
    if (v === '*') return 'the catch-all group is always written; do not list it';
    if (seen.has(v.toLowerCase())) return `"${v}" is listed twice`;
    seen.add(v.toLowerCase());
  }
  return null;
}
/** The stored list when it passes validation, else the default list (a bad stored value is ignored whole). */
export const resolveSeoCrawlers = (stored: unknown): string[] => (stored !== undefined && stored !== null && seoCrawlersProblem(stored) === null ? [...(stored as string[])] : [...DEFAULT_SEO_CRAWLERS]);

// ─── research modifiers (prompt 8d) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const SEO_MODIFIERS_KEY = 'seoKeywordModifiers';
export const MAX_MODIFIERS = 20;
/** The words and phrases the keyword research combines with a keyword and a place. RESEARCH ONLY: they are never written into a page title or description. "best" is allowed here and nowhere else. */
export const DEFAULT_SEO_MODIFIERS: readonly string[] = ['best', 'top', 'near me', '24 hours', 'in {locality}', 'services'];
const MODIFIER = /^[a-z0-9][a-z0-9 '&{}-]{0,39}$/;

export function seoModifiersProblem(value: unknown): string | null {
  if (!Array.isArray(value) || value.length > MAX_MODIFIERS) return `must be a list of at most ${MAX_MODIFIERS} modifiers`;
  const seen = new Set<string>();
  for (const v of value) {
    if (typeof v !== 'string' || !MODIFIER.test(v)) return `"${String(v).slice(0, 40)}" is not a modifier (lower case letters, digits, spaces, hyphen, ampersand, apostrophe; up to 40)`;
    const braces = v.match(/\{[^}]*\}|[{}]/g) ?? [];
    if (braces.some((b) => b !== '{locality}')) return `"${v}": the only placeholder allowed is {locality}`;
    if (isUnsafeSeoText(v)) return `"${v}": a modifier cannot carry a price or a retired product name`;
    if (seen.has(v)) return `"${v}" is listed twice`;
    seen.add(v);
  }
  return null;
}
/** The stored list when it passes validation (an empty list is valid: no modifiers), else the defaults; a bad stored value is ignored whole. */
export const resolveSeoModifiers = (stored: unknown): string[] => (stored !== undefined && stored !== null && seoModifiersProblem(stored) === null ? [...(stored as string[])] : [...DEFAULT_SEO_MODIFIERS]);
