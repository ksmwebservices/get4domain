import { REVIEW_LINK_HOSTS, validateReviewUrl } from '../src/v3-website/core/review-link-core';
import { applyToSource, diffDocs, emptyDoc, normaliseDoc, writeReviewUrl } from '../src/v3-website/core/managed-doc';
import { toRendererInput } from '../src/site-publish/content/content-adapter';
import { SourceDocument } from '../src/site-publish/content/content-types';

/** Slice B3 (amendment 08): the Google review link, pure. https only, a host allow-list, entered by the vendor; nothing is ever posted to Google by us. */
const code = (r: { ok: boolean; code?: string }): string => (r.ok ? 'OK' : r.code ?? '?');

describe('the link the vendor enters', () => {
  it('the allow-list is exactly google.com, g.page, maps.app.goo.gl and search.google.com', () => { expect([...REVIEW_LINK_HOSTS].sort()).toEqual(['g.page', 'google.com', 'maps.app.goo.gl', 'search.google.com']); });
  it('accepts https links on those hosts, with paths and queries, and subdomains of google.com', () => {
    for (const u of ['https://g.page/r/CabcDEF123/review', 'https://search.google.com/local/writereview?placeid=ChIJabc', 'https://www.google.com/maps/place/Shop/@13.08,80.27,17z', 'https://maps.app.goo.gl/AbCdEf123', 'https://google.com/search?q=shop', 'https://maps.google.com/?cid=123']) expect(code(validateReviewUrl(u))).toBe('OK');
  });
  it('refuses http, other hosts, look-alike hosts, credentials, odd ports and anything that is not a plain link', () => {
    for (const u of ['http://g.page/r/abc/review', 'https://evil.example.test/review', 'https://google.com.evil.test/review', 'https://evilgoogle.com/x', 'https://notg.page/x', 'https://g.page.evil.test/x', 'https://goo.gl/maps/abc', 'https://user:pw@g.page/r/abc', 'https://g.page:8443/r/abc', 'javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://g.page/x']) expect(code(validateReviewUrl(u))).toMatch(/REVIEW_HOST_NOT_ALLOWED|FIELD_INVALID/);
    for (const u of ['not a link', 'https://g.page/r/a b', 5 as never, 'https://g.page/' + 'x'.repeat(500)]) expect(code(validateReviewUrl(u))).toBe('FIELD_INVALID');
    expect(code(validateReviewUrl('https://evil.example.test/review'))).toBe('REVIEW_HOST_NOT_ALLOWED'); expect(code(validateReviewUrl('http://g.page/r/abc'))).toBe('FIELD_INVALID');
  });
  it('an empty value clears the link; the link is trimmed', () => { const e = validateReviewUrl('  '); expect(e.ok && e.url).toBe(''); const t = validateReviewUrl('  https://g.page/r/abc/review '); expect(t.ok && t.url).toBe('https://g.page/r/abc/review'); });
});

describe('the document keeps the link', () => {
  it('stores it, removes it when emptied, and compares', () => {
    const a = writeReviewUrl(emptyDoc(), 'https://g.page/r/abc/review'); expect(a.ok && a.doc.reviewUrl).toBe('https://g.page/r/abc/review');
    const b = writeReviewUrl(a.ok ? a.doc : emptyDoc(), ''); expect(b.ok && b.doc.reviewUrl).toBeUndefined();
    expect(diffDocs(emptyDoc(), a.ok ? a.doc : emptyDoc()).reviewLink).toBe(true); expect(diffDocs(emptyDoc(), emptyDoc()).reviewLink).toBe(false); expect(normaliseDoc({ reviewUrl: 5 }).reviewUrl).toBeUndefined();
    expect(code(writeReviewUrl(emptyDoc(), 'https://evil.example.test/x'))).toBe('REVIEW_HOST_NOT_ALLOWED');
  });
});

describe('what the page gets', () => {
  const src = (): SourceDocument => ({ vendor: { id: 'v', subdomain: 'v', businessName: 'Shop', name: 'O', phone: '+919800000000', email: 'o@example.test', status: 'ACTIVE', industry: 'plumber' }, cms: { businessName: 'Shop', tagline: null, about: null, logo: null, banner: null, favicon: null, phone: '+919800000000', email: null, address: null, businessHours: null, whatsapp: null, facebook: null, instagram: null, linkedin: null, youtube: null, googleMaps: null, portfolio: null, testimonials: null, pages: null, extras: null, packKey: 'plumber', siteStatus: 'DRAFT', ogImage: null, seoTitle: null, seoDesc: null }, items: [], claimed: true });
  const opts = { categoryId: 'plumber', lang: 'en' as const, year: 2026, siteBase: 'g4d.test' };
  it('a plan with calls to action gets the review link for the kit\'s Write a review button; a plan without gets nothing', () => {
    const w = writeReviewUrl(emptyDoc(), 'https://g.page/r/abc/review'); if (!w.ok) throw new Error('x');
    expect((toRendererInput(applyToSource(src(), w.doc), opts).content.reviews as { writeUrl: string }).writeUrl).toBe('https://g.page/r/abc/review');
    expect(toRendererInput(applyToSource(src(), w.doc), { ...opts, directions: false }).content.reviews).toBeUndefined(); expect(toRendererInput(applyToSource(src(), emptyDoc()), opts).content.reviews).toBeUndefined();
  });
});
