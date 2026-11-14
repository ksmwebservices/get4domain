import { DEFAULT_DIRECTORY_SETTINGS, DirectorySettings, directorySettingProblem } from '../src/directory/settings/directory-settings';
import { CategoryRow, LocationRow } from '../src/directory/directory.repository';
import { buildPath, canonicalOrigin, clickOutUrl, parsePath, splitTail } from '../src/seo-directory/core/url-scheme';
import { DEFAULT_SEO_TEMPLATES } from '../src/seo-directory/core/default-templates';
import { KeywordRow, SeoKeywordStore } from '../src/seo-directory/keywords/seo-keyword.store';
import { FacetCounts, ListedBusiness, Scope, SeoDirectoryData } from '../src/seo-directory/pages/seo-directory.data';
import { NoPageOverrides, PageOverride, rollUp, SeoPageOverrides, SeoPageService } from '../src/seo-directory/pages/seo-page.service';
import { PageModel } from '../src/seo-directory/core/page-model';

const loc = (id: string, parentId: string | null, kind: LocationRow['kind'], name: string, slug: string, sortOrder = 0): LocationRow => ({ id, parentId, parentKey: parentId ?? 'ROOT', kind, name, slug, sortOrder, proposed: false, active: true });
const cat = (id: string, parentId: string | null, name: string, slug: string, sortOrder = 0): CategoryRow => ({ id, parentId, parentKey: parentId ?? 'ROOT', name, slug, themeCategoryId: null, family: null, sortOrder, proposed: false, active: true });

const LOCS = [
  loc('tn', null, 'STATE', 'Tamil Nadu', 'tamil-nadu'), loc('chd', 'tn', 'DISTRICT', 'Chennai District', 'chennai-district'), loc('chn', 'chd', 'CITY', 'Chennai', 'chennai'),
  loc('per', 'chn', 'LOCALITY', 'Perambur', 'perambur'), loc('ady', 'chn', 'LOCALITY', 'Adyar', 'adyar'), loc('nun', 'chn', 'LOCALITY', 'Nungambakkam', 'nungambakkam'), loc('mdu', 'tn', 'CITY', 'Madurai', 'madurai'),
];
const CATS = [cat('fam', null, 'Home services', 'home-services'), cat('plm', 'fam', 'Plumber', 'plumber'), cat('ele', 'fam', 'Electrician', 'electrician', 1)];

let seq = 0;
const biz = (o: Partial<ListedBusiness> & { name: string }): ListedBusiness => ({
  id: `b${++seq}`, slug: o.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), categoryId: 'plm', locationId: 'per', pincode: '600011', descriptionText: '', status: 'CLAIMED', indexable: true, vendorId: `v${seq}`, claimed: true,
  address: {}, hours: {}, geo: null, imageUrl: null, updatedAt: new Date('2026-11-01T00:00:00Z'), ...o,
});

class MemData extends SeoDirectoryData {
  rows: ListedBusiness[] = [];
  private match(s: Scope): ListedBusiness[] { return this.rows.filter((b) => ['CLAIMED', 'UNCLAIMED', 'SUSPENDED'].includes(b.status) && (!s.locationIds || (b.locationId !== null && s.locationIds.includes(b.locationId))) && (!s.categoryIds || s.categoryIds.includes(b.categoryId)) && (!s.pincode || b.pincode === s.pincode)).sort((a, b) => a.name.localeCompare(b.name)); }
  async businesses(s: Scope, skip: number, take: number) { const all = this.match(s); return { items: all.slice(skip, skip + take), total: all.length }; }
  async facets(s: Scope): Promise<FacetCounts> {
    const f: FacetCounts = { byLocation: new Map(), byCategory: new Map(), byPincode: new Map() };
    for (const b of this.match(s)) { if (b.locationId) f.byLocation.set(b.locationId, (f.byLocation.get(b.locationId) ?? 0) + 1); f.byCategory.set(b.categoryId, (f.byCategory.get(b.categoryId) ?? 0) + 1); if (b.pincode) f.byPincode.set(b.pincode, (f.byPincode.get(b.pincode) ?? 0) + 1); }
    return f;
  }
  async businessBySlug(slug: string) { return this.rows.find((b) => b.slug === slug) ?? null; }
}
class MemKeywords extends SeoKeywordStore {
  async list() { return { items: [], total: 0 }; }
  async all(): Promise<KeywordRow[]> { return [{ id: 'k1', categorySlug: 'plumber', name: 'Plumber', singular: 'plumber', plural: 'plumbers', synonyms: [], specialisations: [], source: 'DERIVED', updatedByStaffId: null, updatedAt: new Date(0) }, { id: 'k2', categorySlug: 'electrician', name: 'Electrician', singular: 'electrician', plural: '', synonyms: [], specialisations: [], source: 'DERIVED', updatedByStaffId: null, updatedAt: new Date(0) }]; }
  async get() { return null; } async upsertDerived() { /* none */ } async staffUpdate() { return null; }
}

function world(over: Partial<DirectorySettings> = {}, appUrl = 'https://get4domain.com') {
  const data = new MemData(); const sites = new Map<string, { subdomain: string | null; proActive: boolean }>();
  const settings = { ...DEFAULT_DIRECTORY_SETTINGS, ...over };
  const overrides: { v: PageOverride | null } = { v: null };
  const svc = new SeoPageService(
    data,
    { listLocations: async () => LOCS, listCategories: async () => CATS, siteFacts: async (ids: string[]) => new Map(ids.filter((i) => sites.has(i)).map((i) => [i, sites.get(i)!])) } as never,
    { get: async () => settings, readPublicAppUrl: async () => appUrl } as never,
    new MemKeywords(),
    { templates: async () => DEFAULT_SEO_TEMPLATES } as never,
    { forPath: async () => overrides.v } as SeoPageOverrides,
  );
  return { svc, data, sites, settings, overrides };
}
const ok = async (svc: SeoPageService, path: string): Promise<PageModel> => { const r = await svc.resolve(path); if (r.kind !== 'ok') throw new Error(`${path}: ${r.kind}`); return r.model; };
const fiveInPerambur = (d: MemData) => { for (const n of ['Anand Plumbing', 'Bala Plumbers', 'Chandra Pipes', 'Dev Plumber', 'Eswar Plumbing']) d.rows.push(biz({ name: n })); };

describe('url scheme', () => {
  it('builds every path', () => {
    expect(buildPath({ type: 'home' })).toBe('/');
    expect(buildPath({ type: 'city', city: 'chennai', page: 1 })).toBe('/chennai');
    expect(buildPath({ type: 'cityCategory', city: 'chennai', term: 'plumbers', page: 1 })).toBe('/chennai/plumbers');
    expect(buildPath({ type: 'localityCategory', city: 'chennai', locality: 'adyar', term: 'plumbers', page: 2 })).toBe('/chennai/plumbers-in-adyar/page/2');
    expect(buildPath({ type: 'category', category: 'plumber', page: 1 })).toBe('/category/plumber');
    expect(buildPath({ type: 'pincodeCategory', pincode: '600011', category: 'plumber', page: 3 })).toBe('/pincode/600011/plumber/page/3');
    expect(buildPath({ type: 'state', state: 'tamil-nadu', page: 1 })).toBe('/state/tamil-nadu');
    expect(buildPath({ type: 'business', slug: 'acme' })).toBe('/business/acme');
  });
  it('parses them back, with a trailing slash, a query and uppercase', () => {
    expect(parsePath('/')).toEqual({ type: 'home' });
    expect(parsePath('/Chennai/?utm_source=x')).toEqual({ type: 'city', city: 'chennai', page: 1 });
    expect(parsePath('/chennai/plumbers-in-adyar/page/2')).toEqual({ type: 'cityRest', city: 'chennai', rest: 'plumbers-in-adyar', page: 2 });
    expect(parsePath('/pincode/600011/plumber')).toEqual({ type: 'pincodeCategory', pincode: '600011', category: 'plumber', page: 1 });
    expect(parsePath('/category/plumber/page/4')).toEqual({ type: 'category', category: 'plumber', page: 4 });
  });
  it('refuses page 1, a page above the cap, reserved first segments, bad characters and extra segments', () => {
    for (const p of ['/chennai/page/1', '/chennai/page/1001', '/chennai/page/x', '/v3/directory', '/go/abc', '/a/b/c', '/chennai/<script>', '/pincode/12345/plumber', 'chennai', '/page/2', '/business/x/page/2', '/category', '']) expect(parsePath(p)).toBeNull();
  });
  it('splits a tail on every "-in-"', () => { expect(splitTail('plumbers-in-adyar')).toEqual([{ term: 'plumbers-in-adyar', locality: null }, { term: 'plumbers', locality: 'adyar' }]); expect(splitTail('plumbers')).toEqual([{ term: 'plumbers', locality: null }]); });
  it('the canonical origin drops www and keeps the port', () => { expect(canonicalOrigin('https://www.get4domain.com/')).toBe('https://get4domain.com'); expect(canonicalOrigin('http://www.localhost:3000')).toBe('http://localhost:3000'); expect(canonicalOrigin('nonsense')).toBe(''); });
  it('the click-out address carries only the page type and an optional keyword target', () => {
    expect(clickOutUrl('https://api.get4domain.com/', 'b1', { src: 'localityCategory', kw: 'kt1' })).toBe('https://api.get4domain.com/v3/go/b1?src=localityCategory&kw=kt1');
    expect(clickOutUrl('', 'b 1', { src: 'home' })).toBe('/v3/go/b%201?src=home');
  });
});

describe('the page model of a locality + category page', () => {
  it('has the documented title, description, h1, canonical and breadcrumbs', async () => {
    const w = world({ directoryPagesIndexable: true }); fiveInPerambur(w.data);
    const m = await ok(w.svc, '/chennai/plumbers-in-perambur');
    expect(m.type).toBe('localityCategory'); expect(m.path).toBe('/chennai/plumbers-in-perambur');
    expect(m.meta.title).toBe('Plumbers in Perambur, Chennai | Get4Domain');
    expect(m.meta.description).toBe('Find 5 Plumbers in Perambur, Chennai: addresses, services and websites.');
    expect(m.h1).toBe('Plumbers in Perambur, Chennai');
    expect(m.meta.canonical).toBe('https://get4domain.com/chennai/plumbers-in-perambur');
    expect(m.breadcrumbs.map((c) => c.name)).toEqual(['Get4Domain', 'Chennai', 'Plumbers in Chennai', 'Plumbers in Perambur']);
    expect(m.meta.hreflang).toEqual([]);
    expect(m.cards).toHaveLength(5); expect(m.page).toMatchObject({ number: 1, totalPages: 1, total: 5, prev: null, next: null });
    expect(m.intro).toContain('5 Plumbers in Perambur, Chennai');
  });
  it('is noindex while directoryPagesIndexable is OFF (the default), and says why', async () => {
    expect(DEFAULT_DIRECTORY_SETTINGS.directoryPagesIndexable).toBe(false);
    const w = world(); fiveInPerambur(w.data);
    const m = await ok(w.svc, '/chennai/plumbers-in-perambur');
    expect(m.meta).toMatchObject({ indexable: false, noindexReason: 'FLAG_OFF', robots: 'noindex, follow' });
    for (const p of ['/', '/chennai', '/state/tamil-nadu', '/category/plumber', '/chennai/plumbers', '/pincode/600011/plumber', '/business/anand-plumbing']) expect((await ok(w.svc, p)).meta.indexable).toBe(false);
  });
  it('is indexable with the flag ON, unless thin or empty (still reachable)', async () => {
    const w = world({ directoryPagesIndexable: true }); fiveInPerambur(w.data); w.data.rows.push(biz({ name: 'Solo Plumber', locationId: 'ady' }));
    expect(await ok(w.svc, '/chennai/plumbers-in-perambur')).toMatchObject({ meta: { indexable: true, noindexReason: null, robots: 'index, follow, max-image-preview:large' } });
    expect((await ok(w.svc, '/chennai/plumbers-in-adyar')).meta).toMatchObject({ indexable: false, noindexReason: 'THIN' });
    expect((await ok(w.svc, '/chennai/plumbers-in-nungambakkam')).meta).toMatchObject({ indexable: false, noindexReason: 'EMPTY' });
  });
  it('the www host is never canonical', async () => {
    const w = world({ directoryPagesIndexable: true }, 'https://www.get4domain.com'); fiveInPerambur(w.data);
    expect((await ok(w.svc, '/chennai/plumbers-in-perambur')).meta.canonical).toBe('https://get4domain.com/chennai/plumbers-in-perambur');
  });
  it('the other page types resolve, with their own titles', async () => {
    const w = world({ directoryPagesIndexable: true }); fiveInPerambur(w.data);
    expect((await ok(w.svc, '/')).meta.title).toBe('Local Business Directory and Websites in India | Get4Domain');
    expect((await ok(w.svc, '/chennai')).meta.title).toBe('Businesses in Chennai | Get4Domain');
    expect((await ok(w.svc, '/state/tamil-nadu')).meta.title).toBe('Businesses in Tamil Nadu | Get4Domain');
    expect((await ok(w.svc, '/category/plumber')).meta.title).toBe('Plumbers Near You | Get4Domain');
    expect((await ok(w.svc, '/chennai/plumbers')).meta.title).toBe('Plumbers in Chennai | Get4Domain');
    expect((await ok(w.svc, '/pincode/600011/plumber')).meta.title).toBe('Plumbers in 600011, Chennai | Get4Domain');
    expect((await ok(w.svc, '/chennai/plumbers')).facets.find((f) => f.kind === 'locality')?.items[0]).toMatchObject({ name: 'Perambur', path: '/chennai/plumbers-in-perambur', count: 5 });
  });
  it('a category with no plural falls back to its singular and every page title stays within 60 and carries the brand', async () => {
    const w = world({ directoryPagesIndexable: true }); w.data.rows.push(biz({ name: 'Volt Works', categoryId: 'ele' }));
    const m = await ok(w.svc, '/chennai/electrician');
    expect(m.meta.title).toBe('Electrician in Chennai | Get4Domain');
    for (const p of ['/', '/chennai', '/category/electrician', '/chennai/electrician']) { const t = (await ok(w.svc, p)).meta.title; expect(t.length).toBeLessThanOrEqual(60); expect(t.endsWith(' | Get4Domain')).toBe(true); }
  });
});

describe('not found and gone', () => {
  it('unknown places, categories and pages are 404; an empty pincode page is 404', async () => {
    const w = world(); fiveInPerambur(w.data);
    for (const p of ['/nowhere', '/chennai/gardeners', '/chennai/plumbers-in-mars', '/category/nope', '/state/nope', '/pincode/999999/plumber', '/business/nope', '/chennai/page/2', '/madurai/plumbers/page/2', '/chennai/plumbers-in-perambur/page/9']) expect((await w.svc.resolve(p)).kind).toBe('notFound');
  });
  it('a removed business is 410 and a draft is 404', async () => {
    const w = world(); w.data.rows.push(biz({ name: 'Gone Co', status: 'REMOVED' }), biz({ name: 'Draft Co', status: 'DRAFT' }));
    expect((await w.svc.resolve('/business/gone-co')).kind).toBe('gone'); expect((await w.svc.resolve('/business/draft-co')).kind).toBe('notFound');
  });
  it('removed and draft businesses are never on a listing', async () => {
    const w = world(); fiveInPerambur(w.data); w.data.rows.push(biz({ name: 'Gone Co', status: 'REMOVED' }), biz({ name: 'Draft Co', status: 'DRAFT' }));
    expect((await ok(w.svc, '/chennai/plumbers-in-perambur')).cards.map((c) => c.name)).not.toContain('Gone Co');
  });
});

describe('pagination', () => {
  const setup = () => { const w = world({ directoryPagesIndexable: true, directoryPageSizeMax: 2, directoryPageSizeDefault: 2 }); fiveInPerambur(w.data); return w; };
  it('page 1 is the base URL; page N has a path suffix, "Page N" in the title, a self canonical, prev and next', async () => {
    const w = setup();
    const p1 = await ok(w.svc, '/chennai/plumbers-in-perambur'); const p2 = await ok(w.svc, '/chennai/plumbers-in-perambur/page/2'); const p3 = await ok(w.svc, '/chennai/plumbers-in-perambur/page/3');
    expect(p1.page).toMatchObject({ totalPages: 3, prev: null, next: 'https://get4domain.com/chennai/plumbers-in-perambur/page/2' });
    expect(p1.meta.canonical).toBe('https://get4domain.com/chennai/plumbers-in-perambur');
    expect(p2.meta.title).toBe('Plumbers in Perambur, Chennai - Page 2 | Get4Domain');
    expect(p2.meta.canonical).toBe('https://get4domain.com/chennai/plumbers-in-perambur/page/2');
    expect(p2.page).toMatchObject({ number: 2, prev: 'https://get4domain.com/chennai/plumbers-in-perambur', next: 'https://get4domain.com/chennai/plumbers-in-perambur/page/3' });
    expect(p3.page).toMatchObject({ next: null, nextPath: null });
    expect(p3.cards).toHaveLength(1); expect(p2.h1).toBe('Plumbers in Perambur, Chennai - Page 2');
  });
  it('page 1 and page 2 differ in title and description, and all stay within 60 and 160', async () => {
    const w = setup();
    const p1 = await ok(w.svc, '/chennai/plumbers-in-perambur'); const p2 = await ok(w.svc, '/chennai/plumbers-in-perambur/page/2');
    expect(p2.meta.title).not.toBe(p1.meta.title); expect(p2.meta.description).not.toBe(p1.meta.description);
    expect(p2.meta.description).toMatch(/Page 2\.$/);
    for (const m of [p1, p2]) { expect(m.meta.title.length).toBeLessThanOrEqual(60); expect(m.meta.description.length).toBeLessThanOrEqual(160); }
  });
  it('ItemList positions continue across pages', async () => {
    const w = setup(); const p2 = await ok(w.svc, '/chennai/plumbers-in-perambur/page/2');
    const list = (p2.jsonLd.find((j) => j['@type'] === 'CollectionPage') as { mainEntity: { itemListElement: Array<{ position: number }> } }).mainEntity.itemListElement;
    expect(list.map((i) => i.position)).toEqual([3, 4]);
  });
  it('the page size is capped by the settings', async () => {
    const w = world({ directoryPageSizeMax: 3, directoryPageSizeDefault: 3 }); fiveInPerambur(w.data);
    expect((await ok(w.svc, '/chennai/plumbers-in-perambur')).cards).toHaveLength(3);
  });
});

describe('cards: click-out and privacy', () => {
  it('a card has the click-out address when the business has a subdomain site, and is a listing only when it has none', async () => {
    const w = world(); const a = biz({ name: 'With Site' }); const b = biz({ name: 'No Site' }); w.data.rows.push(a, b); w.sites.set(a.vendorId!, { subdomain: 'withsite', proActive: false });
    const cards = (await ok(w.svc, '/chennai/plumbers-in-perambur')).cards;
    const withSite = cards.find((c) => c.name === 'With Site')!; const noSite = cards.find((c) => c.name === 'No Site')!;
    expect(withSite.visitUrl).toBe(`/v3/go/${a.id}?src=localityCategory`); expect(withSite.listingOnly).toBe(false);
    expect(noSite.visitUrl).toBeNull(); expect(noSite.listingOnly).toBe(true);
  });
  it('the card never carries a custom domain, the subdomain, a vendor id, a phone or an email', async () => {
    const w = world(); const a = biz({ name: 'With Site' }); w.data.rows.push(a); w.sites.set(a.vendorId!, { subdomain: 'withsite', proActive: true });
    const json = JSON.stringify(await ok(w.svc, '/chennai/plumbers-in-perambur'));
    expect(json).not.toContain('withsite'); expect(json).not.toContain(a.vendorId!); expect(json).not.toMatch(/phone|email|telephone|₹/i);
  });
  it('an unclaimed listing shows no hours and no image; a claimed one shows them; a Pro claimed one is verified', async () => {
    const w = world(); const c = biz({ name: 'Claimed Co', hours: { text: 'Mon-Sat 9 to 6' }, imageUrl: 'https://img.example/a.jpg' }); const u = biz({ name: 'Unclaimed Co', status: 'UNCLAIMED', claimed: false, hours: { text: 'Mon-Sat 9 to 6' }, imageUrl: 'https://img.example/b.jpg' });
    w.data.rows.push(c, u); w.sites.set(c.vendorId!, { subdomain: 'c', proActive: true });
    const cards = (await ok(w.svc, '/chennai/plumbers-in-perambur')).cards;
    expect(cards.find((x) => x.name === 'Claimed Co')).toMatchObject({ claimed: true, verified: true, hoursText: 'Mon-Sat 9 to 6', imageUrl: 'https://img.example/a.jpg' });
    expect(cards.find((x) => x.name === 'Unclaimed Co')).toMatchObject({ claimed: false, verified: false, hoursText: null, imageUrl: null });
  });
  it('a description with a price is left out of the card', async () => {
    const w = world(); w.data.rows.push(biz({ name: 'Priced Co', descriptionText: 'Visits from ₹499 only' }), biz({ name: 'Plain Co', descriptionText: 'Pipe repair and fitting for homes.' }));
    const cards = (await ok(w.svc, '/chennai/plumbers-in-perambur')).cards;
    expect(cards.find((x) => x.name === 'Priced Co')!.description).toBeNull(); expect(cards.find((x) => x.name === 'Plain Co')!.description).toBe('Pipe repair and fitting for homes.');
  });
});

describe('structured data, facets, related links and FAQ', () => {
  it('carries a CollectionPage with an ItemList, a BreadcrumbList and the Get4Domain publisher, and no price, rating or review', async () => {
    const w = world({ directoryPagesIndexable: true }); fiveInPerambur(w.data);
    const m = await ok(w.svc, '/chennai/plumbers-in-perambur');
    const types = m.jsonLd.map((j) => j['@type']); expect(types).toEqual(['CollectionPage', 'BreadcrumbList']);
    expect((m.jsonLd[0] as { publisher: { name: string } }).publisher.name).toBe('Get4Domain');
    expect(JSON.stringify(m.jsonLd)).not.toMatch(/offers|price|aggregateRating|review|₹/i);
  });
  it('the home page also has a WebSite block', async () => { const w = world(); expect((await ok(w.svc, '/')).jsonLd.map((j) => j['@type'])).toEqual(['WebSite', 'BreadcrumbList']); });
  it('nearby localities and related categories only list pages that have businesses', async () => {
    const w = world(); fiveInPerambur(w.data); w.data.rows.push(biz({ name: 'Adyar Pipes', locationId: 'ady', pincode: '600020' }), biz({ name: 'Volt Works', categoryId: 'ele' }));
    const m = await ok(w.svc, '/chennai/plumbers-in-perambur');
    expect(m.related.nearbyLocalities).toEqual([{ name: 'Adyar', path: '/chennai/plumbers-in-adyar', count: 1 }]);
    expect(m.related.relatedCategories.map((l) => l.path)).toEqual(['/chennai/electrician']);
    expect(m.related.parents.map((l) => l.path)).toEqual(['/', '/chennai', '/chennai/plumbers']);
    expect(m.facets.find((f) => f.kind === 'pincode')?.items).toEqual([{ name: '600011', path: '/pincode/600011/plumber', count: 5 }]);
  });
  it('the FAQ is built from stored facts only', async () => {
    const w = world(); fiveInPerambur(w.data); w.data.rows.push(biz({ name: 'Adyar Pipes', locationId: 'ady' }));
    const faq = (await ok(w.svc, '/chennai/plumbers-in-perambur')).faq;
    expect(faq[0]).toEqual({ question: 'How many Plumbers are listed in Perambur, Chennai?', answer: '5 Plumbers are listed on Get4Domain in Perambur, Chennai.' });
    expect(faq[1].answer).toBe('Adyar.'); expect(faq[2].question).toBe('How do I claim a listing?');
    expect(JSON.stringify(faq)).not.toMatch(/₹|rating|best|cheap|hour|day|week|month/i);
  });
  it('an empty page gives an honest intro and only the claim question', async () => {
    const w = world(); const m = await ok(w.svc, '/chennai/plumbers-in-nungambakkam');
    expect(m.intro).toBe('There are no Plumbers listed in Nungambakkam, Chennai on Get4Domain yet.'); expect(m.faq.map((f) => f.question)).toEqual(['How do I claim a listing?']);
    expect(m.cards).toEqual([]);
  });
});

describe('business page', () => {
  it('claimed: LocalBusiness with address, no telephone; breadcrumbs and title from the template', async () => {
    const w = world({ directoryPagesIndexable: true }); const a = biz({ name: 'Ranjith Plumber', address: { line1: '12 Main Road' }, geo: { lat: 13.1, lng: 80.2 }, descriptionText: 'Plumbing repairs and fitting for homes in Perambur.' }); w.data.rows.push(a); w.sites.set(a.vendorId!, { subdomain: 'ranjith', proActive: false });
    const m = await ok(w.svc, '/business/ranjith-plumber');
    expect(m.meta.title).toBe('Ranjith Plumber | Plumber in Perambur, Chennai | Get4Domain');
    expect(m.meta).toMatchObject({ indexable: true, canonical: 'https://get4domain.com/business/ranjith-plumber' });
    const ld = m.jsonLd[0] as Record<string, unknown>; expect(ld['@type']).toBe('LocalBusiness'); expect(JSON.stringify(ld)).not.toMatch(/telephone|price|rating|review|offers/i);
    expect(ld.address).toMatchObject({ streetAddress: '12 Main Road', addressLocality: 'Perambur', postalCode: '600011' });
    expect(m.business).toMatchObject({ visitUrl: `/v3/go/${a.id}?src=business`, listingOnly: false });
    expect(m.breadcrumbs.map((c) => c.name)).toEqual(['Get4Domain', 'Chennai', 'Plumbers in Chennai', 'Plumbers in Perambur', 'Ranjith Plumber']);
  });
  it('unclaimed: no address, position or hours, and noindex unless the business is indexable; suspended is noindex', async () => {
    const w = world({ directoryPagesIndexable: true }); w.data.rows.push(biz({ name: 'Quiet Co', status: 'UNCLAIMED', claimed: false, indexable: false, address: { line1: '9 Hidden St' }, geo: { lat: 1, lng: 2 } }), biz({ name: 'Paused Co', status: 'SUSPENDED', claimed: true }));
    const q = await ok(w.svc, '/business/quiet-co'); expect(q.meta).toMatchObject({ indexable: false, noindexReason: 'UNCLAIMED' });
    expect(JSON.stringify(q.jsonLd)).not.toContain('Hidden'); expect(q.business).toMatchObject({ address: null, geo: null });
    expect((await ok(w.svc, '/business/paused-co')).meta).toMatchObject({ indexable: false, noindexReason: 'SUSPENDED' });
  });
});

describe('overrides, roll-up and the setting', () => {
  it('a staff override replaces the title, description and h1 but stays capped, and page 2 still says Page 2', async () => {
    const w = world({ directoryPagesIndexable: true, directoryPageSizeMax: 2, directoryPageSizeDefault: 2 }); fiveInPerambur(w.data);
    w.overrides.v = { title: 'Emergency Plumbers Perambur Chennai Home Service Quick Visits', description: 'D'.repeat(200), h1: 'Plumbers around Perambur' };
    const m = await ok(w.svc, '/chennai/plumbers-in-perambur/page/2');
    expect(m.meta.title.length).toBeLessThanOrEqual(60); expect(m.meta.title).toMatch(/ - Page 2 \| Get4Domain$/); expect(m.meta.description.length).toBeLessThanOrEqual(160); expect(m.h1).toBe('Plumbers around Perambur - Page 2');
  });
  it('the default overrides provider returns nothing', async () => { expect(await new NoPageOverrides().forPath()).toBeNull(); });
  it('rolls counts up to every ancestor', () => {
    const r = rollUp(LOCS, new Map([['per', 5], ['ady', 1], ['mdu', 2]]));
    expect(r.get('chn')).toBe(6); expect(r.get('tn')).toBe(8); expect(r.get('mdu')).toBe(2); expect(r.get('nun')).toBeUndefined();
  });
  it('directoryPagesIndexable is a boolean setting, OFF by default', () => {
    expect(directorySettingProblem('directoryPagesIndexable', true)).toBeNull(); expect(directorySettingProblem('directoryPagesIndexable', 'yes')).toMatch(/true or false/);
    expect(DEFAULT_DIRECTORY_SETTINGS.directoryPagesIndexable).toBe(false);
  });
});
