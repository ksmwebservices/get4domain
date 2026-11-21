import { TESTIMONIAL_LABEL, validateTestimonials } from '../src/v3-website/core/testimonial-core';
import { applyToSource, diffDocs, emptyDoc, normaliseDoc, writeTestimonials } from '../src/v3-website/core/managed-doc';
import { toRendererInput } from '../src/site-publish/content/content-adapter';
import { SourceDocument } from '../src/site-publish/content/content-types';
import { validateWebsiteSetting, DEFAULT_WEBSITE_SETTINGS } from '../src/v3-website/settings/website-settings';

/** Slice B4 (amendment 08): testimonials, pure. Pro only; first name or initials; up to 300 characters; the vendor confirms the customer agreed; no rating of any kind. */
const code = (r: { ok: boolean; code?: string }): string => (r.ok ? 'OK' : r.code ?? '?');
const good = (over: Record<string, unknown> = {}) => ({ name: 'Anita R.', text: 'They explained the work before they started and kept the house clean.', date: '2026-09', consent: true, ...over });
const CAP = { maxCount: 5 };

describe('the count cap is a staff setting with no default', () => {
  it('starts unset, so testimonials are refused until staff set it; the settings API takes a whole number above zero', () => {
    expect(DEFAULT_WEBSITE_SETTINGS).toMatchObject({ testimonialMaxCount: null });
    expect(code(validateTestimonials([good()], { maxCount: null }))).toBe('TESTIMONIALS_NOT_CONFIGURED');
    expect(() => validateWebsiteSetting('testimonialMaxCount', 6)).not.toThrow(); for (const bad of [0, -2, 1.5, '6', null]) expect(() => validateWebsiteSetting('testimonialMaxCount', bad)).toThrow();
  });
  it('more items than the cap are refused', () => { expect(code(validateTestimonials(Array.from({ length: 6 }, (_, i) => good({ text: `Good work on visit ${i}` })), CAP))).toBe('LIMIT_REACHED'); expect(code(validateTestimonials(Array.from({ length: 5 }, (_, i) => good({ text: `Good work on visit ${i}` })), CAP))).toBe('OK'); });
});

describe('one testimonial', () => {
  it('accepts a first name or initials, text up to 300, an optional date, and consent', () => {
    expect(code(validateTestimonials([good()], CAP))).toBe('OK');
    for (const name of ['Anita', 'A. R.', 'Anita R', 'S', 'Meena', 'அனிதா']) expect(code(validateTestimonials([good({ name })], CAP))).toBe('OK');
    expect(code(validateTestimonials([good({ text: 'x'.repeat(300) })], CAP))).toBe('OK'); expect(code(validateTestimonials([good({ date: undefined })], CAP))).toBe('OK'); expect(code(validateTestimonials([good({ date: '2026-09-14' })], CAP))).toBe('OK');
  });
  it('refuses a full name, a handle or a link in the name field, digits, and an empty or over-long name', () => {
    for (const name of ['Anita Rajan Kumar', 'anita@example.test', 'https://x.test', 'Anita 123', '', '   ', 'x'.repeat(41), '<b>A</b>']) expect(code(validateTestimonials([good({ name })], CAP))).toBe('NAME_NOT_ALLOWED');
  });
  it('the customer\'s agreement must be confirmed by the vendor: anything but true is refused', () => {
    for (const consent of [false, undefined, 'true', 1, null]) expect(code(validateTestimonials([good({ consent })], CAP))).toBe('CONSENT_REQUIRED');
  });
  it('the text is plain, not empty, within 300 characters, free of promises, prices and retired names', () => {
    for (const text of ['', '  ', 'x'.repeat(301), '<b>Great</b>', 'Guaranteed number 1 ranking on Google', 'Taps from ₹300', 'Part of Workspace']) expect(code(validateTestimonials([good({ text })], CAP))).toMatch(/FIELD_INVALID|WORDING_NOT_ALLOWED/);
    expect(code(validateTestimonials([good({ text: 'Guaranteed first page of Google' })], CAP))).toBe('WORDING_NOT_ALLOWED');
  });
  it('the date, when given, is a real day or month', () => { for (const date of ['2026-13', '2026-02-30', 'yesterday', '26-09', '2026-9']) expect(code(validateTestimonials([good({ date })], CAP))).toBe('FIELD_INVALID'); });
  it('NO rating of any kind: stars, scores, aggregates, links and every other key are refused, not dropped', () => {
    for (const k of ['rating', 'stars', 'score', 'aggregateRating', 'url', 'reviewBody', 'source']) expect(code(validateTestimonials([good({ [k]: 5 })], CAP))).toBe('FIELD_LOCKED');
    expect(code(validateTestimonials('x' as never, CAP))).toBe('FIELD_INVALID'); expect(code(validateTestimonials([null] as never, CAP))).toBe('FIELD_INVALID');
  });
  it('the site label is fixed wording: words shared by the business owner', () => { expect(TESTIMONIAL_LABEL).toBe('Words shared by the business owner'); });
});

describe('the document keeps testimonials', () => {
  it('stores them (trimmed), compares, and an empty list clears them', () => {
    const a = writeTestimonials(emptyDoc(), [good({ name: ' Anita R. ' })], CAP); expect(a.ok && a.doc.testimonials).toEqual([{ name: 'Anita R.', text: good().text, date: '2026-09', consent: true }]);
    expect(diffDocs(emptyDoc(), a.ok ? a.doc : emptyDoc()).testimonials).toBe(true); expect(diffDocs(emptyDoc(), emptyDoc()).testimonials).toBe(false);
    const b = writeTestimonials(a.ok ? a.doc : emptyDoc(), [], CAP); expect(b.ok && b.doc.testimonials).toEqual([]); expect(normaliseDoc({ testimonials: 'x' }).testimonials).toBeUndefined();
  });
});

describe('what the page gets', () => {
  const src = (): SourceDocument => ({ vendor: { id: 'v', subdomain: 'v', businessName: 'Shop', name: 'O', phone: '+919800000000', email: 'o@example.test', status: 'ACTIVE', industry: 'plumber' }, cms: { businessName: 'Shop', tagline: null, about: null, logo: null, banner: null, favicon: null, phone: '+919800000000', email: null, address: null, businessHours: null, whatsapp: null, facebook: null, instagram: null, linkedin: null, youtube: null, googleMaps: null, portfolio: null, testimonials: [{ quote: 'Legacy words', author: 'Old Customer' }], pages: null, extras: null, packKey: 'plumber', siteStatus: 'DRAFT', ogImage: null, seoTitle: null, seoDesc: null }, items: [], claimed: true });
  const opts = { categoryId: 'plumber', lang: 'en' as const, year: 2026 as const, siteBase: 'g4d.test' };
  it('Pro: the text, the name and the owner label reach the theme; no rating field exists on any item', () => {
    const w = writeTestimonials(emptyDoc(), [good()], CAP); if (!w.ok) throw new Error('x');
    const t = toRendererInput(applyToSource(src(), w.doc), opts).content.testimonials as Array<Record<string, unknown>>;
    expect(t).toEqual([{ quote: good().text, author: 'Anita R.', note: `${TESTIMONIAL_LABEL} (2026-09)` }]);
    for (const item of t) expect(Object.keys(item).sort()).toEqual(['author', 'note', 'quote']);
  });
  it('Free (no calls to action): the vendor-written testimonials are not drawn, the older legacy ones are untouched', () => {
    const w = writeTestimonials(emptyDoc(), [good()], CAP); if (!w.ok) throw new Error('x');
    expect(toRendererInput(applyToSource(src(), emptyDoc()), { ...opts, directions: false }).content.testimonials).toEqual([{ quote: 'Legacy words', author: 'Old Customer', note: '' }]);
    expect(toRendererInput(applyToSource(src(), w.doc), { ...opts, directions: false }).content.testimonials).toEqual([]);
  });
});
