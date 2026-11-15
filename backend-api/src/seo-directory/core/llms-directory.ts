import { cutAtWord, isUnsafeSeoText } from '../../site-publish/seo/seo-text';

/**
 * The global llms.txt of the directory (prompt 6d). Pure. What the directory is, the categories and cities that have enough listings to have a page (the same pages the sitemap lists), and
 * the sitemap link. No count promises, no price, no claim about any business. The caller returns nothing at all while the directory pages are not indexable.
 */
export interface LlmsDirectoryInput { origin: string; categories: Array<{ name: string; path: string }>; cities: Array<{ name: string; path: string }>; sitemapUrl: string }
export const LLMS_DIRECTORY_MAX = 100;

const clean = (s: string): string => cutAtWord(String(s ?? '').replace(/\s+/g, ' ').replace(/[<>\[\]]/g, '').trim(), 80);
const items = (rows: Array<{ name: string; path: string }>, origin: string): string[] => rows.map((r) => ({ n: clean(r.name), p: r.path })).filter((r) => r.n && !isUnsafeSeoText(r.n) && r.p.startsWith('/')).slice(0, LLMS_DIRECTORY_MAX).map((r) => `- [${r.n}](${origin}${r.p})`);

export function buildDirectoryLlms(i: LlmsDirectoryInput): string {
  const lines = ['# Get4Domain', '', '> Get4Domain is a directory of local businesses in India. Each listing shows the business address, its services and a link to its own website.', ''];
  const cats = items(i.categories, i.origin); if (cats.length) lines.push('## Categories', ...cats, '');
  const cities = items(i.cities, i.origin); if (cities.length) lines.push('## Cities', ...cities, '');
  lines.push('## Sitemap', `- ${i.sitemapUrl}`, '');
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
