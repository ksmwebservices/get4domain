import { cutAtWord, isUnsafeSeoText } from './seo-text';

/**
 * The llms.txt of ONE vendor site (prompt 6d), written at publish from stored public facts only. Pure. Rules:
 *  - only what the site already shows: its name, category, address and area, its services and its pages with the one-line text the page already carries; phone, email and opening hours only when the
 *    plan lets the site show them (the caller passes `contactVisible`), so a Free site never says more than the Free site does;
 *  - never a price, a rating, an offer, a retired product name or anything private: a line that carries a price or a banned word is dropped, not edited;
 *  - a site that is not indexable gets no file at all (the caller does not call this);
 *  - links are absolute and stay on the site's own host.
 */
export interface LlmsSiteInput {
  siteName: string; categoryLabel: string; tagline?: string; city: string; locality?: string; address?: string;
  /** phone, email and hours are written only when true (Pro) and only when the vendor entered them */
  contactVisible: boolean; phone?: string; email?: string; hours?: string;
  services: Array<{ name: string; description?: string }>;
  pages: Array<{ title: string; description: string; url: string }>;
  siteUrl: string; sitemapUrl: string;
}
export const LLMS_MAX_SERVICES = 30;
export const LLMS_MAX_PAGES = 40;

const one = (s: unknown, max: number): string => cutAtWord(String(s ?? '').replace(/\s+/g, ' ').replace(/[<>\[\]]/g, '').trim(), max);
const safe = (s: string): string => (s && !isUnsafeSeoText(s) ? s : '');
const onHost = (url: string, siteUrl: string): boolean => { try { return new URL(url).host === new URL(siteUrl).host; } catch { return false; } };

export function buildLlmsTxt(i: LlmsSiteInput): string {
  const name = safe(one(i.siteName, 80)) || 'This business';
  const where = [safe(one(i.locality, 60)), safe(one(i.city, 60))].filter(Boolean).join(', ');
  const category = safe(one(i.categoryLabel, 60));
  const lines: string[] = [`# ${name}`, ''];
  const summary = category ? `${name} is a ${category.toLowerCase()}${where ? ` in ${where}` : ''}.` : '';
  if (summary) lines.push(`> ${summary}`, '');
  const tagline = safe(one(i.tagline, 160)); if (tagline) lines.push(tagline, '');
  const facts: string[] = [];
  if (category) facts.push(`- Category: ${category}`);
  const address = safe(one(i.address, 200)); if (address) facts.push(`- Address: ${address}`);
  if (where) facts.push(`- Area: ${where}`);
  if (i.contactVisible) {
    const hours = safe(one(i.hours, 160)); if (hours) facts.push(`- Opening hours: ${hours}`);
    const phone = safe(one(i.phone, 30)); if (phone) facts.push(`- Phone: ${phone}`);
    const email = safe(one(i.email, 100)); if (email) facts.push(`- Email: ${email}`);
  }
  if (facts.length) lines.push('## About', ...facts, '');
  const services = i.services.map((s) => ({ n: safe(one(s.name, 80)), d: safe(one(s.description, 160)) })).filter((s) => s.n).slice(0, LLMS_MAX_SERVICES);
  if (services.length) lines.push('## Services', ...services.map((s) => `- ${s.n}${s.d ? `: ${s.d}` : ''}`), '');
  const pages = i.pages.filter((p) => onHost(p.url, i.siteUrl)).map((p) => ({ t: safe(one(p.title, 100)), d: safe(one(p.description, 160)), u: p.url })).filter((p) => p.t).slice(0, LLMS_MAX_PAGES);
  if (pages.length) lines.push('## Pages', ...pages.map((p) => `- [${p.t}](${p.u})${p.d ? `: ${p.d}` : ''}`), '');
  if (onHost(i.sitemapUrl, i.siteUrl)) lines.push('## Sitemap', `- ${i.sitemapUrl}`, '');
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
