import { cutAtWord } from '../../site-publish/seo/seo-text';
import { checkWording } from './wording-core';

/**
 * Per-page SEO (slice B1, amendment 08), pure. A vendor writes at most three things per page: a title (up to 60 characters), a description (up to 160) and a share picture that is one of
 * the site's own pictures. Everything else the platform writes (canonical, robots, hreflang, structured data, Open Graph) stays automatic and locked. Defaults are made from the business name,
 * the city and the category label only: no claim is ever invented. The wording check (promises of results or ranking, a price, a retired product name) runs on every text.
 */
export interface PageSeoEdit { seoTitle?: string; seoDescription?: string; shareImageRef?: string }
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;
/** a description under this is flagged in staff reports (the generated descriptions the platform builds use the same floor) */
export const SEO_DESCRIPTION_FLOOR = 50;

export type SeoFail = { ok: false; code: string; message: string; field: string };
const fail = (code: string, message: string, field: string): SeoFail => ({ ok: false, code, message, field });

const KEY = /^(?:home|about|services|gallery|contact|page:[a-z0-9]+(?:-[a-z0-9]+)*|item:[A-Za-z0-9_-]{1,64})$/;
export const isPageKey = (k: unknown): k is string => typeof k === 'string' && k.length <= 80 && KEY.test(k);

const EDITABLE = ['seoTitle', 'seoDescription', 'shareImageRef'] as const;
const CONTROL = /[\u0000-\u001F\u007F]/;

function httpsUrl(v: string): boolean {
  if (v.length > 500 || /\s/.test(v)) return false;
  try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.'); } catch { return false; }
}

/** `allowedImages`: the picture links the site already owns (gallery images and uploaded pictures). */
export function validatePageSeo(input: unknown, allowedImages: readonly string[]): { ok: true; edit: PageSeoEdit } | SeoFail {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('FIELD_INVALID', 'Send the page SEO as an object.', 'seo');
  const i = input as Record<string, unknown>;
  for (const k of Object.keys(i)) if (!(EDITABLE as readonly string[]).includes(k)) return fail('FIELD_LOCKED', 'That part of the page is written by the platform and cannot be edited.', k);
  const edit: PageSeoEdit = {};
  for (const [k, max] of [['seoTitle', SEO_TITLE_MAX], ['seoDescription', SEO_DESCRIPTION_MAX]] as const) {
    if (i[k] === undefined || i[k] === null) continue;
    if (typeof i[k] !== 'string') return fail('FIELD_INVALID', 'That value must be text.', k);
    const v = (i[k] as string).trim();
    if (v.length > max) return fail('FIELD_INVALID', `That text is longer than ${max} characters.`, k);
    if (/[<>]/.test(v) || CONTROL.test(v)) return fail('FIELD_INVALID', 'Use plain text without < or > characters.', k);
    if (v === '') continue;
    if (!checkWording(v, { strict: true }).ok) return fail('WORDING_NOT_ALLOWED', 'That text promises results or a ranking, or carries a price or a retired product name. Say what you do instead.', k);
    edit[k] = v;
  }
  if (i.shareImageRef !== undefined && i.shareImageRef !== null) {
    if (typeof i.shareImageRef !== 'string') return fail('FIELD_INVALID', 'That value must be a link.', 'shareImageRef');
    const v = i.shareImageRef.trim();
    if (v !== '') {
      if (!httpsUrl(v)) return fail('FIELD_INVALID', 'Enter a full link that starts with https://.', 'shareImageRef');
      if (!allowedImages.includes(v)) return fail('IMAGE_NOT_ALLOWED', 'Choose a picture from your gallery or your uploaded pictures.', 'shareImageRef');
      edit.shareImageRef = v;
    }
  }
  return { ok: true, edit };
}

export interface SeoWho { businessName: string; city: string; categoryLabel: string }
const squash = (s: string): string => s.replace(/\s+/g, ' ').replace(/\s+([.,])/g, '$1').trim();
const words = (slug: string): string => slug.split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** What a page shows until the vendor writes its own. Built only from the name, the city and the category label. */
export function defaultPageSeo(pageKey: string, w: SeoWho): { seoTitle: string; seoDescription: string } {
  const name = squash(w.businessName); const label = squash(w.categoryLabel); const where = w.city.trim() ? ` in ${squash(w.city)}` : '';
  const base = `${label}${where}`;
  const t = (s: string): string => cutAtWord(squash(s), SEO_TITLE_MAX);
  const d = (s: string): string => cutAtWord(squash(s), SEO_DESCRIPTION_MAX);
  if (pageKey === 'about') return { seoTitle: t(`About ${name}`), seoDescription: d(`About ${name}, ${base}.`) };
  if (pageKey === 'services') return { seoTitle: t(`Services | ${name}`), seoDescription: d(`The services offered by ${name}, ${base}.`) };
  if (pageKey === 'gallery') return { seoTitle: t(`Gallery | ${name}`), seoDescription: d(`Photos from ${name}, ${base}.`) };
  if (pageKey === 'contact') return { seoTitle: t(`Contact ${name}`), seoDescription: d(`How to contact ${name}, ${base}.`) };
  if (pageKey.startsWith('page:')) return { seoTitle: t(`${words(pageKey.slice(5))} | ${name}`), seoDescription: d(`${words(pageKey.slice(5))} from ${name}, ${base}.`) };
  if (pageKey.startsWith('item:')) return { seoTitle: t(`Service details | ${name}`), seoDescription: d(`Details of a service offered by ${name}, ${base}.`) };
  return { seoTitle: t(`${name} | ${label}`), seoDescription: d(`${name} is a ${label}${where}.`) };
}

export interface SeoRow { pageKey: string; seoTitle: string; seoDescription: string; customTitle: boolean; customDescription: boolean }
export interface SeoIssue { pageKey: string; issue: 'DEFAULT_TITLE' | 'DEFAULT_DESCRIPTION' | 'DUPLICATE_TITLE' | 'SHORT_DESCRIPTION' }

/** For staff reports: pages still on a default, pages that share a title, and descriptions below the floor. */
export function seoIssues(rows: readonly SeoRow[]): SeoIssue[] {
  const out: SeoIssue[] = []; const byTitle = new Map<string, number>();
  for (const r of rows) byTitle.set(r.seoTitle.toLowerCase(), (byTitle.get(r.seoTitle.toLowerCase()) ?? 0) + 1);
  for (const r of rows) {
    if (!r.customTitle) out.push({ pageKey: r.pageKey, issue: 'DEFAULT_TITLE' });
    if (!r.customDescription) out.push({ pageKey: r.pageKey, issue: 'DEFAULT_DESCRIPTION' });
    if ((byTitle.get(r.seoTitle.toLowerCase()) ?? 0) > 1) out.push({ pageKey: r.pageKey, issue: 'DUPLICATE_TITLE' });
    if (r.seoDescription.length < SEO_DESCRIPTION_FLOOR) out.push({ pageKey: r.pageKey, issue: 'SHORT_DESCRIPTION' });
  }
  return out;
}
