/**
 * The four AI Studio features and what each accepts (slice 5.11). Pure. Every field is checked for type and length, unknown fields are refused, control characters are removed. What leaves
 * this function is data for the prompt's DATA block, never text for the instruction part.
 */
export const FEATURE_KEYS = ['site_copy', 'seo_suggestion', 'directory_description', 'review_reply'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];
export const isFeatureKey = (k: unknown): k is FeatureKey => (FEATURE_KEYS as readonly unknown[]).includes(k);

export type FeatureInputResult = { ok: true; data: Record<string, string | number> } | { ok: false; problem: string };

const SECTIONS = ['tagline', 'home_intro', 'about', 'service_description', 'faq_answer'];
const SEO_KINDS = ['title', 'description'];
const TONES = ['warm', 'formal'];
const LANGS = ['en', 'ta'];

const clean = (s: string): string => s.replace(/[\r\n\t]+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').replace(/ {2,}/g, ' ').trim();

type Spec = { required: Record<string, 'text' | 'rating' | { oneOf: string[] }>; optional: Record<string, 'text' | { oneOf: string[] }>; max: Record<string, number> };
const SPECS: Record<FeatureKey, Spec> = {
  site_copy: { required: { section: { oneOf: SECTIONS }, businessName: 'text', category: 'text' }, optional: { keyPoints: 'text', language: { oneOf: LANGS } }, max: { businessName: 120, category: 60 } },
  seo_suggestion: { required: { kind: { oneOf: SEO_KINDS }, pageName: 'text', businessName: 'text' }, optional: { city: 'text', keyPoints: 'text', language: { oneOf: LANGS } }, max: { pageName: 60, businessName: 120, city: 60 } },
  directory_description: { required: { businessName: 'text', category: 'text', city: 'text' }, optional: { keyPoints: 'text', language: { oneOf: LANGS } }, max: { businessName: 120, category: 60, city: 60 } },
  review_reply: { required: { reviewText: 'text', rating: 'rating', businessName: 'text' }, optional: { tone: { oneOf: TONES }, language: { oneOf: LANGS } }, max: { reviewText: 1000, businessName: 120 } },
};

export function validateFeatureInput(feature: string, input: unknown, maxFreeTextChars: number): FeatureInputResult {
  if (!isFeatureKey(feature)) return { ok: false, problem: 'unknown feature' };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, problem: 'the input must be an object' };
  const spec = SPECS[feature]; const src = input as Record<string, unknown>; const out: Record<string, string | number> = {};
  for (const k of Object.keys(src)) if (!(k in spec.required) && !(k in spec.optional)) return { ok: false, problem: `unknown field ${k}` };
  const take = (k: string, kind: 'text' | 'rating' | { oneOf: string[] }, required: boolean): string | null => {
    const v = src[k];
    if (v === undefined || v === null || v === '') return required ? `${k} is required` : null;
    if (kind === 'rating') { if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) return `${k} must be a whole number from 1 to 5`; out[k] = v; return null; }
    if (typeof v !== 'string') return `${k} must be text`;
    const t = clean(v);
    if (!t) return required ? `${k} is required` : null;
    if (typeof kind === 'object') { if (!kind.oneOf.includes(t)) return `${k} must be one of ${kind.oneOf.join(', ')}`; out[k] = t; return null; }
    const cap = k === 'keyPoints' ? maxFreeTextChars : (spec.max[k] ?? maxFreeTextChars);   // the free-text hint is capped by the setting; names and pages by their own limits
    if (t.length > cap) return `${k} is too long`;
    out[k] = t; return null;
  };
  for (const [k, kind] of Object.entries(spec.required)) { const p = take(k, kind, true); if (p) return { ok: false, problem: p }; }
  for (const [k, kind] of Object.entries(spec.optional)) { const p = take(k, kind, false); if (p) return { ok: false, problem: p }; }
  if (!('language' in out)) out.language = 'en';
  return { ok: true, data: out };
}
