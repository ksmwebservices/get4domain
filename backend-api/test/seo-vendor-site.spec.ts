import { DEFAULT_SEO_TEMPLATES } from '../src/seo-directory/core/default-templates';
import { hasRankingClaim } from '../src/seo-directory/core/ranking-claims';
import { titleCase } from '../src/seo-directory/core/template-engine';
import { DEFAULT_SEO_CRAWLERS } from '../src/seo-directory/settings/seo-settings';
import { PageSeo, PageSeoArgs, buildPageSeo } from '../src/site-publish/seo/page-seo';
import { buildRobotsTxt } from '../src/site-publish/seo/site-files';
import { PrismaVendorSeoSettings, VendorSeoSettings, VendorSeoSettingsValue } from '../src/site-publish/seo/vendor-seo-settings';
import { loadKit } from '../src/site-publish/renderer/renderer-loader';
import { toRendererInput, pageArgs, planPages } from '../src/site-publish/content/content-adapter';
import { doc, YEAR } from './support/site-fixtures';
import { STAFF, siteWorld } from './support/site-world';

/** Slice 6: vendor-site SEO. The staff-editable vendorHome and vendorPage templates, the brand suffix rule, the crawler list in robots.txt, and the rebuild when staff change them. */
jest.setTimeout(120_000);
const kit = loadKit();
const ENT = { video: false, cart: false, booking: false, customDomain: false };
const TPL = { vendorHome: DEFAULT_SEO_TEMPLATES.vendorHome, vendorPage: DEFAULT_SEO_TEMPLATES.vendorPage };
const LABEL = titleCase(kit.categoryById('plumber').label);

function seo(page: string, o: Partial<PageSeoArgs> = {}, d = doc('plumber')): PageSeo {
  const input = toRendererInput(d, { categoryId: 'plumber', lang: 'en', year: YEAR, siteBase: 'get4domain.com' });
  const planned = planPages(input.content, ['home', 'about', 'services', 'gallery', 'contact', 'page', 'item']).find((p) => p.template === page)!;
  const args = pageArgs(input.content, planned);
  const rendered = kit.renderPage({ theme: kit.loadTheme('free-service-pro'), page: args.page, content: args.content, settings: input.settings, vendor: input.vendor, host: input.host, entitlements: ENT });
  return buildPageSeo({
    rendered, path: planned.path, template: planned.template, lang: 'en', languages: ['en'], indexable: true, tagline: String(d.cms?.tagline ?? ''), about: String(d.cms?.about ?? ''), siteUrl: input.host.siteUrl,
    categoryId: 'plumber', siteName: 'Ranjith Plumber', city: 'Chennai', image: '', itemName: planned.item ? String((planned.item as { name: string }).name) : '', items: [], ...o,
  });
}

describe('vendor titles from the templates', () => {
  it('the home page: "{vendorName} | {category} in {locality}, {city}" plus the brand, within 60', () => {
    const s = seo('home', { vendorTemplates: TPL, locality: 'Perambur' });
    expect(s.title).toBe(`Ranjith Plumber | ${LABEL} in Perambur, Chennai | Get4Domain`); expect(s.title.length).toBeLessThanOrEqual(60);
  });
  it('without a locality it falls back to the city form', () => { expect(seo('home', { vendorTemplates: TPL }).title).toBe(`Ranjith Plumber | ${LABEL} in Chennai | Get4Domain`); });
  it('a custom domain does not carry the brand suffix', () => {
    const s = seo('home', { vendorTemplates: TPL, locality: 'Perambur', brandSuffix: false });
    expect(s.title).toBe(`Ranjith Plumber | ${LABEL} in Perambur, Chennai`); expect(s.title).not.toContain('Get4Domain');
  });
  it('an inner page uses vendorPage: the page name first, then the vendor', () => {
    const s = seo('about', { vendorTemplates: TPL });
    expect(s.title).toMatch(/^About.* \| Ranjith Plumber/); expect(s.title).toMatch(/ \| Get4Domain$/); expect(s.title.length).toBeLessThanOrEqual(60);
  });
  it('a very long business name still gives a title within 60 that keeps the brand', () => {
    const s = seo('home', { vendorTemplates: TPL, siteName: 'The Royal Southern Pipe Fitters and General Plumbing Contractors', locality: 'Perambur' });
    expect(s.title.length).toBeLessThanOrEqual(60); expect(s.title.endsWith(' | Get4Domain')).toBe(true);
  });
  it("the vendor's own title wins when it fits, and an over-long one falls to the template", () => {
    expect(seo('home', { vendorTemplates: TPL, override: { title: 'Our own title' } }).title).toBe('Our own title');
    expect(seo('home', { vendorTemplates: TPL, locality: 'Perambur', override: { title: 'x'.repeat(61) } }).title).toBe(`Ranjith Plumber | ${LABEL} in Perambur, Chennai | Get4Domain`);
    expect(seo('home', { vendorTemplates: TPL, override: { title: 'Plumbing from ₹499' } }).title).toContain('Ranjith Plumber');
  });
  it('without templates nothing changes (the previous text, byte for byte)', () => {
    const before = seo('home'); const same = seo('home', { vendorTemplates: undefined, locality: 'Perambur', brandSuffix: false });
    expect(same).toEqual(before); expect(before.title).not.toContain('Get4Domain');
  });
});

describe('vendor descriptions and structured data', () => {
  it("the vendor's own sentences stay first; the template description is the fallback before the bare name line", () => {
    expect(seo('home', { vendorTemplates: TPL }).description).toContain('Leaks fixed fast');
    const bare = seo('home', { vendorTemplates: TPL, tagline: '', about: '', locality: 'Perambur' }, doc('plumber', { cms: { tagline: '', about: '' } }));
    expect(bare.description.length).toBeGreaterThan(30); expect(bare.description.length).toBeLessThanOrEqual(160);
  });
  it('adds url, areaServed and a postal address from facts the site states, never over the theme\'s own, and never an offer, price or rating', () => {
    const s = seo('home', { vendorTemplates: TPL }); const biz = s.jsonLd[0] as Record<string, unknown>;
    expect(biz.url).toMatch(/^https:\/\/sri-ganesh-plumbing\.get4domain\.com\/?$/);   // the theme's own url is kept expect(biz.areaServed).toEqual({ '@type': 'City', name: 'Chennai' }); expect(biz.address).toMatchObject({ '@type': 'PostalAddress', addressLocality: 'Chennai', addressCountry: 'IN' });
    expect(JSON.stringify(s.jsonLd)).not.toMatch(/offers|priceRange|aggregateRating|review|₹/);
    expect((seo('home').jsonLd[0] as Record<string, unknown>).areaServed).toBeUndefined();   // off without templates
  });
  it('no generated vendor text claims a rank', () => {
    for (const page of ['home', 'about', 'services', 'contact']) { const s = seo(page, { vendorTemplates: TPL, locality: 'Perambur' }); expect(hasRankingClaim(s.title)).toBe(false); expect(hasRankingClaim(s.description.replace(/Leaks fixed fast, every time\./, ''))).toBe(false); }
  });
});

describe('the vendor robots.txt', () => {
  it('names each crawler with Allow: /, ends with the catch-all group, and has a Sitemap line only when indexable', () => {
    const on = buildRobotsTxt(true, 'https://a.get4domain.com/sitemap.xml', ['Googlebot', 'GPTBot']);
    expect(on).toBe('User-agent: Googlebot\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: https://a.get4domain.com/sitemap.xml\n');
    const off = buildRobotsTxt(false, 'https://a.get4domain.com/sitemap.xml', [...DEFAULT_SEO_CRAWLERS]);
    expect(off).not.toContain('Sitemap:'); expect(off).not.toMatch(/Disallow:\s*\/\s*$/m); expect(off).not.toMatch(/Disallow/); expect(off.trimEnd().endsWith('Allow: /')).toBe(true);
    for (const c of DEFAULT_SEO_CRAWLERS) expect(off).toContain(`User-agent: ${c}\n`);
  });
  it('no crawler list gives exactly the previous text', () => { expect(buildRobotsTxt(false, 'x')).toBe('User-agent: *\nAllow: /\n'); });
});

describe('the settings the build reads', () => {
  const prisma = (rows: Array<{ key: string; valueJson: unknown }>) => ({ v3PlanSetting: { findMany: async () => rows } }) as never;
  it('falls back to the defaults, ignores an invalid stored value as a whole, and uses a valid one', async () => {
    expect(await new PrismaVendorSeoSettings(prisma([])).get()).toEqual({ vendorHome: DEFAULT_SEO_TEMPLATES.vendorHome, vendorPage: DEFAULT_SEO_TEMPLATES.vendorPage, crawlers: [...DEFAULT_SEO_CRAWLERS] });
    const bad = await new PrismaVendorSeoSettings(prisma([{ key: 'seoPageTemplates', valueJson: { vendorHome: { title: ['{nope}'] } } }, { key: 'seoCrawlerAgents', valueJson: ['*'] }])).get();
    expect(bad.vendorHome).toEqual(DEFAULT_SEO_TEMPLATES.vendorHome); expect(bad.crawlers).toEqual([...DEFAULT_SEO_CRAWLERS]);
    const good = await new PrismaVendorSeoSettings(prisma([{ key: 'seoPageTemplates', valueJson: { vendorHome: { title: ['{vendorName} in {city}'] } } }, { key: 'seoCrawlerAgents', valueJson: ['Googlebot'] }])).get();
    expect(good.vendorHome.title).toEqual(['{vendorName} in {city}']); expect(good.vendorHome.description).toEqual(DEFAULT_SEO_TEMPLATES.vendorHome.description); expect(good.crawlers).toEqual(['Googlebot']);
  });
  it('is cached for 30 seconds', async () => {
    let reads = 0; const s = new PrismaVendorSeoSettings({ v3PlanSetting: { findMany: async () => { reads++; return []; } } } as never); let now = 0; s.clock = () => now;
    await s.get(); await s.get(); expect(reads).toBe(1); now = 31_000; await s.get(); expect(reads).toBe(2);
  });
});

describe('through the real build', () => {
  const settings = (v: Partial<VendorSeoSettingsValue> = {}): VendorSeoSettings => ({ get: async () => ({ ...TPL, crawlers: ['Googlebot'], ...v }) });
  const withSeo = (s: VendorSeoSettings) => { const w = siteWorld({ kind: 'plumber', level: 'PRO', claimed: true }); Object.assign(w.build, { seoSettings: s }); return w; };
  it('writes the template title into every page and the crawler groups into robots.txt', async () => {
    const w = withSeo(settings()); const { publication } = await w.build.build('v-plumber', { actor: STAFF });
    const pages = await w.repo.pagesOf(publication.id);
    const home = pages.find((p) => p.path === '/')!.html; expect(home).toMatch(/<title>Sri Ganesh Plumbing \| .+ \| Get4Domain<\/title>/);
    expect(pages.find((p) => p.path === '/robots.txt')!.html.startsWith('User-agent: Googlebot\nAllow: /\n\nUser-agent: *\n')).toBe(true);
    for (const p of pages.filter((x) => x.path.endsWith('.html') || !x.path.includes('.'))) expect(p.html).toMatch(/<title>[^<]{1,60}<\/title>/);
  });
  it('without the settings port the build is exactly what it was', async () => {
    const w = siteWorld({ kind: 'plumber', level: 'PRO', claimed: true }); const { publication } = await w.build.build('v-plumber', { actor: STAFF });
    const pages = await w.repo.pagesOf(publication.id);
    expect(pages.find((p) => p.path === '/robots.txt')!.html).toMatch(/^User-agent: \*\nAllow: \/\n/); expect(pages.find((p) => p.path === '/')!.html).not.toMatch(/<title>[^<]*Get4Domain<\/title>/);
  });
  it('a change staff make to the templates or the crawler list rebuilds an unchanged site; the same settings reuse the build', async () => {
    const holder = { v: settings() }; const w = withSeo({ get: () => holder.v.get() });
    const a = await w.build.build('v-plumber', { actor: STAFF }); const b = await w.build.build('v-plumber', { actor: STAFF });
    expect(b.reused).toBe(true); expect(b.publication.id).toBe(a.publication.id);
    holder.v = settings({ vendorHome: { ...TPL.vendorHome, title: ['{vendorName} - {city}'] } }); const c = await w.build.build('v-plumber', { actor: STAFF });
    expect(c.reused).toBe(false); expect(c.publication.version).toBe(2);
    holder.v = settings({ vendorHome: { ...TPL.vendorHome, title: ['{vendorName} - {city}'] }, crawlers: ['Googlebot', 'Bingbot'] }); expect((await w.build.build('v-plumber', { actor: STAFF })).reused).toBe(false);
  });
  it('a custom domain host builds titles without the brand suffix', async () => {
    const hosts = { primary: async () => ({ host: 'sriganesh.example.in', isCustom: true }), hasVerifiedCustomDomain: async () => true };
    const w = siteWorld({ kind: 'plumber', level: 'PRO', claimed: true, hosts: hosts as never }); Object.assign(w.build, { seoSettings: settings() });
    const { publication } = await w.build.build('v-plumber', { actor: STAFF });
    const home = (await w.repo.pagesOf(publication.id)).find((p) => p.path === '/')!.html; expect(home).toMatch(/<title>Sri Ganesh Plumbing \| [^<|]+<\/title>/); expect(home).not.toMatch(/<title>[^<]*Get4Domain/);
  });
});
