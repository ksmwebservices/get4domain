import { serializeJsonLd } from './metadata';

/**
 * Sample answers of GET /v3/public/site/by-host, shaped like the backend's (docs: site-publish public-site.controller). Mock mode only: nothing here touches the network.
 * The backend stores complete pages; these fixtures imitate that, including the rules the front end must never break by editing a page:
 *   - a Pro site has calls to action; a Free (listing only) site has none (no tel, mailto, wa.me, form or button);
 *   - a draft or unclaimed site is noindex (header and page) and its sitemap is an empty urlset;
 *   - every page links back to the main domain (the backlink block), and carries Organization, WebSite and FAQPage JSON-LD with areaServed.
 * All addresses are .invalid sample names.
 */
export type RawVendorAnswer =
  | { status: 200; body: string; contentType: string; etag: string; robots: string | null; lang: string; cacheControl: string }
  | { status: 304; etag: string; cacheControl: string }
  | { status: 301 | 302; location: string }
  | { status: 451; body: string }
  | { status: 404 }
  | { status: 503 };

export const MOCK_MAIN_ORIGIN = 'https://main.example.invalid';

interface MockSite {
  name: string;
  city: string;
  /** calls to action present (Pro). Free sites are listing only. */
  cta: boolean;
  indexable: boolean;
  pages: readonly string[];
}

const PAGES = ['/', '/services', '/about', '/contact'] as const;

/** Sample sites by host label. Anything else is an unknown host. */
export const MOCK_SITES: Record<string, MockSite> = {
  'sample-pro': { name: 'Sample Pro Plumbing', city: 'Chennai', cta: true, indexable: true, pages: PAGES },
  'sample-free': { name: 'Sample Free Electricals', city: 'Chennai', cta: false, indexable: true, pages: ['/', '/services', '/about'] },
  'sample-draft': { name: 'Sample Draft Carpentry', city: 'Madurai', cta: false, indexable: false, pages: ['/', '/about'] },
  // a hostile name: the JSON-LD and the page must keep it from closing a tag
  'sample-hostile': { name: 'Evil </script><script>x()</script> & "Co" <b>', city: 'Salem', cta: false, indexable: true, pages: ['/'] },
};

/** Labels with a special answer instead of a page. */
export const MOCK_MOVED_LABEL = 'sample-moved';
export const MOCK_TAKEDOWN_LABEL = 'sample-takedown';
export const MOCK_DOWN_LABEL = 'sample-down';

export const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** A small, stable string hash for sample ETags (the real one is the page sha256). */
export function sampleEtag(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `"${h.toString(16).padStart(8, '0')}"`;
}

const titleOf = (site: MockSite, path: string): string => {
  const page = path === '/' ? 'Home' : path.slice(1).replace(/^./, (c) => c.toUpperCase());
  return `${page} | ${site.name}`;
};

/** The page JSON-LD, as data. */
export function mockJsonLd(site: MockSite, host: string, path: string): Array<Record<string, unknown>> {
  const url = `https://${host}${path === '/' ? '/' : path}`;
  return [
    { '@context': 'https://schema.org', '@type': 'Organization', name: site.name, url: `https://${host}/`, areaServed: { '@type': 'City', name: site.city } },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: `https://${host}/` },
    { '@context': 'https://schema.org', '@type': 'FAQPage', url, mainEntity: [{ '@type': 'Question', name: `Where does ${site.name} work?`, acceptedAnswer: { '@type': 'Answer', text: `${site.name} serves ${site.city}.` } }] },
  ];
}

/** One stored page of a sample site. */
export function mockPageHtml(site: MockSite, host: string, path: string): string {
  const robots = site.indexable ? 'index, follow' : 'noindex, nofollow';
  const canonical = `https://${host}${path === '/' ? '/' : path}`;
  const ld = mockJsonLd(site, host, path).map((d) => `<script type="application/ld+json">${serializeJsonLd(d)}</script>`).join('');
  const nav = site.pages.map((p) => `<a href="${p}">${escapeHtml(p === '/' ? 'Home' : p.slice(1))}</a>`).join(' ');
  // Pro only: calls to action. A Free (listing only) page never carries any of these.
  const cta = site.cta
    ? '<p><a href="tel:+910000000000">Call us</a> <a href="mailto:hello@example.invalid">Email us</a> <a href="https://wa.me/910000000000">WhatsApp</a></p><form action="/contact" method="post"><label>Name <input name="n"></label><button type="submit">Send</button></form>'
    : '';
  const draft = site.indexable ? '' : '<p>This site is not published yet.</p>';
  return `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(titleOf(site, path))}</title><meta name="description" content="${escapeHtml(`${site.name} in ${site.city}.`)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${canonical}">${ld}</head><body><header><nav>${nav}</nav></header><main><h1>${escapeHtml(site.name)}</h1><p>${escapeHtml(site.city)}</p>${draft}${cta}</main><footer><a href="${MOCK_MAIN_ORIGIN}/">Get4Domain</a></footer></body></html>`;
}

const sitemapXml = (site: MockSite, host: string): string => {
  const urls = site.indexable ? site.pages.map((p) => `<url><loc>https://${host}${p === '/' ? '/' : p}</loc></url>`).join('') : '';
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
};

const robotsTxt = (host: string): string => `User-agent: *\nAllow: /\n\nSitemap: https://${host}/sitemap.xml\n`;

const llmsTxt = (site: MockSite, host: string): string =>
  `# ${site.name.replace(/[\r\n#]/g, ' ')}\n\n> ${site.name.replace(/[\r\n]/g, ' ')} in ${site.city}.\n\n${site.pages.map((p) => `- [${p === '/' ? 'Home' : p.slice(1)}](https://${host}${p === '/' ? '/' : p})`).join('\n')}\n`;

const CC = 'public, max-age=60, stale-while-revalidate=120';
const HTML = 'text/html; charset=utf-8';

/** The by-host answer for a sample host and path. `null` for bad input, like the backend's uniform 404. */
export function mockVendorAnswer(hostIn: string, pathIn: string, ifNoneMatch?: string | null): RawVendorAnswer {
  const host = String(hostIn ?? '').trim().toLowerCase().split(':')[0];
  const label = host.split('.')[0];
  const p = `/${String(pathIn ?? '/').split('?')[0].replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/';
  if (!host || host.length > 253 || p.length > 300 || p.includes('..')) return { status: 404 };
  if (label === MOCK_DOWN_LABEL) return { status: 503 };
  if (label === MOCK_MOVED_LABEL) return { status: 301, location: `https://sample-pro.${host.split('.').slice(1).join('.')}${p}` };
  if (label === MOCK_TAKEDOWN_LABEL) return { status: 451, body: '<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Not available</title></head><body><main><h1>This website is not available</h1><p>It has been taken down following a legal notice.</p></main></body></html>' };
  const site = MOCK_SITES[label];
  if (!site) return { status: 404 };
  let body: string; let contentType: string; let robots: string | null;
  if (p === '/sitemap.xml') { body = sitemapXml(site, host); contentType = 'application/xml; charset=utf-8'; robots = null; }
  else if (p === '/robots.txt') { body = robotsTxt(host); contentType = 'text/plain; charset=utf-8'; robots = null; }
  else if (p === '/llms.txt') { body = llmsTxt(site, host); contentType = 'text/plain; charset=utf-8'; robots = null; }
  else {
    if (!site.pages.includes(p)) return { status: 404 };
    body = mockPageHtml(site, host, p); contentType = HTML; robots = site.indexable ? 'index, follow' : 'noindex, nofollow';
  }
  const etag = sampleEtag(body);
  if (ifNoneMatch && ifNoneMatch.replace(/^W\//, '') === etag) return { status: 304, etag, cacheControl: CC };
  return { status: 200, body, contentType, etag, robots, lang: 'en', cacheControl: CC };
}
