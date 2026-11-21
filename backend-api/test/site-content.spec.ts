import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { categoryFor, limitsFrom, planPages, toRendererInput } from '../src/site-publish/content/content-adapter';
import { resolveTheme } from '../src/site-publish/content/theme-resolution';
import { loadKit } from '../src/site-publish/renderer/renderer-loader';
import { entitlements, doc, YEAR } from './support/site-fixtures';

/** S54.4: the ContentSource mapping (pure, fixtures per track), page planning, plan limits, and theme resolution with entitlements. */
jest.setTimeout(60_000);
const kit = loadKit();
const map = kit.categoryMap();
const HOST = { siteBase: 'get4domain.com' };

describe('category of a vendor', () => {
  it('a kit category id is used as it is; a legacy pack key maps to the first category of its pack; nothing known gives null', () => {
    expect(categoryFor(doc('plumber'), kit, map)).toBe('plumber');
    expect(categoryFor(doc('dentist', { vendor: { industry: 'clinic' }, cms: { packKey: 'clinic' } }), kit, map)).toBe('dentist');
    expect(categoryFor(doc('plumber', { vendor: { industry: 'general' }, cms: { packKey: null } }), kit, map)).toBeNull();
  });
});

describe('toRendererInput (the ContentSource mapping)', () => {
  const input = toRendererInput(doc('plumber'), { categoryId: 'plumber', lang: 'en', year: YEAR, ...HOST });

  it('maps the vendor and the draft to the renderer content: names, contact, links, hero, about, social', () => {
    const c = input.content as Record<string, Record<string, unknown>>;
    expect(c.category).toBe('plumber'); expect(c.lang).toBe('en'); expect(c.sample).toBeUndefined();
    expect(c.site).toMatchObject({ name: 'Sri Ganesh Plumbing', tagline: 'Leaks fixed fast, every time.', year: 2026 });
    expect(c.contact).toMatchObject({ phone: '+919876543210', phoneHref: 'tel:+919876543210', whatsappHref: 'https://wa.me/919876543210', email: 'ganesh@example.com', address: '12, Kamaraj Road, Chennai 600001', city: 'Chennai', pin: '600001' });
    expect(c.hero).toMatchObject({ title: 'Leaks fixed fast, every time.', image: 'https://cdn.example.test/banner.jpg' });
    expect(c.about).toMatchObject({ text: expect.stringContaining('serves Chennai') });
    expect(c.social).toMatchObject({ facebook: 'https://www.facebook.com/example.page' });
    expect(c.cta).toMatchObject({ label: 'Call now', href: 'tel:+919876543210' });
  });

  it('the About heading uses the kit\'s own wording with the vendor\'s name: English prefix, Tamil suffix', () => {
    expect((input.content as { about: { title: string } }).about.title).toBe('About Sri Ganesh Plumbing');
    const ta = toRendererInput(doc('plumber'), { categoryId: 'plumber', lang: 'ta', year: YEAR, ...HOST }).content as { about: { title: string } };
    expect(ta.about.title).toBe('Sri Ganesh Plumbing பற்றி');
  });

  it('host and vendor inputs: the vendor subdomain address, no embeds, unclaimed flag for the claim banner', () => {
    expect(input.host).toMatchObject({ siteUrl: 'https://sri-ganesh-plumbing.get4domain.com', allowEmbeds: false });
    expect(input.vendor).toMatchObject({ id: 'v-plumber', unclaimed: true });
    expect(toRendererInput(doc('plumber', { claimed: true }), { categoryId: 'plumber', lang: 'en', year: YEAR, ...HOST }).vendor).toMatchObject({ unclaimed: false });
  });

  it('a vendor price is shown, a starter (sample) price is not; starter items still appear; no invented reviews, hours or prices', () => {
    const c = input.content as { items: Array<{ name: string; price: string }>; reviews?: unknown; hours: unknown[]; videos: unknown[] };
    expect(c.items.map((i) => [i.name, i.price])).toEqual([['Tap repair', '300'], ['Pipe fitting', '']]);
    expect(c.reviews).toBeUndefined(); expect(c.hours).toEqual([]); expect(c.videos).toEqual([]);
  });

  it('sample testimonials are dropped (starter quotes are never public); vendor ones are kept; faqs, steps, trust come from the extras', () => {
    const c = input.content as { testimonials: Array<{ author: string }>; faqs: unknown[]; steps: Array<{ n: number; title: string }>; trust: Array<{ text: string }>; gallery: Array<{ src: string }> };
    expect(c.testimonials.map((t) => t.author)).toEqual(['A Customer']);
    expect(c.faqs).toEqual([{ q: 'Do you work on Sundays?', a: 'Yes, by appointment.' }]);
    expect(c.steps).toEqual([{ n: 1, title: 'Call us', desc: 'Tell us the problem.' }]);
    expect(c.trust).toEqual([{ text: 'Licensed and insured' }]);
    expect(c.gallery[0].src).toBe('https://cdn.example.test/g1.jpg');
  });

  it('items get stable slugs and the services href; ecommerce categories also fill products from the items, other tracks do not', () => {
    const c = input.content as { items: Array<{ slug: string; href: string }>; products: unknown[] };
    expect(c.items[0]).toMatchObject({ slug: 'tap-repair-i1', href: '/services/tap-repair-i1' });
    expect(c.products).toEqual([]);
    const shop = toRendererInput(doc('jewellery'), { categoryId: 'jewellery', lang: 'en', year: YEAR, ...HOST }).content as { products: unknown[] };
    expect(shop.products).toHaveLength(2);
  });

  it('Tamil: only the language flag changes; the vendor text is the vendor\'s', () => {
    const ta = toRendererInput(doc('plumber'), { categoryId: 'plumber', lang: 'ta', year: YEAR, ...HOST }).content as { lang: string; site: { name: string } };
    expect(ta.lang).toBe('ta'); expect(ta.site.name).toBe('Sri Ganesh Plumbing');
  });

  it('is deterministic: the same document gives byte-identical JSON', () => {
    const again = toRendererInput(doc('plumber'), { categoryId: 'plumber', lang: 'en', year: YEAR, ...HOST });
    expect(JSON.stringify(again)).toBe(JSON.stringify(input));
  });

  it('renders through the real renderer without blocking warnings (missing template, unknown category, missing host)', () => {
    const out = kit.renderPage({ theme: kit.loadTheme('free-service-pro'), page: 'home', ...input, entitlements: { video: false, cart: false, booking: false, customDomain: false } });
    expect(out.warnings.filter((w) => /^missing-template|^unknown-category|^missing:host/.test(w))).toEqual([]);
    expect(out.html).toContain('Sri Ganesh Plumbing');
    expect(out.html).not.toContain('Starter quote');
    expect(out.seo.canonical).toBe('https://sri-ganesh-plumbing.get4domain.com/');
  });
});

describe('plan limits and page plan', () => {
  it('limitsFrom reads the plan features: Free 1 page / 8 services / 5 photos / 6 questions, Pro more; a missing feature means no limit', () => {
    expect(limitsFrom(entitlements('FREE'))).toEqual({ pages: 1, services: 8, gallery: 5, faqs: 6 });
    expect(limitsFrom(entitlements('PRO'))).toEqual({ pages: 24, services: 24, gallery: 40, faqs: 12 });
    expect(limitsFrom({ ...entitlements('FREE'), features: {} })).toEqual({ pages: null, services: null, gallery: null, faqs: null });
  });

  it('content over a limit is cut to the limit and the cut is reported (never silently)', () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ id: `i${i}`, name: `Service ${i}`, description: '', price: '', image: null, category: null, active: true, sample: false, samplePrice: false }));
    const r = toRendererInput(doc('plumber', { items }), { categoryId: 'plumber', lang: 'en', year: YEAR, limits: { pages: 1, services: 8, gallery: 5, faqs: 6 }, ...HOST });
    expect((r.content as { items: unknown[] }).items).toHaveLength(8);
    expect(r.notes).toContain('limit:services');
  });

  it('planPages: home, about, services, gallery, contact, then the vendor pages (within the page limit, reserved slugs skipped), then one page per item', () => {
    const d = doc('plumber', { cms: { pages: [{ slug: 'offers', title: 'Offers', body: 'x' }, { slug: 'book', title: 'Reserved', body: 'x' }, { slug: 'second', title: 'Second', body: 'x' }] } });
    const r = toRendererInput(d, { categoryId: 'plumber', lang: 'en', year: YEAR, limits: { pages: 2, services: 8, gallery: 5, faqs: 6 }, ...HOST });
    const pages = planPages(r.content, ['home', 'about', 'services', 'gallery', 'contact', 'page', 'item']);
    expect(pages.map((p) => `${p.template}:${p.path}`)).toEqual([
      'home:/', 'about:/about', 'services:/services', 'gallery:/gallery', 'contact:/contact', 'page:/offers', 'page:/second',
      'item:/services/tap-repair-i1', 'item:/services/pipe-fitting-i2',
    ]);
    expect(r.notes).not.toContain('limit:pages');
    const cut = toRendererInput(d, { categoryId: 'plumber', lang: 'en', year: YEAR, limits: { pages: 1, services: 8, gallery: 5, faqs: 6 }, ...HOST });
    expect(planPages(cut.content, ['home', 'page']).filter((p) => p.template === 'page')).toHaveLength(1);
    expect(cut.notes).toContain('limit:pages');
  });

  it('a theme without an item template gets no item pages', () => {
    const r = toRendererInput(doc('plumber'), { categoryId: 'plumber', lang: 'en', year: YEAR, ...HOST });
    expect(planPages(r.content, ['home', 'about', 'services', 'gallery', 'contact']).some((p) => p.template === 'item')).toBe(false);
  });
});

describe('theme resolution with entitlements', () => {
  const themes = kit.listVendorThemeIds().map((id) => { const m = kit.loadTheme(id).manifest; return { id, tier: m.tier, categories: m.categories, name: m.name, tracks: m.tracks, hash: 'h' }; });
  const free = { state: 'ACTIVE' as const, enumValue: 'assigned', upsellText: 'Choose any theme with Pro.' };
  const pro = { state: 'ACTIVE' as const, enumValue: 'library', upsellText: null };
  const base = { categoryId: 'plumber', track: 'handyman', themes, defaultId: 'free-service-pro' };

  it('no stored choice: the category default', () => {
    expect(resolveTheme({ ...base, requested: null, entitlement: free, strict: false })).toEqual({ themeId: 'free-service-pro', source: 'default', notes: [] });
  });
  it('a Free vendor may only have the assigned default; asking for another is FEATURE_LOCKED with the upsell text', () => {
    let err: unknown; try { resolveTheme({ ...base, categoryId: 'dentist', track: 'professional', defaultId: 'free-practice', requested: 'free-studio', entitlement: free, strict: true }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({ code: 'FEATURE_LOCKED', feature: 'site.themes', upsellText: 'Choose any theme with Pro.' });
  });
  it('a Pro vendor may use any theme designed for their track (three for Professional)', () => {
    const dentist = { ...base, categoryId: 'dentist', track: 'professional', defaultId: 'free-practice' };
    expect(resolveTheme({ ...dentist, requested: 'free-studio', entitlement: pro, strict: true }).themeId).toBe('free-studio');
  });
  it('a theme not designed for the vendor\'s track is THEME_LOCKED even on Pro; an unknown id is THEME_INVALID', () => {
    let a: unknown; try { resolveTheme({ ...base, requested: 'free-shop-lite', entitlement: pro, strict: true }); } catch (e) { a = e; }
    expect(a).toBeInstanceOf(ForbiddenException); expect((a as ForbiddenException).getResponse()).toMatchObject({ code: 'THEME_LOCKED' });
    let b: unknown; try { resolveTheme({ ...base, requested: 'nope', entitlement: pro, strict: true }); } catch (e) { b = e; }
    expect(b).toBeInstanceOf(BadRequestException); expect((b as BadRequestException).getResponse()).toMatchObject({ code: 'THEME_INVALID' });
  });
  it('a stored choice the plan no longer allows (a downgrade) falls back to the default on a build, with a note; it is not an error', () => {
    const r = resolveTheme({ ...base, categoryId: 'dentist', track: 'professional', defaultId: 'free-practice', requested: 'free-studio', entitlement: free, strict: false });
    expect(r).toEqual({ themeId: 'free-practice', source: 'default', notes: ['theme-fallback'] });
  });
  it('a vendor with no site.themes feature at all (no plan) is treated as assigned', () => {
    expect(() => resolveTheme({ ...base, categoryId: 'dentist', track: 'professional', defaultId: 'free-practice', requested: 'free-studio', entitlement: null, strict: true })).toThrow(ForbiddenException);
  });
  it('no default theme for the category and nothing requested is THEME_INVALID', () => {
    expect(() => resolveTheme({ ...base, defaultId: null, requested: null, entitlement: free, strict: false })).toThrow(BadRequestException);
  });
});
