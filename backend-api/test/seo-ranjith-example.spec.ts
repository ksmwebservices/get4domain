import { DEFAULT_DIRECTORY_SETTINGS, DirectorySettings } from '../src/directory/settings/directory-settings';
import { CategoryRow, LocationRow } from '../src/directory/directory.repository';
import { badgeSvg } from '../src/seo-directory/core/badge';
import { buildBacklinkBlock } from '../src/seo-directory/core/backlink-block';
import { DEFAULT_SEO_TEMPLATES, SEO_PAGE_TYPES } from '../src/seo-directory/core/default-templates';
import { PageModel } from '../src/seo-directory/core/page-model';
import { hasRankingClaim } from '../src/seo-directory/core/ranking-claims';
import { buildH1, buildTitle, H1_MAX } from '../src/seo-directory/core/template-engine';
import { KeywordRow, SeoKeywordStore } from '../src/seo-directory/keywords/seo-keyword.store';
import { FacetCounts, ListedBusiness, Scope, SeoDirectoryData } from '../src/seo-directory/pages/seo-directory.data';
import { PageOverride, SeoPageOverrides, SeoPageService } from '../src/seo-directory/pages/seo-page.service';
import { resolveSeoTemplates, seoTemplatesProblem } from '../src/seo-directory/settings/seo-settings';
import { isUnsafeSeoText } from '../src/site-publish/seo/seo-text';

/**
 * Slice 8: the worked example. Ranjith Plumber, a plumber in Perambur, Chennai, followed through every page that names it: the directory profile, the locality, city and category pages,
 * a second page of results, the brand suffix, the backlink block and the badge. The same business is used in the docs (V3_SEO_DIRECTORY.md, section "Worked example"). The rules the
 * example proves: every title is within 60 and ends with the brand; every description within 160; the page marker survives the caps; and NOTHING the platform writes promises a ranking.
 */
const loc = (id: string, parentId: string | null, kind: LocationRow['kind'], name: string, slug: string, sortOrder = 0): LocationRow => ({ id, parentId, parentKey: parentId ?? 'ROOT', kind, name, slug, sortOrder, proposed: false, active: true });
const cat = (id: string, parentId: string | null, name: string, slug: string, sortOrder = 0): CategoryRow => ({ id, parentId, parentKey: parentId ?? 'ROOT', name, slug, themeCategoryId: null, family: null, sortOrder, proposed: false, active: true });
const LOCS = [loc('tn', null, 'STATE', 'Tamil Nadu', 'tamil-nadu'), loc('chn', 'tn', 'CITY', 'Chennai', 'chennai'), loc('per', 'chn', 'LOCALITY', 'Perambur', 'perambur'), loc('ady', 'chn', 'LOCALITY', 'Adyar', 'adyar')];
const CATS = [cat('fam', null, 'Home services', 'home-services'), cat('plm', 'fam', 'Plumber', 'plumber')];
let seq = 0;
const biz = (name: string, o: Partial<ListedBusiness> = {}): ListedBusiness => ({ id: `b${++seq}`, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, categoryId: 'plm', locationId: 'per', pincode: '600011', descriptionText: 'Plumbing repairs and fitting for homes in Perambur.', status: 'CLAIMED', indexable: true, vendorId: `v${seq}`, claimed: true, address: { line1: '12 Main Road' }, hours: {}, geo: null, imageUrl: null, updatedAt: new Date('2026-11-01T00:00:00Z'), ...o });

class MemData extends SeoDirectoryData {
  rows: ListedBusiness[] = [];
  private match(s: Scope): ListedBusiness[] { return this.rows.filter((b) => (!s.locationIds || (b.locationId !== null && s.locationIds.includes(b.locationId))) && (!s.categoryIds || s.categoryIds.includes(b.categoryId)) && (!s.pincode || b.pincode === s.pincode)).sort((a, b) => a.name.localeCompare(b.name)); }
  async businesses(s: Scope, skip: number, take: number) { const all = this.match(s); return { items: all.slice(skip, skip + take), total: all.length }; }
  async facets(s: Scope): Promise<FacetCounts> {
    const f: FacetCounts = { byLocation: new Map(), byCategory: new Map(), byPincode: new Map() };
    for (const b of this.match(s)) { if (b.locationId) f.byLocation.set(b.locationId, (f.byLocation.get(b.locationId) ?? 0) + 1); f.byCategory.set(b.categoryId, (f.byCategory.get(b.categoryId) ?? 0) + 1); if (b.pincode) f.byPincode.set(b.pincode, (f.byPincode.get(b.pincode) ?? 0) + 1); }
    return f;
  }
  async businessBySlug(slug: string) { return this.rows.find((b) => b.slug === slug) ?? null; }
  async groupStats() { return []; } async indexableBusinesses() { return []; } async indexableBusinessMeta() { return { total: 0, newest: null }; } async publishedIndexableSites() { return { items: [], total: 0 }; }
}
class Kw extends SeoKeywordStore {
  async list() { return { items: [], total: 0 }; }
  async all(): Promise<KeywordRow[]> { return [{ id: 'k1', categorySlug: 'plumber', name: 'Plumber', singular: 'plumber', plural: 'plumbers', synonyms: [], specialisations: [], source: 'DERIVED', updatedByStaffId: null, updatedAt: new Date(0) }]; }
  async get() { return null; } async upsertDerived() { /* none */ } async staffUpdate() { return null; }
}
function world(over: Partial<DirectorySettings> = {}, templates = DEFAULT_SEO_TEMPLATES) {
  const data = new MemData(); const settings = { ...DEFAULT_DIRECTORY_SETTINGS, directoryPagesIndexable: true, ...over };
  const ranjith = biz('Ranjith Plumber'); data.rows.push(ranjith, biz('Anand Plumbing'), biz('Bala Plumbers'), biz('Chandra Pipes'), biz('Dev Plumber'));
  const sites = new Map<string, { subdomain: string | null; proActive: boolean }>([[ranjith.vendorId!, { subdomain: 'ranjith', proActive: true }]]);
  const svc = new SeoPageService(data,
    { listLocations: async () => LOCS, listCategories: async () => CATS, siteFacts: async (ids: string[]) => new Map(ids.filter((i) => sites.has(i)).map((i) => [i, sites.get(i)!])) } as never,
    { get: async () => settings, readPublicAppUrl: async () => 'https://get4domain.com' } as never, new Kw(), { templates: async () => templates } as never, { forPath: async (): Promise<PageOverride | null> => null } as SeoPageOverrides);
  return { svc, data, ranjith };
}
const ok = async (svc: SeoPageService, path: string): Promise<PageModel> => { const r = await svc.resolve(path); if (r.kind !== 'ok') throw new Error(`${path}: ${r.kind}`); return r.model; };
const PATHS = ['/', '/state/tamil-nadu', '/chennai', '/category/plumber', '/chennai/plumbers', '/chennai/plumbers-in-perambur', '/pincode/600011/plumber', '/business/ranjith-plumber'];

describe('Ranjith Plumber, page by page', () => {
  it('the profile page', async () => {
    const m = await ok(world().svc, '/business/ranjith-plumber');
    expect(m.meta.title).toBe('Ranjith Plumber | Plumber in Perambur, Chennai | Get4Domain'); expect(m.meta.title.length).toBe(59);
    expect(m.h1).toBe('Ranjith Plumber'); expect(m.meta.canonical).toBe('https://get4domain.com/business/ranjith-plumber');
    expect(m.meta.description).toBe('Ranjith Plumber: Plumber in Perambur, Chennai. Address, services and website on get4domain.com.');
    expect(m.meta.indexable).toBe(true);
  });
  it('the locality, city and category pages that list it', async () => {
    const w = world();
    expect((await ok(w.svc, '/chennai/plumbers-in-perambur')).meta.title).toBe('Plumbers in Perambur, Chennai | Get4Domain');
    expect((await ok(w.svc, '/chennai/plumbers')).meta.title).toBe('Plumbers in Chennai | Get4Domain');
    expect((await ok(w.svc, '/category/plumber')).meta.title).toBe('Plumbers Near You | Get4Domain');
    const card = (await ok(w.svc, '/chennai/plumbers-in-perambur')).cards.find((c) => c.name === 'Ranjith Plumber')!;
    expect(card.visitUrl).toBe(`/v3/go/${w.ranjith.id}?src=localityCategory`); expect(card.profilePath).toBe('/business/ranjith-plumber');
  });
  it('a second page of results keeps the marker and the brand inside the caps, with a self canonical and links to its neighbours', async () => {
    const w = world({ directoryPageSizeMax: 2, directoryPageSizeDefault: 2 });
    const p1 = await ok(w.svc, '/chennai/plumbers-in-perambur'); const p2 = await ok(w.svc, '/chennai/plumbers-in-perambur/page/2'); const p3 = await ok(w.svc, '/chennai/plumbers-in-perambur/page/3');
    expect(p1.meta.title).toBe('Plumbers in Perambur, Chennai | Get4Domain'); expect(p2.meta.title).toBe('Plumbers in Perambur, Chennai - Page 2 | Get4Domain');
    expect(p2.meta.canonical).toBe('https://get4domain.com/chennai/plumbers-in-perambur/page/2'); expect(p1.meta.canonical).toBe('https://get4domain.com/chennai/plumbers-in-perambur');
    expect(p2.page).toMatchObject({ number: 2, totalPages: 3, prevPath: '/chennai/plumbers-in-perambur', nextPath: '/chennai/plumbers-in-perambur/page/3' });
    expect(p3.page).toMatchObject({ number: 3, nextPath: null }); expect(p2.h1).toBe('Plumbers in Perambur, Chennai - Page 2'); expect(p2.meta.description).toMatch(/ Page 2\.$/);
    expect(new Set([p1, p2, p3].map((m) => m.meta.title)).size).toBe(3); expect(new Set([p1, p2, p3].map((m) => m.meta.description)).size).toBe(3);
    const names = [p1, p2, p3].flatMap((m) => m.cards.map((c) => c.name)); expect(new Set(names).size).toBe(5);   // no business repeats across pages
  });
  it('every title in the example is within 60 and carries the brand; every description within 160', async () => {
    const w = world({ directoryPageSizeMax: 2, directoryPageSizeDefault: 2 });
    for (const p of [...PATHS, '/chennai/plumbers-in-perambur/page/2', '/chennai/plumbers/page/3']) { const m = await ok(w.svc, p); expect(m.meta.title.length).toBeLessThanOrEqual(60); expect(m.meta.title.endsWith(' | Get4Domain')).toBe(true); expect(m.meta.description.length).toBeLessThanOrEqual(160); expect(m.h1.length).toBeLessThanOrEqual(H1_MAX); }
  });
});

describe('the brand suffix and the caps', () => {
  it('the suffix is never cut: a long name loses its own words, not the brand or the page marker', () => {
    const t = buildTitle(['{vendorName} | Plumber in Perambur, Chennai'], { vendorName: 'The Royal Southern Pipe Fitters and General Plumbing Contractors' }, { page: 12 });
    expect(t.length).toBeLessThanOrEqual(60); expect(t.endsWith(' - Page 12 | Get4Domain')).toBe(true);
  });
  it('a vendor on its own domain is not forced to carry the brand', () => { expect(buildTitle(['{vendorName} | Plumber in Perambur, Chennai'], { vendorName: 'Ranjith Plumber' }, { brand: false })).toBe('Ranjith Plumber | Plumber in Perambur, Chennai'); });
  it('a long H1 on a later page still fits with its page marker', async () => {
    const long = { ...DEFAULT_SEO_TEMPLATES, cityCategory: { ...DEFAULT_SEO_TEMPLATES.cityCategory, h1: ['{categoryPlural} in {city} '.repeat(8).trim()] } };
    const w = world({ directoryPageSizeMax: 2, directoryPageSizeDefault: 2 }, long);
    const m = await ok(w.svc, '/chennai/plumbers/page/2'); expect(m.h1.length).toBeLessThanOrEqual(H1_MAX); expect(m.h1.endsWith(' - Page 2')).toBe(true);
    expect(buildH1(['x'.repeat(200)], {}).length).toBeLessThanOrEqual(H1_MAX);
  });
});

describe('no ranking promises, anywhere the platform writes', () => {
  const claimFree = (s: string) => { expect(hasRankingClaim(s)).toBe(false); expect(isUnsafeSeoText(s)).toBe(false); };
  it('every title, description, H1, intro, FAQ and breadcrumb of every page of the example', async () => {
    const w = world({ directoryPageSizeMax: 2, directoryPageSizeDefault: 2 });
    for (const p of [...PATHS, '/chennai/plumbers-in-perambur/page/2']) {
      const m = await ok(w.svc, p);
      for (const s of [m.meta.title, m.meta.description, m.h1, m.intro, ...m.faq.flatMap((f) => [f.question, f.answer]), ...m.breadcrumbs.map((c) => c.name), ...m.facets.flatMap((f) => f.items.map((i) => i.name))]) claimFree(s);
    }
  });
  it('every default template candidate', () => {
    for (const t of SEO_PAGE_TYPES) for (const f of ['title', 'description', 'h1'] as const) for (const c of DEFAULT_SEO_TEMPLATES[t][f]) claimFree(c);
  });
  it('staff cannot save a template that claims a rank or a result, and a saved one that slips through is never used', () => {
    for (const bad of ['Best {categoryPlural} in {city}', 'Top {categoryPlural}', '#1 {categoryPlural} in {city}', '{categoryPlural} in {city}: guaranteed results', 'Ranked {categoryPlural} in {city}', 'The leading {categoryPlural}']) expect(seoTemplatesProblem({ cityCategory: { title: [bad] } })).toMatch(/cannot claim a rank/);
    expect(seoTemplatesProblem({ cityCategory: { title: ['{categoryPlural} in {city}'] } })).toBeNull();
    expect(resolveSeoTemplates({ cityCategory: { title: ['Best {categoryPlural}'] } }).cityCategory.title).toEqual(DEFAULT_SEO_TEMPLATES.cityCategory.title);
  });
  it("Ranjith's backlink block and the badge", () => {
    const b = buildBacklinkBlock({
      origin: 'https://get4domain.com', seed: 'b1', indexable: true, listed: null,
      pages: [{ kind: 'cityCategory', path: '/chennai/plumbers', place: 'Chennai', plural: 'Plumbers', singular: 'Plumber' }, { kind: 'localityCategory', path: '/chennai/plumbers-in-perambur', place: 'Perambur', city: 'Chennai', plural: 'Plumbers', singular: 'Plumber' }, { kind: 'category', path: '/category/plumber', plural: 'Plumbers', singular: 'Plumber' }, { kind: 'city', path: '/chennai', place: 'Chennai' }],
    });
    expect(b.links).toHaveLength(4); for (const l of b.links) claimFree(l.text); claimFree(badgeSvg().replace(/<[^>]+>/g, ' '));
    expect(b.links.map((l) => l.text).join(' ')).toMatch(/Chennai/); expect(b.links[0].text).toMatch(/Perambur/);
  });
});

// ─── prompt 8c: the four titles and descriptions of the example, together ───────────────────────────────────────────────────────────────────────
import { loadKit } from '../src/site-publish/renderer/renderer-loader';
import { pageArgs, planPages, toRendererInput } from '../src/site-publish/content/content-adapter';
import { buildPageSeo } from '../src/site-publish/seo/page-seo';
import { doc, YEAR } from './support/site-fixtures';

describe('Ranjith Plumber: vendor home, vendor services page, directory page 1 and page 2', () => {
  const kit = loadKit();
  const vendorSeo = (page: 'home' | 'services') => {
    const d = doc('plumber', { cms: { tagline: '', about: '' } });
    const input = toRendererInput(d, { categoryId: 'plumber', lang: 'en', year: YEAR, siteBase: 'get4domain.com' });
    const planned = planPages(input.content, ['home', 'about', 'services', 'gallery', 'contact', 'page', 'item']).find((p) => p.template === page)!;
    const args = pageArgs(input.content, planned);
    const rendered = kit.renderPage({ theme: kit.loadTheme('free-service-pro'), page: args.page, content: args.content, settings: input.settings, vendor: input.vendor, host: input.host, entitlements: { video: false, cart: false, booking: false, customDomain: false } });
    return buildPageSeo({
      rendered, path: planned.path, template: planned.template, lang: 'en', languages: ['en'], indexable: true, tagline: '', about: '', siteUrl: input.host.siteUrl, categoryId: 'plumber', siteName: 'Ranjith Plumber', city: 'Chennai', locality: 'Perambur',
      image: '', itemName: '', items: [], services: ['Tap repair', 'Pipe fitting', 'Leak detection'], vendorTemplates: { vendorHome: DEFAULT_SEO_TEMPLATES.vendorHome, vendorPage: DEFAULT_SEO_TEMPLATES.vendorPage },
    });
  };
  const LABEL = kit.categoryById('plumber').label;
  it('the four match the documented patterns, are unique, stay within 60 and 160, and carry the brand', async () => {
    const w = world({ directoryPageSizeMax: 2, directoryPageSizeDefault: 2 });
    const d1 = await ok(w.svc, '/chennai/plumbers-in-perambur'); const d2 = await ok(w.svc, '/chennai/plumbers-in-perambur/page/2');
    const home = vendorSeo('home'); const services = vendorSeo('services');
    expect(home.title).toBe(`Ranjith Plumber | ${LABEL} in Perambur, Chennai | Get4Domain`);
    expect(services.title).toMatch(/^Services \| Ranjith Plumber, .+ \| Get4Domain$/);
    expect(d1.meta.title).toBe('Plumbers in Perambur, Chennai | Get4Domain'); expect(d2.meta.title).toBe('Plumbers in Perambur, Chennai - Page 2 | Get4Domain');
    expect(home.description).toBe(`Ranjith Plumber, ${LABEL} in Perambur, Chennai. Services include Tap repair, Pipe fitting, Leak detection.`);
    expect(d1.meta.description).toBe('Find 5 Plumbers in Perambur, Chennai: addresses, services and websites.');
    const all = [{ t: home.title, d: home.description }, { t: services.title, d: services.description }, { t: d1.meta.title, d: d1.meta.description }, { t: d2.meta.title, d: d2.meta.description }];
    expect(new Set(all.map((x) => x.t)).size).toBe(4); expect(new Set(all.map((x) => x.d)).size).toBe(4);
    for (const x of all) { expect(x.t.length).toBeLessThanOrEqual(60); expect(x.t.endsWith(' | Get4Domain')).toBe(true); expect(x.d.length).toBeLessThanOrEqual(160); expect(x.d.length).toBeGreaterThan(30); claimFree(x.t); claimFree(x.d); }
  });
  it('the home page and directory descriptions name get4domain.com or the brand, as the owner asked', async () => {
    const home = await ok(world().svc, '/'); expect(home.meta.description).toContain('get4domain.com'); expect(home.meta.title).toContain('Get4Domain');
    expect((await ok(world().svc, '/chennai/plumbers')).meta.description).toContain('get4domain.com');
  });
});
function claimFree(s: string): void { expect(hasRankingClaim(s)).toBe(false); expect(isUnsafeSeoText(s)).toBe(false); }
