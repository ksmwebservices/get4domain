import { defaultPageSeo, isPageKey, seoIssues, validatePageSeo } from '../src/v3-website/core/seo-core';
import { applyToSource, diffDocs, emptyDoc, normaliseDoc, writeSeo } from '../src/v3-website/core/managed-doc';
import { SourceDocument } from '../src/site-publish/content/content-types';

/** Slice B1 (amendment 08): per-page SEO text, pure. Titles up to 60, descriptions up to 160, an optional share picture from the site's own pictures, defaults from name, city and category only. */
const code = (r: { ok: boolean; code?: string }): string => (r.ok ? 'OK' : r.code ?? '?');
const IMG = 'https://media.example.test/vendors/v1/media/abc123.png';

describe('page keys', () => {
  it('are the standard pages, extra pages by slug, and items by id; anything else is refused', () => {
    for (const k of ['home', 'about', 'services', 'gallery', 'contact', 'page:warranty', 'item:ckabc123']) expect(isPageKey(k)).toBe(true);
    for (const k of ['', 'Home', 'page:', 'page:A B', 'item:', 'seo', '__proto__', 'page:../x', 'item:a b']) expect(isPageKey(k)).toBe(false);
  });
});

describe('writing one page\'s SEO', () => {
  const ok = { seoTitle: 'Tap repair in Madurai', seoDescription: 'Sri Ganesh Plumbing fixes taps, pipes and bathrooms across Madurai.', shareImageRef: IMG };
  it('accepts a title of up to 60, a description of up to 160 and a picture the site already has', () => {
    expect(code(validatePageSeo(ok, [IMG]))).toBe('OK');
    expect(code(validatePageSeo({ seoTitle: 'x'.repeat(60) }, []))).toBe('OK'); expect(code(validatePageSeo({ seoTitle: 'x'.repeat(61) }, []))).toBe('FIELD_INVALID');
    expect(code(validatePageSeo({ seoDescription: 'x'.repeat(160) }, []))).toBe('OK'); expect(code(validatePageSeo({ seoDescription: 'x'.repeat(161) }, []))).toBe('FIELD_INVALID');
  });
  it('an empty value removes the custom text so the default shows again', () => { const r = validatePageSeo({ seoTitle: '  ', seoDescription: '' }, []); expect(r.ok && r.edit).toEqual({}); });
  it('the share picture must be one of the site\'s own pictures (gallery or uploads)', () => {
    expect(code(validatePageSeo({ shareImageRef: 'https://elsewhere.example.test/a.png' }, [IMG]))).toBe('IMAGE_NOT_ALLOWED'); expect(code(validatePageSeo({ shareImageRef: 'not a link' }, [IMG]))).toBe('FIELD_INVALID');
  });
  it('markup, promises of results or ranking, a rupee price and retired product names are refused, naming the field', () => {
    for (const bad of ['<b>Best</b>', 'We guarantee the number 1 ranking on Google', 'Taps from ₹300', 'Part of Workspace']) { const r = validatePageSeo({ seoTitle: bad }, []); expect(r.ok).toBe(false); expect(!r.ok && r.field).toBe('seoTitle'); }
    expect(code(validatePageSeo({ seoDescription: 'Guaranteed first page of Google' }, []))).toBe('WORDING_NOT_ALLOWED');
  });
  it('the slug and every locked marking field cannot be written here', () => {
    for (const k of ['slug', 'canonical', 'structuredData', 'robots', 'hreflang', 'ogImage']) expect(code(validatePageSeo({ [k]: 'x' } as never, []))).toBe('FIELD_LOCKED');
  });
});

describe('the document keeps SEO per page', () => {
  it('stores and removes a page\'s custom text, refuses an unknown page, and compares by page', () => {
    const a = writeSeo(emptyDoc(), 'about', { seoTitle: 'About us' }, []); expect(a.ok && a.doc.seo.about).toEqual({ seoTitle: 'About us' });
    expect(code(writeSeo(emptyDoc(), 'nonsense', { seoTitle: 'x' }, []))).toBe('FIELD_LOCKED');
    const b = writeSeo(a.ok ? a.doc : emptyDoc(), 'about', { seoTitle: '' }, []); expect(b.ok && 'about' in b.doc.seo).toBe(false);
    expect(diffDocs(emptyDoc(), a.ok ? a.doc : emptyDoc())).toMatchObject({ seo: ['about'] }); expect(normaliseDoc({ seo: 5 }).seo).toEqual({});
  });
  it('reaches the source document for the build', () => {
    const d = writeSeo(emptyDoc(), 'home', { seoTitle: 'Plumber in Madurai' }, []); if (!d.ok) throw new Error('x');
    const out = applyToSource({ vendor: { id: 'v' }, cms: null, items: [], claimed: true } as unknown as SourceDocument, d.doc); expect(out.pageSeo).toEqual({ home: { seoTitle: 'Plumber in Madurai' } });
  });
});

describe('the defaults', () => {
  const who = { businessName: 'Sri Ganesh Plumbing', city: 'Madurai', categoryLabel: 'Plumber' };
  it('come from the business name, the city and the category only, within 60 and 160, and never carry a price or a promise', () => {
    for (const k of ['home', 'about', 'services', 'gallery', 'contact', 'page:warranty', 'item:abc']) {
      const d = defaultPageSeo(k, who); expect(d.seoTitle.length).toBeGreaterThan(0); expect(d.seoTitle.length).toBeLessThanOrEqual(60); expect(d.seoDescription.length).toBeLessThanOrEqual(160);
      expect(`${d.seoTitle} ${d.seoDescription}`).toContain('Sri Ganesh Plumbing'); expect(`${d.seoTitle} ${d.seoDescription}`).not.toMatch(/₹|guarantee|best|number 1|top rated|cheap/i);
    }
    expect(defaultPageSeo('home', who).seoDescription).toContain('Madurai'); expect(defaultPageSeo('home', who).seoDescription).toContain('Plumber');
  });
  it('a long business name is cut at a word, and a missing city is simply left out', () => {
    const d = defaultPageSeo('home', { businessName: 'The Very Long Named Association of Registered Plumbing and Sanitary Contractors', city: '', categoryLabel: 'Plumber' });
    expect(d.seoTitle.length).toBeLessThanOrEqual(60); expect(d.seoDescription).not.toContain(' in .'); expect(d.seoDescription).not.toMatch(/\s{2,}/);
  });
  it('two different pages never get the same default title', () => { const titles = ['home', 'about', 'services', 'gallery', 'contact'].map((k) => defaultPageSeo(k, who).seoTitle); expect(new Set(titles).size).toBe(5); });
});

describe('what staff reports flag', () => {
  const row = (pageKey: string, over: Record<string, unknown> = {}) => ({ pageKey, seoTitle: `T ${pageKey}`, seoDescription: 'd'.repeat(80), customTitle: true, customDescription: true, ...over });
  it('a page still on the default title or description, a duplicate title and a short description', () => {
    const rows = [row('home'), row('about', { customTitle: false }), row('services', { seoTitle: 'T home' }), row('gallery', { seoDescription: 'short', customDescription: true }), row('contact', { customDescription: false })];
    expect(seoIssues(rows)).toEqual(expect.arrayContaining([{ pageKey: 'about', issue: 'DEFAULT_TITLE' }, { pageKey: 'contact', issue: 'DEFAULT_DESCRIPTION' }, { pageKey: 'services', issue: 'DUPLICATE_TITLE' }, { pageKey: 'home', issue: 'DUPLICATE_TITLE' }, { pageKey: 'gallery', issue: 'SHORT_DESCRIPTION' }]));
    expect(seoIssues([row('home')])).toEqual([]);
  });
});
