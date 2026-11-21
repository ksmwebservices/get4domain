import { DEFAULT_DIRECTORY_SETTINGS, DirectorySettings } from '../src/directory/settings/directory-settings';
import { CategoryRow, LocationRow } from '../src/directory/directory.repository';
import { buildDirectoryRobots, DIRECTORY_DISALLOW } from '../src/seo-directory/core/robots';
import { buildSitemapIndex, buildUrlset, chunkCount, chunkNumber, enumerateListingPaths, SITEMAP_CHUNK, Stat } from '../src/seo-directory/core/sitemap';
import { KeywordRow, SeoKeywordStore } from '../src/seo-directory/keywords/seo-keyword.store';
import { loadPlaces } from '../src/seo-directory/pages/places';
import { FacetCounts, SeoDirectoryData } from '../src/seo-directory/pages/seo-directory.data';
import { DEFAULT_SEO_CRAWLERS, resolveSeoCrawlers, seoCrawlersProblem } from '../src/seo-directory/settings/seo-settings';
import { SeoSitemapService } from '../src/seo-directory/sitemaps/seo-sitemap.service';
import { ADMIN_ROLE_MATRIX, effectiveRolesFor, SEO_SUPER_ROUTES } from '../src/auth/guards/admin-role-matrix';

const loc = (id: string, parentId: string | null, kind: LocationRow['kind'], name: string, slug: string, sortOrder = 0): LocationRow => ({ id, parentId, parentKey: parentId ?? 'ROOT', kind, name, slug, sortOrder, proposed: false, active: true });
const cat = (id: string, parentId: string | null, name: string, slug: string, sortOrder = 0): CategoryRow => ({ id, parentId, parentKey: parentId ?? 'ROOT', name, slug, themeCategoryId: null, family: null, sortOrder, proposed: false, active: true });
const LOCS = [loc('tn', null, 'STATE', 'Tamil Nadu', 'tamil-nadu'), loc('chn', 'tn', 'CITY', 'Chennai', 'chennai'), loc('per', 'chn', 'LOCALITY', 'Perambur', 'perambur'), loc('ady', 'chn', 'LOCALITY', 'Adyar', 'adyar'), loc('mdu', 'tn', 'CITY', 'Madurai', 'madurai')];
const CATS = [cat('fam', null, 'Home services', 'home-services'), cat('plm', 'fam', 'Plumber', 'plumber'), cat('ele', 'fam', 'Electrician', 'electrician', 1)];
const KW: KeywordRow[] = [{ id: 'k1', categorySlug: 'plumber', name: 'Plumber', singular: 'plumber', plural: 'plumbers', synonyms: [], specialisations: [], source: 'DERIVED', updatedByStaffId: null, updatedAt: new Date(0) }];
class Kw extends SeoKeywordStore { async list() { return { items: [], total: 0 }; } async all() { return KW; } async get() { return null; } async upsertDerived() { /* none */ } async staffUpdate() { return null; } }
const d = (s: string): Date => new Date(`${s}T00:00:00.000Z`);
const stat = (locationId: string | null, categoryId: string, count: number, last = '2026-11-01', pincode: string | null = null): Stat => ({ locationId, categoryId, count, pincode, lastmod: d(last) });
const places = () => loadPlaces({ listLocations: async () => LOCS, listCategories: async () => CATS } as never, new Kw());

describe('which pages go into the sitemap', () => {
  it('lists every indexable page type once, as its base URL, with the newest lastmod', async () => {
    const stats = [stat('per', 'plm', 4, '2026-11-02', '600011'), stat('per', 'plm', 1, '2026-11-09', '600012'), stat('ady', 'plm', 3, '2026-11-03', '600020')];
    const paths = enumerateListingPaths(await places(), stats, 3);
    const by = Object.fromEntries(paths.map((p) => [p.path, p.lastmod.toISOString().slice(0, 10)]));
    expect(Object.keys(by)).toEqual([
      '/category/home-services', '/category/plumber', '/chennai', '/chennai/home-services', '/chennai/home-services-in-adyar', '/chennai/home-services-in-perambur', '/chennai/plumbers', '/chennai/plumbers-in-adyar', '/chennai/plumbers-in-perambur',
      '/pincode/600011/home-services', '/pincode/600011/plumber', '/pincode/600020/home-services', '/pincode/600020/plumber', '/state/tamil-nadu',
    ]);   // 600012 has one business: thin
    expect(by['/chennai/plumbers-in-perambur']).toBe('2026-11-09');   // the newest of the two groups that make this page
    expect(by['/chennai/plumbers']).toBe('2026-11-09');
    expect(by['/state/tamil-nadu']).toBe('2026-11-09');
    expect(paths.some((p) => /page\//.test(p.path))).toBe(false);
  });
  it('leaves out thin and empty pages (below the minimum) but keeps a page that reaches it by summing', async () => {
    const stats = [stat('per', 'plm', 2, '2026-11-02', '600011'), stat('ady', 'plm', 2, '2026-11-03', '600020'), stat('mdu', 'ele', 1)];
    const paths = enumerateListingPaths(await places(), stats, 3).map((p) => p.path);
    expect(paths).toContain('/chennai/plumbers'); expect(paths).toContain('/chennai'); expect(paths).toContain('/category/plumber');
    expect(paths).not.toContain('/chennai/plumbers-in-perambur'); expect(paths).not.toContain('/chennai/plumbers-in-adyar'); expect(paths).not.toContain('/pincode/600011/plumber');
    expect(paths).not.toContain('/madurai'); expect(paths).not.toContain('/madurai/electrician');
  });
  it('a minimum of 0 still never lists an empty page', async () => { expect(enumerateListingPaths(await places(), [], 0)).toEqual([]); expect(enumerateListingPaths(await places(), [stat('per', 'plm', 1)], 0).length).toBeGreaterThan(0); });
  it('a business with no location counts toward category pages only', async () => {
    const paths = enumerateListingPaths(await places(), [stat(null, 'plm', 5)], 3).map((p) => p.path);
    expect(paths).toEqual(['/category/home-services', '/category/plumber']);
  });
  it('is sorted by path and stable', async () => {
    const stats = [stat('per', 'plm', 4), stat('mdu', 'plm', 4)]; const a = enumerateListingPaths(await places(), stats, 3).map((p) => p.path);
    expect(a).toEqual([...a].sort()); expect(enumerateListingPaths(await places(), [...stats].reverse(), 3).map((p) => p.path)).toEqual(a);
  });
  it('a duplicated place slug is listed only for the place the resolver would pick', async () => {
    const dupLocs = [...LOCS, loc('tn2', null, 'STATE', 'Kerala', 'kerala'), loc('chn2', 'tn2', 'CITY', 'Chennai', 'chennai', 5)];
    const pl = await loadPlaces({ listLocations: async () => dupLocs, listCategories: async () => CATS } as never, new Kw());
    const paths = enumerateListingPaths(pl, [stat('chn2', 'plm', 9)], 3).map((p) => p.path);
    expect(paths).not.toContain('/chennai'); expect(paths).toContain('/state/kerala');   // the other Chennai would answer /chennai, so this one's page is not listed under it
    const mine = enumerateListingPaths(pl, [stat('chn', 'plm', 9)], 3).map((p) => p.path); expect(mine).toContain('/chennai');
  });
});

describe('sitemap xml', () => {
  it('builds a urlset with loc and lastmod and escapes the text', () => {
    const x = buildUrlset([{ loc: 'https://get4domain.com/a?x=1&y=2', lastmod: d('2026-11-02') }]);
    expect(x).toContain('<loc>https://get4domain.com/a?x=1&amp;y=2</loc>'); expect(x).toContain('<lastmod>2026-11-02T00:00:00.000Z</lastmod>'); expect(x.startsWith('<?xml')).toBe(true);
  });
  it('an empty list is a valid empty urlset and an empty index', () => { expect(buildUrlset([])).toContain('<urlset'); expect(buildUrlset([])).not.toContain('<url>'); expect(buildSitemapIndex([])).not.toContain('<sitemap>'); });
  it('never writes more than 10,000 urls into one file', () => { const many = Array.from({ length: SITEMAP_CHUNK + 5 }, (_, i) => ({ loc: `https://x/${i}`, lastmod: d('2026-11-01') })); expect(buildUrlset(many).match(/<url>/g)).toHaveLength(SITEMAP_CHUNK); });
  it('counts chunks and parses file names', () => {
    expect(chunkCount(0)).toBe(0); expect(chunkCount(1)).toBe(1); expect(chunkCount(10_000)).toBe(1); expect(chunkCount(10_001)).toBe(2);
    expect(chunkNumber('directory-3.xml')).toBe(3); for (const f of ['directory-0.xml', 'directory-.xml', '../x', 'directory-1.xml.gz', 'x', '', 'directory-01.xml']) expect(chunkNumber(f)).toBeNull();
  });
});

class MemData extends SeoDirectoryData {
  stats: Stat[] = []; businessTotal = 0; newest: Date | null = null; sites: Array<{ subdomain: string; publishedAt: Date | null }> = [];
  async businesses() { return { items: [], total: 0 }; } async facets(): Promise<FacetCounts> { return { byLocation: new Map(), byCategory: new Map(), byPincode: new Map() }; } async businessBySlug() { return null; }
  async groupStats() { return this.stats; }
  async indexableBusinesses(skip: number, take: number) { return Array.from({ length: Math.max(0, Math.min(take, this.businessTotal - skip)) }, (_, i) => ({ slug: `biz-${String(skip + i).padStart(6, '0')}`, updatedAt: d('2026-11-05') })); }
  async indexableBusinessMeta() { return { total: this.businessTotal, newest: this.newest }; }
  async publishedIndexableSites(skip: number, take: number) { return { items: this.sites.slice(skip, skip + take), total: this.sites.length }; }
}
function world(over: Partial<DirectorySettings> = {}, appUrl = 'https://www.get4domain.com', crawlers: string[] = [...DEFAULT_SEO_CRAWLERS]) {
  const data = new MemData(); const settings = { ...DEFAULT_DIRECTORY_SETTINGS, ...over };
  const svc = new SeoSitemapService(data, { listLocations: async () => LOCS, listCategories: async () => CATS } as never, new Kw(), { get: async () => settings, readPublicAppUrl: async () => appUrl } as never, { crawlers: async () => crawlers } as never);
  return { svc, data };
}

describe('the sitemap service', () => {
  it('is empty while directoryPagesIndexable is OFF (the default): index, chunk and robots', async () => {
    const w = world(); w.data.stats = [stat('per', 'plm', 9)]; w.data.businessTotal = 50;
    expect(await w.svc.index()).not.toContain('<sitemap>'); expect(await w.svc.chunk(1)).not.toContain('<url>');
    expect(await w.svc.robots()).not.toContain('Sitemap:');
  });
  it('lists the indexable pages and business profiles on the canonical (non-www) host when ON', async () => {
    const w = world({ directoryPagesIndexable: true }); w.data.stats = [stat('per', 'plm', 4)]; w.data.businessTotal = 2; w.data.newest = d('2026-11-08');
    const idx = await w.svc.index(); expect(idx).toContain('<loc>https://get4domain.com/sitemaps/directory-1.xml</loc>'); expect(idx).not.toContain('https://www.get4domain'); expect(idx).toContain('<lastmod>2026-11-08T00:00:00.000Z</lastmod>');
    const c = (await w.svc.chunk(1))!;
    expect(c).toContain('<loc>https://get4domain.com/chennai/plumbers-in-perambur</loc>'); expect(c).toContain('<loc>https://get4domain.com/business/biz-000000</loc>'); expect(c).toContain('<loc>https://get4domain.com/business/biz-000001</loc>');
    expect(await w.svc.chunk(2)).toBeNull(); expect(await w.svc.chunk(0)).toBeNull();
  });
  it('splits into chunks of at most 10,000 urls with no overlap and no gap, listing pages first', async () => {
    const w = world({ directoryPagesIndexable: true }); w.data.stats = [stat('per', 'plm', 4)]; w.data.businessTotal = 12_345;
    const listing = enumerateListingPaths(await places(), w.data.stats, 3).length; const total = listing + 12_345;
    expect((await w.svc.index()).match(/<sitemap>/g)).toHaveLength(Math.ceil(total / SITEMAP_CHUNK));
    const locs: string[] = [];
    for (let n = 1; n <= Math.ceil(total / SITEMAP_CHUNK); n++) { const x = (await w.svc.chunk(n))!; const these = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]); expect(these.length).toBeLessThanOrEqual(SITEMAP_CHUNK); locs.push(...these); }
    expect(locs).toHaveLength(total); expect(new Set(locs).size).toBe(total);
    expect(locs.slice(0, listing).every((l) => !l.includes('/business/'))).toBe(true); expect(locs[listing]).toBe('https://get4domain.com/business/biz-000000'); expect(locs[total - 1]).toBe(`https://get4domain.com/business/biz-${String(12_344).padStart(6, '0')}`);
    expect(await w.svc.chunk(Math.ceil(total / SITEMAP_CHUNK) + 1)).toBeNull();
  });
  it('with nothing indexable the index is empty and the first chunk is an empty urlset (not a 404)', async () => { const w = world({ directoryPagesIndexable: true }); expect(await w.svc.index()).not.toContain('<sitemap>'); expect(await w.svc.chunk(1)).not.toContain('<url>'); });
  it('the vendor site list gives live subdomain home URLs on the base domain', async () => {
    const w = world(); w.data.sites = [{ subdomain: 'Ranjith', publishedAt: d('2026-11-01') }, { subdomain: 'acme', publishedAt: null }];
    const prev = process.env.SITE_BASE_DOMAIN; process.env.SITE_BASE_DOMAIN = 'get4domain.com';
    try { expect(await w.svc.vendorSites(0, 10)).toEqual({ items: [{ url: 'https://ranjith.get4domain.com/', publishedAt: '2026-11-01T00:00:00.000Z' }, { url: 'https://acme.get4domain.com/', publishedAt: null }], total: 2 }); } finally { if (prev === undefined) delete process.env.SITE_BASE_DOMAIN; else process.env.SITE_BASE_DOMAIN = prev; }
  });
});

describe('robots.txt of the main site', () => {
  const groups = (t: string): string[][] => t.trim().split(/\n\s*\n/).map((g) => g.split('\n'));
  it('allows all by default, names each crawler, and disallows the click-out, internal search and sort or filter URLs in every group', async () => {
    const t = await world({ directoryPagesIndexable: true }).svc.robots();
    for (const bot of DEFAULT_SEO_CRAWLERS) expect(t).toContain(`User-agent: ${bot}`);
    const gs = groups(t).filter((g) => g[0].startsWith('User-agent'));
    expect(gs).toHaveLength(2);
    for (const g of gs) { expect(g).toContain('Allow: /'); for (const dis of DIRECTORY_DISALLOW) expect(g).toContain(`Disallow: ${dis}`); }
    expect(t).toContain('Disallow: /v3/go/'); expect(t).toContain('Disallow: /go/'); expect(t).toContain('Disallow: /search'); expect(t).toContain('Disallow: /*?*sort=');
    expect(t).not.toMatch(/^Disallow: \/$/m);   // the whole site is never blocked
  });
  it('adds the sitemap index line only when indexable, on the non-www host', async () => {
    expect(await world({ directoryPagesIndexable: true }).svc.robots()).toContain('Sitemap: https://get4domain.com/sitemap.xml');
    expect(await world({ directoryPagesIndexable: false }).svc.robots()).not.toContain('Sitemap');
    expect(buildDirectoryRobots({ crawlers: [], indexable: true, sitemapUrl: '' })).not.toContain('Sitemap');
  });
  it('works with no named crawlers (only the catch-all group)', () => { const t = buildDirectoryRobots({ crawlers: [], indexable: false, sitemapUrl: 'x' }); expect(t.startsWith('User-agent: *')).toBe(true); });
});

describe('the crawler list setting', () => {
  it('defaults to the documented 26 crawlers', () => { expect(DEFAULT_SEO_CRAWLERS).toHaveLength(26); expect(DEFAULT_SEO_CRAWLERS).toEqual(expect.arrayContaining(['Googlebot', 'GPTBot', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'cohere-ai', 'facebookexternalhit'])); });
  it('validates names, duplicates, size and the catch-all', () => {
    expect(seoCrawlersProblem(['Googlebot', 'MyBot-1.0'])).toBeNull();
    expect(seoCrawlersProblem([])).toMatch(/1 to 60/); expect(seoCrawlersProblem('x')).toMatch(/list/); expect(seoCrawlersProblem(['bad name'])).toMatch(/not a crawler name/); expect(seoCrawlersProblem(['a\nDisallow: /'])).toMatch(/not a crawler name/);
    expect(seoCrawlersProblem(['*'])).toMatch(/not a crawler name|catch-all/); expect(seoCrawlersProblem(['A', 'a'])).toMatch(/twice/); expect(seoCrawlersProblem(Array.from({ length: 61 }, (_, i) => `b${i}`))).toMatch(/1 to 60/); expect(seoCrawlersProblem([5])).toMatch(/not a crawler name/);
  });
  it('a bad stored value falls back to the defaults whole', () => { expect(resolveSeoCrawlers(['a b'])).toEqual([...DEFAULT_SEO_CRAWLERS]); expect(resolveSeoCrawlers(undefined)).toEqual([...DEFAULT_SEO_CRAWLERS]); expect(resolveSeoCrawlers(['OnlyBot'])).toEqual(['OnlyBot']); });
  it('only SUPER_ADMIN may change it; ADMIN, SALES, OPERATIONS and SUPPORT may not', () => {
    for (const key of Object.keys(SEO_SUPER_ROUTES)) { expect(ADMIN_ROLE_MATRIX[key]).toEqual(['SUPER_ADMIN']); expect(effectiveRolesFor(key)).toEqual(['SUPER_ADMIN']); }
    expect(effectiveRolesFor('GET /v3/admin/seo-directory/vendor-sites')).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'ADMIN', 'MARKETING']));
    expect(effectiveRolesFor('GET /v3/admin/seo-directory/vendor-sites')).not.toContain('OPERATIONS');
  });
});
