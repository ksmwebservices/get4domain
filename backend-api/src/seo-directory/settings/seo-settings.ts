import { DEFAULT_SEO_TEMPLATES, PageTemplate, SEO_PAGE_TYPES, SeoPageType, SeoTemplates } from '../core/default-templates';
import { SEO_PLACEHOLDERS, placeholdersIn } from '../core/template-engine';
import { isUnsafeSeoText } from '../../site-publish/seo/seo-text';

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
