import { loadKit } from '../src/site-publish/renderer/renderer-loader';
import { toRendererInput } from '../src/site-publish/content/content-adapter';
import { SourceDocument } from '../src/site-publish/content/content-types';
import {
  applyToSource, diffDocs, emptyDoc, FIELD_DEFS, hashDoc, LIST_DEFS, validateBrand, validateList, validateNavigation, validateSections, writeField, writeList,
} from '../src/v3-website/core/managed-doc';
import { deriveEditorMap, EditorMap } from '../src/v3-website/core/editor-map';
import { checkWording } from '../src/v3-website/core/wording-core';

/** Slice 5.5a: the managed content document (pure): typed fields, locked fields, lists, sections, brand, navigation, the overlay onto the source, and the editor map derived from real themes. */
const kit = loadKit();
const code = (r: { ok: boolean; code?: string }): string => (r.ok ? 'OK' : r.code ?? '?');

const source = (): SourceDocument => ({
  vendor: { id: 'va', subdomain: 'va', businessName: 'Shop va', name: 'Owner', phone: '+919800000000', email: 'o@example.test', status: 'ACTIVE', industry: 'plumber' },
  cms: {
    businessName: 'Shop va', tagline: 'Legacy tagline', about: 'Legacy about', logo: null, banner: 'https://img.example.test/legacy.jpg', favicon: null, phone: '+919800000000', email: 'o@example.test',
    address: '1 Main Road, Madurai 625001', businessHours: null, whatsapp: null, facebook: null, instagram: null, linkedin: null, youtube: null, googleMaps: null, portfolio: null,
    testimonials: null, pages: null, extras: null, packKey: 'plumber', siteStatus: 'DRAFT', ogImage: null, seoTitle: null, seoDesc: null,
  },
  items: [{ id: 'i1', name: 'Tap repair', description: 'Fix taps', price: '300', image: null, category: null, active: true, sample: false, samplePrice: false }],
  claimed: true,
});

describe('writing a field', () => {
  it('stores a trimmed value; an empty value removes the override so the legacy text shows again', () => {
    const a = writeField(emptyDoc(), 'site.tagline', '  Fast and tidy  '); expect(a.ok && a.doc.fields['site.tagline']).toBe('Fast and tidy');
    const b = writeField(a.ok ? a.doc : emptyDoc(), 'site.tagline', '   '); expect(b.ok && 'site.tagline' in b.doc.fields).toBe(false);
  });
  it('refuses a key that is not an editable field: the SEO, canonical and markup keys are locked for vendors', () => {
    for (const k of ['seo.title', 'seo.canonical', 'structuredData', 'site.url', 'hero.cta', 'about.title', 'site.name', 'canonical', '__proto__', 'constructor']) expect(code(writeField(emptyDoc(), k, 'x'))).toBe('FIELD_LOCKED');
  });
  it('checks the type: links are https only, phone and email shapes, images are https links, over-long text is refused', () => {
    expect(code(writeField(emptyDoc(), 'social.instagram', 'http://instagram.com/x'))).toBe('FIELD_INVALID');
    expect(code(writeField(emptyDoc(), 'social.instagram', 'javascript:alert(1)'))).toBe('FIELD_INVALID');
    expect(code(writeField(emptyDoc(), 'social.instagram', 'https://instagram.com/shop'))).toBe('OK');
    expect(code(writeField(emptyDoc(), 'contact.phone', 'call me'))).toBe('FIELD_INVALID');
    expect(code(writeField(emptyDoc(), 'contact.phone', '+91 98765 43210'))).toBe('OK');
    expect(code(writeField(emptyDoc(), 'contact.email', 'not-an-email'))).toBe('FIELD_INVALID');
    expect(code(writeField(emptyDoc(), 'hero.image', 'data:image/png;base64,AAAA'))).toBe('FIELD_INVALID');
    expect(code(writeField(emptyDoc(), 'hero.image', 'https://img.example.test/a.jpg'))).toBe('OK');
    expect(code(writeField(emptyDoc(), 'hero.title', 'x'.repeat(FIELD_DEFS['hero.title'].max + 1)))).toBe('FIELD_INVALID');
    expect(code(writeField(emptyDoc(), 'hero.title', 123 as never))).toBe('FIELD_INVALID');
  });
  it('markup in text is refused, never cleaned into something that looks different', () => {
    expect(code(writeField(emptyDoc(), 'about.text', '<script>alert(1)</script>'))).toBe('FIELD_INVALID');
    expect(code(writeField(emptyDoc(), 'about.text', 'We fix pipes <b>fast</b>'))).toBe('FIELD_INVALID');
  });
  it('an image needs its alt text field to exist: hero.imageAlt is a field of its own', () => { expect(FIELD_DEFS['hero.imageAlt']).toBeDefined(); expect(FIELD_DEFS['about.imageAlt']).toBeDefined(); });
  it('marks the Pro-only fields (the call to action wording)', () => { expect(FIELD_DEFS['cta.label'].proOnly).toBe(true); expect(FIELD_DEFS['site.tagline'].proOnly).toBeFalsy(); });
});

describe('writing a list', () => {
  const faq = (q: string, a: string) => ({ q, a });
  it('stores the typed items and drops nothing silently: an unknown item field is refused', () => {
    expect(code(writeList(emptyDoc(), 'faqs', [faq('How soon?', 'Same day.')]))).toBe('OK');
    expect(code(writeList(emptyDoc(), 'faqs', [{ q: 'a', a: 'b', html: '<b>' }] as never))).toBe('FIELD_INVALID');
    expect(code(writeList(emptyDoc(), 'nonsense' as never, []))).toBe('FIELD_LOCKED');
    expect(code(writeList(emptyDoc(), 'faqs', 'x' as never))).toBe('FIELD_INVALID');
  });
  it('a gallery image needs a link and alt text', () => {
    expect(code(writeList(emptyDoc(), 'gallery', [{ src: 'https://img.example.test/a.jpg', alt: '' }]))).toBe('ALT_REQUIRED');
    expect(code(writeList(emptyDoc(), 'gallery', [{ src: 'https://img.example.test/a.jpg', alt: 'Fitted tap' }]))).toBe('OK');
    expect(code(writeList(emptyDoc(), 'gallery', [{ src: 'http://img.example.test/a.jpg', alt: 'x' }]))).toBe('FIELD_INVALID');
  });
  it('custom pages: slug rules, reserved slugs, duplicates, and the on or off switch', () => {
    const page = (slug: string, over: Record<string, unknown> = {}) => ({ slug, title: 'Terms', intro: '', body: 'Text', enabled: true, ...over });
    expect(code(writeList(emptyDoc(), 'pages', [page('warranty')]))).toBe('OK');
    for (const bad of ['About', 'a b', 'about', 'book', 'ta', 'x_y', '-x', '']) expect(code(writeList(emptyDoc(), 'pages', [page(bad)]))).toBe('SLUG_INVALID');
    expect(code(writeList(emptyDoc(), 'pages', [page('warranty'), page('warranty')]))).toBe('SLUG_INVALID');
    expect(code(writeList(emptyDoc(), 'pages', [page('warranty', { enabled: 'yes' })]))).toBe('FIELD_INVALID');
  });
  it('the list definitions name every list the renderer reads', () => { expect(Object.keys(LIST_DEFS).sort()).toEqual(['credentials', 'faqs', 'gallery', 'pages', 'stats', 'steps', 'team', 'trust']); });
  it('an item count above the payload ceiling is refused', () => {
    expect(code(writeList(emptyDoc(), 'trust', Array.from({ length: 201 }, (_, i) => ({ text: `p${i}` }))))).toBe('LIST_TOO_LONG');
  });
  it('validateList on its own returns the cleaned items', () => { const r = validateList('trust', [{ text: ' Licensed ' }]); expect(r.ok && r.items).toEqual([{ text: 'Licensed' }]); });
});

describe('sections, brand and navigation', () => {
  const known = ['hero', 'about', 'services', 'faq', 'gallery', 'reviews', 'contact', 'share'];
  it('hidden sections must exist and the hero can never be hidden', () => {
    expect(code(validateSections({ hidden: ['faq'], order: ['about', 'services'] }, known))).toBe('OK');
    expect(code(validateSections({ hidden: ['hero'], order: [] }, known))).toBe('SECTION_REQUIRED');
    expect(code(validateSections({ hidden: ['zzz'], order: [] }, known))).toBe('SECTION_UNKNOWN');
    expect(code(validateSections({ hidden: [], order: ['about', 'about'] }, known))).toBe('SECTION_UNKNOWN');
  });
  it('brand colours are hex and fonts come from the theme list; nothing else is accepted', () => {
    const fonts = ['Inter', 'Poppins'];
    expect(code(validateBrand({ accent: '#0a7d4f', fontHeading: 'Poppins' }, fonts))).toBe('OK');
    expect(code(validateBrand({ accent: 'red' }, fonts))).toBe('FIELD_INVALID');
    expect(code(validateBrand({ fontBody: 'Comic Sans MS' }, fonts))).toBe('FONT_NOT_ALLOWED');
    expect(code(validateBrand({ accent: '#fff', cssText: 'body{}' } as never, fonts))).toBe('FIELD_LOCKED');
  });
  const pages = ['home', 'about', 'services', 'gallery', 'contact'];
  it('navigation: known pages only, no duplicates, a label for every item, Home stays visible', () => {
    const ok = { header: [{ key: 'home', label: 'Home', visible: true }, { key: 'services', label: 'What we do', visible: true }, { key: 'contact', label: 'Call us', visible: false }], footer: [{ key: 'about', label: 'About', visible: true }] };
    expect(code(validateNavigation(ok, pages))).toBe('OK');
    expect(code(validateNavigation({ ...ok, header: [{ key: 'zzz', label: 'Z', visible: true }] }, pages))).toBe('NAV_INVALID');
    expect(code(validateNavigation({ ...ok, header: [ok.header[0], ok.header[0]] }, pages))).toBe('NAV_INVALID');
    expect(code(validateNavigation({ ...ok, header: [{ key: 'home', label: '  ', visible: true }] }, pages))).toBe('NAV_INVALID');
    expect(code(validateNavigation({ ...ok, header: [{ key: 'home', label: 'Home', visible: false }] }, pages))).toBe('NAV_INVALID');
    expect(code(validateNavigation({ ...ok, header: [{ key: 'home', label: 'x'.repeat(41), visible: true }] }, pages))).toBe('NAV_INVALID');
  });
});

describe('applying the document over the source (the overlay)', () => {
  it('overrides only what the vendor wrote; the legacy values show through for everything else', () => {
    let d = emptyDoc(); const w = (k: string, v: string) => { const r = writeField(d, k, v); if (!r.ok) throw new Error(r.code); d = r.doc; };
    w('site.tagline', 'New tagline'); w('hero.title', 'Plumbing you can trust'); w('about.text', 'New about');
    const out = applyToSource(source(), d);
    expect(out.cms?.tagline).toBe('New tagline'); expect(out.cms?.about).toBe('New about'); expect(out.cms?.extras?.headline).toBe('Plumbing you can trust');
    expect(out.cms?.phone).toBe('+919800000000'); expect(out.cms?.banner).toBe('https://img.example.test/legacy.jpg'); expect(source().cms?.tagline).toBe('Legacy tagline');
  });
  it('services and products are never touched: the items are the vendor\'s Offerings (single source)', () => {
    const out = applyToSource(source(), emptyDoc()); expect(out.items).toEqual(source().items);
    expect(Object.keys(LIST_DEFS)).not.toContain('items'); expect(Object.keys(LIST_DEFS)).not.toContain('products');
  });
  it('lists land where the renderer reads them; a disabled page is left out', () => {
    let d = emptyDoc(); const l = (n: Parameters<typeof writeList>[1], v: unknown[]) => { const r = writeList(d, n, v as never); if (!r.ok) throw new Error(r.code); d = r.doc; };
    l('faqs', [{ q: 'How soon?', a: 'Same day.' }]); l('gallery', [{ src: 'https://img.example.test/a.jpg', alt: 'A tap', title: '' }]);
    l('pages', [{ slug: 'warranty', title: 'Warranty', intro: '', body: 'Text', enabled: true }, { slug: 'old', title: 'Old', intro: '', body: 'x', enabled: false }]);
    const out = applyToSource(source(), d);
    expect(out.cms?.extras?.faq).toEqual([{ q: 'How soon?', a: 'Same day.' }]); expect(out.cms?.portfolio).toEqual([{ src: 'https://img.example.test/a.jpg', alt: 'A tap', title: '' }]);
    expect(out.cms?.pages?.map((p) => p.slug)).toEqual(['warranty']);
  });
  it('brand tokens and section visibility go to the renderer settings, and the renderer accepts them', () => {
    let d = emptyDoc(); const b = validateBrand({ accent: '#0a7d4f' }, ['Inter']); if (!b.ok) throw new Error(b.code); d = { ...d, brand: b.brand };
    d = { ...d, sections: { hidden: ['faq'], order: [] } };
    const out = applyToSource(source(), d); const r = toRendererInput(out, { categoryId: 'plumber', lang: 'en', year: 2026, siteBase: 'g4d.test' });
    expect(r.settings).toMatchObject({ accent: '#0a7d4f', hiddenSections: ['faq'] });
  });
  it('the written text reaches the rendered page', () => {
    const d = writeField(emptyDoc(), 'hero.title', 'Plumbing you can trust'); if (!d.ok) throw new Error('x');
    const r = toRendererInput(applyToSource(source(), d.doc), { categoryId: 'plumber', lang: 'en', year: 2026, siteBase: 'g4d.test' });
    const theme = kit.loadTheme(kit.listVendorThemeIds().find((id) => kit.loadTheme(id).manifest.categories.includes('plumber'))!);
    const page = kit.renderPage({ theme, page: 'home', content: r.content, settings: r.settings, vendor: r.vendor, host: r.host, entitlements: { callsToAction: true } });
    expect(page.html).toContain('Plumbing you can trust');
  });
});

describe('comparing and hashing documents', () => {
  it('the hash does not depend on key order', () => {
    const a = writeField(writeField(emptyDoc(), 'site.tagline', 'A') as never, 'hero.title', 'B') as never as { doc: ReturnType<typeof emptyDoc> };
    const x = { ...emptyDoc(), fields: { 'site.tagline': 'A', 'hero.title': 'B' } }; const y = { ...emptyDoc(), fields: { 'hero.title': 'B', 'site.tagline': 'A' } };
    expect(hashDoc(x)).toBe(hashDoc(y)); expect(a).toBeDefined(); expect(hashDoc(x)).not.toBe(hashDoc(emptyDoc()));
  });
  it('lists what changed between two documents, by area', () => {
    const a = { ...emptyDoc(), fields: { 'site.tagline': 'A' } }; const b = { ...emptyDoc(), fields: { 'site.tagline': 'B', 'hero.title': 'H' }, lists: { faqs: [{ q: 'q', a: 'a' }] } };
    expect(diffDocs(a, b)).toEqual({ fields: ['hero.title', 'site.tagline'], lists: ['faqs'], sections: false, brand: false, navigation: false, seo: [], location: false, reviewLink: false });
    expect(diffDocs(a, a)).toEqual({ fields: [], lists: [], sections: false, brand: false, navigation: false, seo: [], location: false, reviewLink: false });
  });
});

describe('the editor map is derived from the real themes, never invented', () => {
  const maps: Array<[string, EditorMap]> = kit.listVendorThemeIds().map((id) => [id, deriveEditorMap(kit.loadTheme(id).templates)]);
  it('every vendor theme has a map with the five standard pages', () => {
    expect(maps.length).toBeGreaterThanOrEqual(5);
    for (const [, m] of maps) for (const p of ['home', 'about', 'services', 'gallery', 'contact']) expect(m.pages.map((x) => x.key)).toContain(p);
  });
  it('every editable field and list a section offers is one the write path accepts (so every editable section round-trips)', () => {
    for (const [id, m] of maps) for (const pg of m.pages) for (const s of pg.sections) {
      for (const f of s.fields) expect([id, pg.key, s.id, f, FIELD_DEFS[f] !== undefined]).toEqual([id, pg.key, s.id, f, true]);
      for (const l of s.lists) expect([id, pg.key, s.id, l, LIST_DEFS[l as keyof typeof LIST_DEFS] !== undefined]).toEqual([id, pg.key, s.id, l, true]);
    }
  });
  it('the hero is not optional; platform-drawn sections offer visibility only; items are read from Offerings', () => {
    const m = maps.find(([id]) => id === 'free-service-pro')![1]; const home = m.pages.find((p) => p.key === 'home')!;
    expect(home.sections.find((s) => s.id === 'hero')).toMatchObject({ optional: false });
    expect(home.sections.find((s) => s.id === 'hero')!.fields).toEqual(expect.arrayContaining(['hero.title', 'hero.subtitle', 'hero.image', 'hero.imageAlt']));
    expect(home.sections.find((s) => s.id === 'share')).toMatchObject({ fields: [], lists: [], visibilityOnly: true });
    expect(home.sections.find((s) => s.id === 'services')).toMatchObject({ fromOfferings: true });
    expect(home.sections.find((s) => s.id === 'faq')!.lists).toEqual(['faqs']);
  });
  it('lists the gaps it can see: a theme without an About, Services or Contact page or without a FAQ section', () => {
    const m = deriveEditorMap({ home: '<section data-g4d-section="hero" data-g4d-label="Hero" data-g4d-optional="false">{{hero.title}}</section>' });
    expect(m.gaps).toEqual(expect.arrayContaining(['page:about', 'page:services', 'page:contact', 'page:gallery', 'section:faq']));
  });
  it('the generated landing pages are a recorded gap: the renderer has no landing template', () => { expect(maps[0][1].gaps).toContain('landing-pages:no-template'); });
});

describe('the wording check', () => {
  it('refuses promises of results or ranking and accepts plain business text', () => {
    for (const bad of ['We guarantee the number 1 ranking on Google', 'Guaranteed first page of Google', '100% guaranteed results', 'Top ranking plumber, guaranteed leads', 'Get more sales guaranteed']) expect(checkWording(bad).ok).toBe(false);
    for (const good of ['Plumber in Madurai for taps, pipes and bathrooms', 'Family run since 1998', 'We reply to every call']) expect(checkWording(good).ok).toBe(true);
  });
  it('refuses a rupee price in SEO text and the retired product names', () => { expect(checkWording('Taps from ₹300').ok).toBe(false); expect(checkWording('Part of Workspace').ok).toBe(false); });
});
