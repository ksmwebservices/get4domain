import { toRendererInput, planPages, pageArgs, categoryFor } from '../src/site-publish/content/content-adapter';
import { evaluateIndexing, homeContentOk } from '../src/site-publish/seo/indexing-rule';
import { buildPageSeo, assembleDocument, robotsValue, PageSeo } from '../src/site-publish/seo/page-seo';
import { buildRobotsTxt, buildSitemap } from '../src/site-publish/seo/site-files';
import { composeDescription, fitTitle, isUnsafeSeoText, safeSeoText } from '../src/site-publish/seo/seo-text';
import { loadKit } from '../src/site-publish/renderer/renderer-loader';
import { SourceDocument } from '../src/site-publish/content/content-types';
import { doc, YEAR } from './support/site-fixtures';

/** S54.5: the platform SEO layer (pure) and the indexing rule. Fixtures per track and per language, with the real renderer's output as input. */
jest.setTimeout(120_000);
const kit = loadKit();
const ENT = { video: false, cart: false, booking: false, customDomain: false };
const THEME = { plumber: 'free-service-pro', dentist: 'free-practice', jewellery: 'free-shop-lite' } as const;
const SCHEMA = { plumber: 'Plumber', dentist: 'Dentist', jewellery: 'JewelryStore' } as const;

function seoFor(d: SourceDocument, kind: keyof typeof THEME, lang: 'en' | 'ta', page = 'home', opts: { indexable?: boolean; languages?: Array<'en' | 'ta'> } = {}): PageSeo {
  const input = toRendererInput(d, { categoryId: kind === 'jewellery' ? 'jewellery' : kind, lang, year: YEAR, siteBase: 'get4domain.com' });
  const planned = planPages(input.content, ['home', 'about', 'services', 'gallery', 'contact', 'page', 'item']).find((p) => p.template === page)!;
  const args = pageArgs(input.content, planned);
  const rendered = kit.renderPage({ theme: kit.loadTheme(THEME[kind]), page: args.page, content: args.content, settings: input.settings, vendor: input.vendor, host: input.host, entitlements: ENT });
  return buildPageSeo({
    rendered, path: planned.path, template: planned.template, lang, languages: opts.languages ?? ['en'], indexable: opts.indexable ?? false,
    tagline: String(d.cms?.tagline ?? ''), about: String(d.cms?.about ?? ''), siteUrl: input.host.siteUrl, categoryId: kind, siteName: d.cms?.businessName ?? d.vendor.businessName, city: String((input.content.contact as { city: string }).city),
    image: d.cms?.banner ?? '', itemName: planned.item ? String((planned.item as { name: string }).name) : '',
    items: ((input.content.items as Array<{ name: string; description: string; image: string }>) ?? []),
  });
}
const allStrings = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach((x) => allStrings(x, out));
  return out;
};

describe('seo text safety', () => {
  it.each(['Plumbing from ₹999', 'Rs. 499 only', 'Rs 1,200 per visit', 'INR 500 service', 'from 999/month', '500 rupees', 'Workspace plan', 'The BOS plan', 'LeadSpace page', 'Your Online Identity Partner'])('%s is unsafe', (s) => { expect(isUnsafeSeoText(s)).toBe(true); });
  it.each(['Plumber in Chennai', 'We keep prices clear and arrive on time.', 'Open 9 to 6, Monday to Saturday', 'காவேரி பிளம்பிங் - சென்னை'])('%s is safe', (s) => { expect(isUnsafeSeoText(s)).toBe(false); });
  it('safeSeoText falls back when the text is unsafe or empty', () => { expect(safeSeoText('From ₹99', 'Fallback')).toBe('Fallback'); expect(safeSeoText('', 'Fallback')).toBe('Fallback'); expect(safeSeoText('Fine text', 'Fallback')).toBe('Fine text'); });
  it('fitTitle keeps the first candidate that fits 60 characters, else cuts the first at a word with an ellipsis', () => {
    expect(fitTitle(['Short title', 'x'])).toBe('Short title');
    expect(fitTitle(['A'.repeat(70), 'Fits fine'])).toBe('Fits fine');
    const cutOnly = fitTitle(['word '.repeat(30)]);
    expect(cutOnly.length).toBeLessThanOrEqual(60); expect(cutOnly.endsWith('…')).toBe(true);
  });
});

describe('composeDescription', () => {
  it('joins distinct sentences from the vendor text, drops repeats, ends with one full stop, and keeps to the length', () => {
    expect(composeDescription(['Gentle dental care for the whole family.', 'Gentle dental care for the whole family.', 'We have served Madurai for years. Call us any time.'])).toBe('Gentle dental care for the whole family. We have served Madurai for years. Call us any time.');
    const long = composeDescription(['One sentence here.', 'x'.repeat(200) + '.']);
    expect(long.length).toBeLessThanOrEqual(160);
  });
  it('skips any sentence that carries a price or a banned word and returns an empty string when nothing is left', () => {
    expect(composeDescription(['Plumbing from ₹499 today.', 'We fix leaks.'])).toBe('We fix leaks.');
    expect(composeDescription(['Plumbing from ₹499 today.'])).toBe('');
  });
});

describe('page SEO per track and language', () => {
  it('the home description is built from the vendor\'s own sentences without repeats or double full stops', () => {
    const s = seoFor(doc('dentist'), 'dentist', 'en');
    expect(s.description).toBe('Gentle dental care for the whole family. Meenakshi Dental Care has served Madurai families for years.');
    expect(s.description).not.toMatch(/\.\./);
  });

  const cases: Array<[keyof typeof THEME, 'en' | 'ta']> = [['plumber', 'en'], ['plumber', 'ta'], ['dentist', 'en'], ['dentist', 'ta'], ['jewellery', 'en'], ['jewellery', 'ta']];
  it.each(cases)('%s / %s: title <= 60, description 1..160, self canonical on the vendor host, robots meta, JSON-LD of the category type', (kind, lang) => {
    const s = seoFor(doc(kind), kind, lang);
    expect(s.title.length).toBeGreaterThan(0); expect(s.title.length).toBeLessThanOrEqual(60);
    expect(s.description.length).toBeGreaterThan(0); expect(s.description.length).toBeLessThanOrEqual(160);
    const sub = doc(kind).vendor.subdomain;
    expect(s.canonical).toBe(lang === 'ta' ? `https://${sub}.get4domain.com/ta` : `https://${sub}.get4domain.com/`);
    expect(s.robots).toBe('noindex, nofollow');
    const biz = s.jsonLd.find((b) => b['@type'] === SCHEMA[kind]);
    expect(biz).toBeDefined();
    expect(biz).toMatchObject({ name: doc(kind).cms!.businessName, telephone: doc(kind).cms!.phone });
    expect(s.jsonLd.some((b) => b['@type'] === 'BreadcrumbList')).toBe(true);
  });

  it('indexable sites say index, follow; the stored header value is the same string', () => {
    const s = seoFor(doc('plumber'), 'plumber', 'en', 'home', { indexable: true });
    expect(s.robots).toBe('index, follow, max-image-preview:large'); expect(robotsValue(true)).toBe(s.robots); expect(robotsValue(false)).toBe('noindex, nofollow');
  });

  it('Open Graph and Twitter tags: type, site name, title, description, url, locale, image only when real', () => {
    const s = seoFor(doc('plumber'), 'plumber', 'en');
    expect(s.og).toMatchObject({ 'og:type': 'website', 'og:site_name': 'Sri Ganesh Plumbing', 'og:title': s.title, 'og:description': s.description, 'og:url': s.canonical, 'og:locale': 'en_IN', 'og:image': 'https://cdn.example.test/banner.jpg' });
    expect(s.twitter).toMatchObject({ 'twitter:card': 'summary_large_image', 'twitter:title': s.title });
    const noImg = seoFor(doc('plumber', { cms: { banner: null } }), 'plumber', 'en');
    expect(noImg.og['og:image']).toBeUndefined(); expect(noImg.twitter['twitter:card']).toBe('summary');
    const ta = seoFor(doc('plumber'), 'plumber', 'ta'); expect(ta.og['og:locale']).toBe('ta_IN');
  });

  it('hreflang only when more than one language is enabled', () => {
    expect(seoFor(doc('plumber'), 'plumber', 'en').hreflang).toEqual([]);
    const two = seoFor(doc('plumber'), 'plumber', 'en', 'home', { languages: ['en', 'ta'] });
    expect(two.hreflang.map((h) => h.lang)).toEqual(['en-IN', 'ta-IN', 'x-default']);
    expect(two.og['og:locale:alternate']).toBe('ta_IN');
  });

  it('a Tamil business renders Tamil text in the SEO fields and keeps every limit', () => {
    const d = doc('plumber', { vendor: { businessName: 'காவேரி பிளம்பிங்' }, cms: { businessName: 'காவேரி பிளம்பிங்', tagline: 'கசிவுகள் விரைவாக சரிசெய்யப்படும்.', about: 'காவேரி பிளம்பிங் சென்னையில் சேவை செய்கிறது. வேலையைத் தொடங்கும் முன் விளக்குவோம்.' } });
    const s = seoFor(d, 'plumber', 'ta');
    expect(s.title).toContain('காவேரி பிளம்பிங்'); expect(s.title.length).toBeLessThanOrEqual(60);
    expect(s.description.length).toBeLessThanOrEqual(160); expect(s.og['og:locale']).toBe('ta_IN');
    expect(s.htmlLang).toBe('ta-IN');
  });

  it('JSON-LD: sameAs only from vendor profile URLs; services listed without any offer or price; no review markup', () => {
    const s = seoFor(doc('plumber'), 'plumber', 'en', 'services');
    const biz = s.jsonLd.find((b) => b['@type'] === 'Plumber')!;
    expect(biz.sameAs).toEqual(['https://www.facebook.com/example.page']);
    const text = JSON.stringify(s.jsonLd);
    expect(text).not.toMatch(/"offers"|"price"|"priceRange"|"priceCurrency"|aggregateRating|"review"/);
    const list = s.jsonLd.find((b) => b['@type'] === 'ItemList')!;
    expect((list.itemListElement as Array<{ item: { '@type': string; name: string } }>).map((e) => e.item.name)).toEqual(['Tap repair', 'Pipe fitting']);
    const none = seoFor(doc('plumber', { cms: { facebook: null } }), 'plumber', 'en').jsonLd.find((b) => b['@type'] === 'Plumber')!;
    expect(none.sameAs).toBeUndefined();
  });

  it('ecommerce item pages describe a Product without an offer; other tracks a Service', () => {
    const shop = seoFor(doc('jewellery', { items: [{ id: 'i1', name: 'Gold chain', description: 'A chain.', price: '5000', image: null, category: null, active: true, sample: false, samplePrice: false }] }), 'jewellery', 'en', 'item');
    expect(shop.jsonLd.some((b) => b['@type'] === 'Product')).toBe(true);
    expect(JSON.stringify(shop.jsonLd)).not.toMatch(/5000|offers|price/i);
    expect(seoFor(doc('plumber'), 'plumber', 'en', 'item').jsonLd.some((b) => b['@type'] === 'Service')).toBe(true);
  });

  it('a price or a banned word the vendor typed into the tagline never reaches title, description, OG or JSON-LD text', () => {
    const d = doc('plumber', { cms: { tagline: 'Plumbing from ₹499 today', about: 'We are on the Workspace plan. Call us for repairs at Rs. 300.' } });
    const s = seoFor(d, 'plumber', 'en');
    for (const t of [s.title, s.description, ...Object.values(s.og), ...Object.values(s.twitter), ...allStrings(s.jsonLd)]) expect(isUnsafeSeoText(t)).toBe(false);
  });

  it('SCAN: no price or banned word in any generated SEO text, for every track, language and page', () => {
    const bad: string[] = [];
    for (const [kind, lang] of cases) for (const page of ['home', 'about', 'services', 'gallery', 'contact', 'page', 'item']) {
      const s = seoFor(doc(kind), kind, lang, page, { indexable: true, languages: ['en', 'ta'] });
      for (const t of [s.title, s.description, ...Object.values(s.og), ...Object.values(s.twitter), ...allStrings(s.jsonLd), ...s.hreflang.map((h) => h.href)]) if (isUnsafeSeoText(t)) bad.push(`${kind}/${lang}/${page}: ${t.slice(0, 60)}`);
    }
    expect(bad).toEqual([]);
  });

  it('assembleDocument writes the head: title, description, canonical, robots, OG, hreflang, one JSON-LD script per block and the shared stylesheet; text is escaped', () => {
    const d = doc('plumber', { cms: { businessName: 'Evil </script><script>alert(1)</script> & Sons', tagline: 'Fast "work" <b>here</b>' }, vendor: { businessName: 'Evil </script><script>alert(1)</script> & Sons' } });
    const s = seoFor(d, 'plumber', 'en', 'home', { languages: ['en', 'ta'] });
    const html = assembleDocument({ seo: s, bodyHtml: '<div class="g4d-theme">body</div>', cssHref: '/assets/site.css' });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en-IN">'); expect(html).toContain('<link rel="canonical"'); expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain('<link rel="stylesheet" href="/assets/site.css">'); expect(html).toContain('hreflang="ta-IN"'); expect(html).toContain('property="og:title"');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect((html.match(/<script type="application\/ld\+json">/g) ?? []).length).toBe(s.jsonLd.length);
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) expect(() => JSON.parse(m[1])).not.toThrow();
    expect(html).toContain('<div class="g4d-theme">body</div>');
  });
});

describe('indexing rule', () => {
  const ok = { businessName: 'Acme', categoryId: 'plumber', claimed: true, verifiedContact: true, address: '12 Main Road', serviceAreas: 0, homeContent: true, forceNoindex: false };
  it('indexable when everything is there', () => { expect(evaluateIndexing(ok)).toEqual({ indexable: true, missing: [] }); });
  it.each([
    ['businessName', { businessName: '' }, ['BUSINESS_NAME']],
    ['category', { categoryId: null }, ['CATEGORY']],
    ['unclaimed', { claimed: false, verifiedContact: false }, ['CLAIMED', 'VERIFIED_CONTACT']],
    ['claimed but no verified contact', { verifiedContact: false }, ['VERIFIED_CONTACT']],
    ['no address and no area', { address: '', serviceAreas: 0 }, ['ADDRESS_OR_SERVICE_AREA']],
    ['no home content', { homeContent: false }, ['HOME_CONTENT']],
    ['staff forced noindex', { forceNoindex: true }, ['FORCE_NOINDEX']],
  ])('%s -> noindex with the right missing codes', (_n, patch, codes) => {
    const r = evaluateIndexing({ ...ok, ...patch } as typeof ok);
    expect(r.indexable).toBe(false); expect(r.missing.map((m) => m.code)).toEqual(codes);
    for (const m of r.missing) expect(m.label.length).toBeGreaterThan(5);
  });
  it('a service area instead of an address is enough; whitespace is not an address', () => {
    expect(evaluateIndexing({ ...ok, address: '', serviceAreas: 2 }).indexable).toBe(true);
    expect(evaluateIndexing({ ...ok, address: '   ' }).missing.map((m) => m.code)).toEqual(['ADDRESS_OR_SERVICE_AREA']);
  });
  it('everything missing lists every code once, in a stable order', () => {
    const r = evaluateIndexing({ businessName: '', categoryId: null, claimed: false, verifiedContact: false, address: '', serviceAreas: 0, homeContent: false, forceNoindex: true });
    expect(r.missing.map((m) => m.code)).toEqual(['BUSINESS_NAME', 'CATEGORY', 'CLAIMED', 'VERIFIED_CONTACT', 'ADDRESS_OR_SERVICE_AREA', 'HOME_CONTENT', 'FORCE_NOINDEX']);
  });
  it('a Free site stays noindex until claimed, however complete it is', () => {
    const d = doc('plumber', { claimed: false });
    const input = toRendererInput(d, { categoryId: 'plumber', lang: 'en', year: YEAR, siteBase: 'get4domain.com' });
    const r = evaluateIndexing({ businessName: d.vendor.businessName, categoryId: categoryFor(d, kit, kit.categoryMap()), claimed: d.claimed, verifiedContact: d.claimed, address: d.cms!.address ?? '', serviceAreas: 0, homeContent: homeContentOk(input.content), forceNoindex: false });
    expect(r.indexable).toBe(false); expect(r.missing.map((m) => m.code)).toEqual(['CLAIMED', 'VERIFIED_CONTACT']);
  });
  it('homeContentOk needs a tagline or about text and at least one service or photo', () => {
    expect(homeContentOk({ site: { tagline: 'x' }, about: { text: '' }, items: [{}], gallery: [] })).toBe(true);
    expect(homeContentOk({ site: { tagline: '' }, about: { text: '' }, items: [{}], gallery: [] })).toBe(false);
    expect(homeContentOk({ site: { tagline: 'x' }, about: { text: '' }, items: [], gallery: [] })).toBe(false);
    expect(homeContentOk({ site: { tagline: '' }, about: { text: 'about' }, items: [], gallery: [{}] })).toBe(true);
  });
});

describe('sitemap.xml and robots.txt', () => {
  const urls = [{ loc: 'https://a.get4domain.com/' }, { loc: 'https://a.get4domain.com/about', alternates: [{ lang: 'en-IN', href: 'https://a.get4domain.com/about' }, { lang: 'ta-IN', href: 'https://a.get4domain.com/ta/about' }] }];
  it('an indexable site lists its pages (escaped), with alternates', () => {
    const x = buildSitemap(urls.concat([{ loc: 'https://a.get4domain.com/a&b' }]), true);
    expect(x).toContain('<urlset'); expect(x.match(/<url>/g)).toHaveLength(3); expect(x).toContain('a&amp;b'); expect(x).toContain('hreflang="ta-IN"');
  });
  it('a noindex site has an empty urlset', () => { const x = buildSitemap(urls, false); expect(x).toContain('<urlset'); expect(x).not.toContain('<url>'); });
  it('robots.txt never disallows the site (a noindex page must stay crawlable so the tag can be read); the Sitemap line only when indexable', () => {
    const on = buildRobotsTxt(true, 'https://a.get4domain.com/sitemap.xml'); const off = buildRobotsTxt(false, 'https://a.get4domain.com/sitemap.xml');
    for (const t of [on, off]) { expect(t).toContain('User-agent: *'); expect(t).not.toMatch(/Disallow:\s*\/\s*$/m); }
    expect(on).toContain('Sitemap: https://a.get4domain.com/sitemap.xml'); expect(off).not.toContain('Sitemap:');
  });
});
