import { createHash } from 'crypto';
import { MotionLevel } from './site.repository';

/** Limits and small pure helpers shared by the build and publish services (docs/v3/V3_S4_RENDERER_PUBLISH.md sections 6 and 7). */
export const DEFAULT_SITE_BASE = 'get4domain.com';
/** the contract's page budget: a page under 100 KB */
export const PAGE_BUDGET_BYTES = 100 * 1024;
/** layout CSS under 40 KB plus motion CSS under 6 KB */
export const CSS_BUDGET_BYTES = 46 * 1024;

/** Warnings from the renderer that stop a publish (the preview is still stored, so staff can see what is wrong). Everything else is shown, not blocking. */
export const BLOCKING_WARNING = /^(missing-template|unknown-category|missing:host|preset-ignored:invalid)/;

export const sha256 = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex');

/** JSON with sorted keys, so equal data always hashes equally. */
export function stableJson(v: unknown): string {
  const norm = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, y]) => [k, norm(y)]));
    return x;
  };
  return JSON.stringify(norm(v));
}

/** Free sites are at most LOW motion (a platform rule: no plan feature names a motion level); Pro sites may use any. OFF always stays OFF. */
export function clampMotion(m: MotionLevel, level: string | null): MotionLevel {
  if (level === 'PRO') return m;
  return m === 'MEDIUM' || m === 'RICH' ? 'LOW' : m;
}
export const kitMotion = (m: MotionLevel): 'Off' | 'Low' | 'Medium' | 'Rich' => ({ OFF: 'Off', LOW: 'Low', MEDIUM: 'Medium', RICH: 'Rich' } as const)[m];

/** "en", "ta" or "en,ta" -> the languages to build. English is always built (it is the site's root); Tamil only when the plan allows it. */
export function parseLanguages(setting: string | null | undefined, tamilAllowed: boolean): { languages: Array<'en' | 'ta'>; notes: string[] } {
  const wanted = new Set(String(setting ?? 'en').split(',').map((s) => s.trim()).filter((s) => s === 'en' || s === 'ta'));
  const notes: string[] = [];
  const languages: Array<'en' | 'ta'> = ['en'];
  if (wanted.has('ta')) { if (tamilAllowed) languages.push('ta'); else notes.push('language-locked'); }
  return { languages, notes };
}

export const contentTypeFor = (path: string): string => (path.endsWith('.css') ? 'text/css; charset=utf-8' : path.endsWith('.xml') ? 'application/xml; charset=utf-8' : path.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8');
export const isPlatformFile = (path: string): boolean => path === '/sitemap.xml' || path === '/robots.txt' || path.startsWith('/assets/');
