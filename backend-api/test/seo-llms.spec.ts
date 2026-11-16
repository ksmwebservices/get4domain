import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_DIRECTORY_SETTINGS } from '../src/directory/settings/directory-settings';
import { CategoryRow, LocationRow } from '../src/directory/directory.repository';
import { buildDirectoryLlms } from '../src/seo-directory/core/llms-directory';
import { enumerateListingPaths, Stat } from '../src/seo-directory/core/sitemap';
import { KeywordRow, SeoKeywordStore } from '../src/seo-directory/keywords/seo-keyword.store';
import { loadPlaces } from '../src/seo-directory/pages/places';
import { SeoSitemapService } from '../src/seo-directory/sitemaps/seo-sitemap.service';
import { buildLlmsTxt, LlmsSiteInput, LLMS_MAX_PAGES, LLMS_MAX_SERVICES } from '../src/site-publish/seo/llms-txt';
import { isUnsafeSeoText } from '../src/site-publish/seo/seo-text';
import { DEFAULT_SEO_TEMPLATES } from '../src/seo-directory/core/default-templates';
import { doc } from './support/site-fixtures';
import { STAFF, siteWorld } from './support/site-world';

/** Prompt 6d: llms.txt per vendor site (at publish, stored public facts only) and the global one for the directory. */
jest.setTimeout(120_000);
const SITE = 'https://ranjith.get4domain.com';
const input = (o: Partial<LlmsSiteInput> = {}): LlmsSiteInput => ({
  siteName: 'Ranjith Plumber', categoryLabel: 'Plumber', tagline: 'Leaks fixed fast, every time.', city: 'Chennai', locality: 'Perambur', address: '12 Main Road, Perambur',
  contactVisible: true, phone: '+919876543210', email: 'ranjith@example.com', hours: 'Mon-Sat 9am-8pm',
  services: [{ name: 'Tap repair', description: 'Fix a leaking tap.' }, { name: 'Pipe fitting' }],
  pages: [{ title: 'Ranjith Plumber', description: 'Leaks fixed fast.', url: `${SITE}/` }, { title: 'Services', description: 'What we do.', url: `${SITE}/services` }],
  siteUrl: SITE, sitemapUrl: `${SITE}/sitemap.xml`, ...o,
});

describe('the llms.txt of a vendor site', () => {
  it('names the business, what it is, where, what it offers, its pages and its sitemap', () => {
    expect(buildLlmsTxt(input())).toBe([
      '# Ranjith Plumber', '', '> Ranjith Plumber is a plumber in Perambur, Chennai.', '', 'Leaks fixed fast, every time.', '',
      '## About', '- Category: Plumber', '- Address: 12 Main Road, Perambur', '- Area: Perambur, Chennai', '- Opening hours: Mon-Sat 9am-8pm', '- Phone: +919876543210', '- Email: ranjith@example.com', '',
      '## Services', '- Tap repair: Fix a leaking tap.', '- Pipe fitting', '',
      '## Pages', `- [Ranjith Plumber](${SITE}/): Leaks fixed fast.`, `- [Services](${SITE}/services): What we do.`, '',
      '## Sitemap', `- ${SITE}/sitemap.xml`, '',
    ].join('\n'));
  });
  it('a site that may not show its contact details (Free) never says its phone, email or hours', () => {
    const t = buildLlmsTxt(input({ contactVisible: false }));
    expect(t).not.toMatch(/919876543210|ranjith@example|Mon-Sat|Phone|Email|Opening hours/); expect(t).toContain('- Address: 12 Main Road, Perambur');
  });
  it('never carries a price, a rating, an offer or a retired product name: such a line is dropped, not edited', () => {
    const t = buildLlmsTxt(input({ tagline: 'Plumbing from Rs 499 today', services: [{ name: 'Tap repair', description: 'From ₹300 per visit' }, { name: 'Workspace setup' }, { name: 'Pipe fitting' }], pages: [{ title: 'Offers ₹99', description: 'x', url: `${SITE}/offers` }, { title: 'About', description: 'About us.', url: `${SITE}/about` }] }));
    expect(isUnsafeSeoText(t)).toBe(false); expect(t).toContain('- Tap repair\n'); expect(t).not.toMatch(/Rs 499|₹|Workspace|Offers/); expect(t).toContain('[About]');
  });
  it('keeps to the site: a link on another host is dropped, and markup characters never survive', () => {
    const t = buildLlmsTxt(input({ pages: [{ title: 'Evil', description: 'x', url: 'https://evil.example/' }, { title: 'A <b>[x]</b>', description: 'y', url: `${SITE}/a` }], sitemapUrl: 'https://evil.example/sitemap.xml' }));
    expect(t).not.toMatch(/evil\.example|<\/?[a-z]|\[x\]/); expect(t).not.toContain('## Sitemap');
  });
  it('is capped: at most 30 services and 40 pages, however many the site has', () => {
    const t = buildLlmsTxt(input({ services: Array.from({ length: 80 }, (_v, i) => ({ name: `Service ${i}` })), pages: Array.from({ length: 90 }, (_v, i) => ({ title: `Page ${i}`, description: '', url: `${SITE}/p${i}` })) }));
    expect(t.match(/^- Service /gm)).toHaveLength(LLMS_MAX_SERVICES); expect(t.match(/^- \[Page /gm)).toHaveLength(LLMS_MAX_PAGES);
  });
  it('is stable and ends with one newline; an empty site still gives a valid file', () => {
    expect(buildLlmsTxt(input())).toBe(buildLlmsTxt(input())); expect(buildLlmsTxt(input()).endsWith('\n')).toBe(true); expect(buildLlmsTxt(input()).endsWith('\n\n')).toBe(false);
    const empty = buildLlmsTxt({ siteName: '', categoryLabel: '', city: '', contactVisible: false, services: [], pages: [], siteUrl: SITE, sitemapUrl: '' }); expect(empty).toBe('# This business\n');
  });
});

describe('llms.txt at publish', () => {
  const V = 'v-plumber'; const HOST = 'sri-ganesh-plumbing.get4domain.com';
  const world = async (o: { level: 'FREE' | 'PRO'; claimed: boolean; withPort?: boolean }) => {
    const w = siteWorld({ kind: 'plumber', level: o.level, claimed: o.claimed });
    if (o.withPort !== false) Object.assign(w.build, { seoSettings: { get: async () => ({ vendorHome: DEFAULT_SEO_TEMPLATES.vendorHome, vendorPage: DEFAULT_SEO_TEMPLATES.vendorPage, crawlers: [] }) } });
    w.state.vendorHosts.set(HOST, { vendorId: V, removed: false });
    return w;
  };
  const llms = async (w: Awaited<ReturnType<typeof world>>) => { const { publication } = await w.build.build(V, { actor: STAFF }); return (await w.repo.pagesOf(publication.id)).find((p) => p.path === '/llms.txt'); };

  it('a Pro, claimed, indexable site gets one, from its stored facts, with no price (the items in the fixture have prices)', async () => {
    const f = await llms(await world({ level: 'PRO', claimed: true }));
    expect(f).toBeDefined(); expect(f!.html.startsWith('# Sri Ganesh Plumbing\n')).toBe(true); expect(f!.html).toContain('- Phone: +919876543210'); expect(f!.html).toContain('## Sitemap');
    expect(f!.html).toContain('- Tap repair: Fix a leaking tap.'); expect(f!.html).not.toMatch(/\b300\b|\b500\b|₹|Rs\b/); expect(f!.html.split('## Pages')[0]).not.toMatch(/Pipe fitting/);   // the Services list leaves out the platform's sample item (its page does exist on the site, so Pages lists it)
    expect(f!.html).toContain('https://sri-ganesh-plumbing.get4domain.com/'); expect(f!.html).not.toMatch(/ \| Get4Domain/);   // page titles without the brand suffix
  });
  it('a Free site gets one that says nothing the Free site does not show: no phone, no email, no hours', async () => {
    const f = await llms(await world({ level: 'FREE', claimed: true }));
    expect(f).toBeDefined(); expect(f!.html).not.toMatch(/9876543210|ganesh@example|Mon-Sat|Phone|Email/); expect(f!.html).toContain('- Address: 12, Kamaraj Road, Chennai 600001');
  });
  it('a site that is not indexable (unclaimed) gets none, and neither does a build without the SEO settings port', async () => {
    expect(await llms(await world({ level: 'PRO', claimed: false }))).toBeUndefined();
    expect(await llms(await world({ level: 'PRO', claimed: true, withPort: false }))).toBeUndefined();
  });
  it('is served as text/plain from the published copy, and 404s when the site has none', async () => {
    const w = await world({ level: 'PRO', claimed: true }); const p = (await w.build.build(V, { actor: STAFF })).publication; await w.publish.publish(V, p.id, STAFF);
    const r = (await w.pub.byHost(HOST, '/llms.txt', 'en'))!; expect(r.status).toBe(200); expect(r.contentType).toBe('text/plain; charset=utf-8'); expect(r.html).toContain('# Sri Ganesh Plumbing');
    const none = await world({ level: 'PRO', claimed: true, withPort: false }); const q = (await none.build.build(V, { actor: STAFF })).publication; await none.publish.publish(V, q.id, STAFF);
    expect(await none.pub.byHost(HOST, '/llms.txt', 'en')).toBeNull();
  });
  it('a change to the vendor text rebuilds it (it is part of the build, not a separate file)', async () => {
    const w = await world({ level: 'PRO', claimed: true }); const a = await llms(w);
    w.state.doc = doc('plumber', { cms: { tagline: 'A new tagline for the shop.' }, claimed: true }); const b = await llms(w);
    expect(a!.html).toContain('Leaks fixed fast'); expect(b!.html).toContain('A new tagline for the shop.');
  });
});

describe('the global llms.txt of the directory', () => {
  const loc = (id: string, parentId: string | null, kind: LocationRow['kind'], name: string, slug: string): LocationRow => ({ id, parentId, parentKey: parentId ?? 'ROOT', kind, name, slug, sortOrder: 0, proposed: false, active: true });
  const cat = (id: string, name: string, slug: string): CategoryRow => ({ id, parentId: null, parentKey: 'ROOT', name, slug, themeCategoryId: null, family: null, sortOrder: 0, proposed: false, active: true });
  const LOCS = [loc('tn', null, 'STATE', 'Tamil Nadu', 'tamil-nadu'), loc('chn', 'tn', 'CITY', 'Chennai', 'chennai'), loc('mdu', 'tn', 'CITY', 'Madurai', 'madurai')];
  const CATS = [cat('plm', 'Plumber', 'plumber'), cat('ele', 'Electrician', 'electrician')];
  const KW: KeywordRow[] = [{ id: 'k1', categorySlug: 'plumber', name: 'Plumber', singular: 'plumber', plural: 'plumbers', synonyms: [], specialisations: [], source: 'DERIVED', updatedByStaffId: null, updatedAt: new Date(0) }];
  class Kw extends SeoKeywordStore { async list() { return { items: [], total: 0 }; } async all() { return KW; } async get() { return null; } async upsertDerived() { /* none */ } async staffUpdate() { return null; } }
  const stat = (locationId: string, categoryId: string, count: number): Stat => ({ locationId, categoryId, count, pincode: null, lastmod: new Date('2026-11-01T00:00:00Z') });
  async function svc(indexable: boolean, stats: Stat[]) {
    const places = await loadPlaces({ listLocations: async () => LOCS, listCategories: async () => CATS } as never, new Kw());
    const s = new SeoSitemapService({ groupStats: async () => stats } as never, { listLocations: async () => LOCS, listCategories: async () => CATS } as never, new Kw(), { get: async () => ({ ...DEFAULT_DIRECTORY_SETTINGS, directoryPagesIndexable: indexable }), readPublicAppUrl: async () => 'https://www.get4domain.com' } as never, {} as never);
    expect(enumerateListingPaths(places, stats, 3).length).toBeGreaterThan(0);
    return s;
  }
  it('says what the directory is and lists the categories and cities that have a page, busiest first, plus the sitemap', async () => {
    const t = (await (await svc(true, [stat('chn', 'plm', 5), stat('mdu', 'plm', 3), stat('chn', 'ele', 4)])).llms())!;
    expect(t).toBe([
      '# Get4Domain', '', '> Get4Domain is a directory of local businesses in India. Each listing shows the business address, its services and a link to its own website.', '',
      '## Categories', '- [Plumbers](https://get4domain.com/category/plumber)', '- [Electrician](https://get4domain.com/category/electrician)', '',
      '## Cities', '- [Chennai](https://get4domain.com/chennai)', '- [Madurai](https://get4domain.com/madurai)', '',
      '## Sitemap', '- https://get4domain.com/sitemap.xml', '',
    ].join('\n'));
  });
  it('leaves out thin pages, and is null (404) while the directory pages are not indexable', async () => {
    const t = (await (await svc(true, [stat('chn', 'plm', 5), stat('mdu', 'ele', 1)])).llms())!;
    expect(t).not.toMatch(/Madurai|Electrician/);
    expect(await (await svc(false, [stat('chn', 'plm', 5)])).llms()).toBeNull();
  });
  it('carries no price, no claim about a business and no markup', () => {
    const t = buildDirectoryLlms({ origin: 'https://get4domain.com', categories: [{ name: 'Plumbers from ₹99', path: '/category/x' }, { name: '<b>Tags</b>', path: '/category/tags' }, { name: 'Bad', path: 'https://evil.example' }], cities: [], sitemapUrl: 'https://get4domain.com/sitemap.xml' });
    expect(t).not.toMatch(/₹|<\/?[a-z]|evil/); expect(t).toContain('[bTags/b]');
  });
  it('the route is public, rate limited and answers 404 through the SEO error code', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../src/seo-directory/api/sitemap.controller.ts'), 'utf8');
    expect(src).toMatch(/@Public\(\) @Throttle\(RATE\.directoryRead\) @Get\('llms\.txt'\)/); expect(src).toContain("throw new NotFoundException(seoError('SEO_NOT_FOUND', 'Not found.'))");
  });
});

describe('Wave 3 Part J: the sitemap, robots and llms.txt on the directory host', () => {
  const LOCS2 = [{ id: 'chn', parentId: null, kind: 'CITY', name: 'Chennai', slug: 'chennai', active: true }];
  it('use DIRECTORY_PUBLIC_BASE_URL when it is set, and the app origin when it is not', async () => {
    const mk = () => new SeoSitemapService({ groupStats: async () => [], indexableBusinessMeta: async () => ({ total: 0, newest: null }) } as never, { listLocations: async () => LOCS2, listCategories: async () => [] } as never, { all: async () => [] } as never, { get: async () => ({ ...DEFAULT_DIRECTORY_SETTINGS, directoryPagesIndexable: true }), readPublicAppUrl: async () => 'https://www.get4domain.com' } as never, { crawlers: async () => ({}) } as never);
    const old = process.env.DIRECTORY_PUBLIC_BASE_URL;
    try {
      process.env.DIRECTORY_PUBLIC_BASE_URL = 'https://directory.get4domain.com/directory';
      const robots = await mk().robots();
      expect(robots).toContain('Sitemap: https://directory.get4domain.com/sitemap.xml'); expect(robots).not.toMatch(/\/directory(?![.\w-])/); expect(robots).not.toContain('https://get4domain.com/sitemap.xml');
      delete process.env.DIRECTORY_PUBLIC_BASE_URL;
      expect(await mk().robots()).toContain('Sitemap: https://get4domain.com/sitemap.xml');
    } finally { if (old === undefined) delete process.env.DIRECTORY_PUBLIC_BASE_URL; else process.env.DIRECTORY_PUBLIC_BASE_URL = old; }
  });
});
