import { buildDirectionsUrl, composeAddress, parseMapLink, validateLocation } from '../src/v3-website/core/location-core';
import { applyToSource, diffDocs, emptyDoc, normaliseDoc, writeLocation } from '../src/v3-website/core/managed-doc';
import { toRendererInput } from '../src/site-publish/content/content-adapter';
import { SourceDocument } from '../src/site-publish/content/content-types';

/** Slice B2 (amendment 08): location and directions, pure. The directions link is built without a key and without a network call; a pasted full map link is read for coordinates; short links are never expanded. */
const code = (r: { ok: boolean; code?: string }): string => (r.ok ? 'OK' : r.code ?? '?');
const FULL = { addressLine1: '12 Kamaraj Road', addressLine2: 'Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040' };

describe('validating a location', () => {
  it('accepts a full address with or without coordinates and trims the text', () => {
    expect(code(validateLocation(FULL))).toBe('OK'); expect(code(validateLocation({ ...FULL, latitude: 13.0827, longitude: 80.2707 }))).toBe('OK');
    const r = validateLocation({ addressLine1: '  12 Kamaraj Road ' }); expect(r.ok && r.location.addressLine1).toBe('12 Kamaraj Road');
  });
  it('the pincode is six digits; text fields are plain and short', () => {
    for (const bad of ['60004', '6000400', 'ABC123', '600 040']) expect(code(validateLocation({ ...FULL, pincode: bad }))).toBe('FIELD_INVALID');
    expect(code(validateLocation({ ...FULL, addressLine1: 'x'.repeat(121) }))).toBe('FIELD_INVALID'); expect(code(validateLocation({ ...FULL, city: '<b>x</b>' }))).toBe('FIELD_INVALID'); expect(code(validateLocation({ ...FULL, state: 5 as never }))).toBe('FIELD_INVALID');
  });
  it('coordinates are decimal numbers in range and come as a pair', () => {
    for (const [la, lo] of [[91, 0], [-91, 0], [0, 181], [0, -181], [Number.NaN, 5]]) expect(code(validateLocation({ ...FULL, latitude: la, longitude: lo }))).toBe('FIELD_INVALID');
    expect(code(validateLocation({ ...FULL, latitude: 13.08 }))).toBe('LOCATION_COORDS_INCOMPLETE'); expect(code(validateLocation({ ...FULL, longitude: 80.27 }))).toBe('LOCATION_COORDS_INCOMPLETE');
    expect(code(validateLocation({ ...FULL, latitude: '13.08' as never, longitude: '80.27' as never }))).toBe('FIELD_INVALID');
    expect(code(validateLocation({ ...FULL, latitude: 90, longitude: -180 }))).toBe('OK');
  });
  it('an unknown field is refused, not dropped', () => { expect(code(validateLocation({ ...FULL, directionsUrl: 'https://x.test' } as never))).toBe('FIELD_LOCKED'); expect(code(validateLocation('x' as never))).toBe('FIELD_INVALID'); });
  it('an empty location is allowed and means "not set"', () => { const r = validateLocation({}); expect(r.ok && r.location).toEqual({}); });
});

describe('the directions link (pure: no key, no network)', () => {
  it('uses the coordinates when there are some, in the documented format', () => {
    expect(buildDirectionsUrl({ ...FULL, latitude: 13.0827, longitude: 80.2707 })).toBe('https://www.google.com/maps/search/?api=1&query=13.0827,80.2707');
    expect(buildDirectionsUrl({ latitude: -33.8688, longitude: 151.2093 })).toBe('https://www.google.com/maps/search/?api=1&query=-33.8688,151.2093');
  });
  it('otherwise the same format with the address text, URL-encoded', () => {
    expect(buildDirectionsUrl(FULL)).toBe(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('12 Kamaraj Road, Anna Nagar, Chennai, Tamil Nadu, 600040')}`);
    expect(buildDirectionsUrl({ city: 'Madurai & Co' })).toBe('https://www.google.com/maps/search/?api=1&query=Madurai%20%26%20Co');
  });
  it('is null when there is nothing to point at', () => { expect(buildDirectionsUrl({})).toBeNull(); expect(buildDirectionsUrl({ addressLine1: '  ' })).toBeNull(); });
  it('never contains a key or a script', () => { const u = buildDirectionsUrl({ addressLine1: 'a"><script>alert(1)</script>' })!; expect(u).not.toMatch(/[<>"]/); expect(u.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBe(true); });
});

describe('reading a pasted map link', () => {
  it('reads coordinates from the usual full-link shapes', () => {
    const cases: Array<[string, [number, number]]> = [
      ['https://www.google.com/maps/place/Shop/@13.0827,80.2707,17z/data=!3m1', [13.0827, 80.2707]],
      ['https://www.google.com/maps/place/Shop/data=!4m6!3d13.0827!4d80.2707', [13.0827, 80.2707]],
      ['https://www.google.com/maps?q=13.0827,80.2707', [13.0827, 80.2707]],
      ['https://www.google.com/maps/search/?api=1&query=-33.8688,151.2093', [-33.8688, 151.2093]],
      ['https://maps.google.com/?ll=9.9252,78.1198&z=12', [9.9252, 78.1198]],
    ];
    for (const [u, [la, lo]] of cases) { const r = parseMapLink(u); expect(r.ok && r.coords).toEqual({ latitude: la, longitude: lo }); }
  });
  it('short links are NOT expanded (no network): the vendor is asked for the full link or the address', () => {
    for (const u of ['https://maps.app.goo.gl/abc123', 'https://goo.gl/maps/abc123']) expect(code(parseMapLink(u))).toBe('SHORT_LINK_NOT_EXPANDED');
  });
  it('refuses a link that is not https, not a map host, or has no coordinates; out-of-range coordinates are not accepted', () => {
    expect(code(parseMapLink('http://www.google.com/maps/@13.08,80.27,15z'))).toBe('FIELD_INVALID'); expect(code(parseMapLink('not a link'))).toBe('FIELD_INVALID');
    expect(code(parseMapLink('https://evil.example.test/maps/@13.08,80.27,15z'))).toBe('LINK_HOST_NOT_ALLOWED'); expect(code(parseMapLink('https://www.google.com.evil.test/maps/@13.08,80.27,15z'))).toBe('LINK_HOST_NOT_ALLOWED');
    expect(code(parseMapLink('https://www.google.com/maps/place/Some+Shop'))).toBe('LINK_HAS_NO_COORDINATES'); expect(code(parseMapLink('https://www.google.com/maps/@95.5,200.5,15z'))).toBe('LINK_HAS_NO_COORDINATES');
  });
});

describe('the document keeps a location', () => {
  it('stores it; a pasted full link supplies coordinates the vendor did not type; typed coordinates win', () => {
    const a = writeLocation(emptyDoc(), { ...FULL, mapLinkInput: 'https://www.google.com/maps/@13.0827,80.2707,17z' }); expect(a.ok && a.doc.location).toMatchObject({ latitude: 13.0827, longitude: 80.2707, city: 'Chennai' });
    const b = writeLocation(emptyDoc(), { ...FULL, latitude: 9.9, longitude: 78.1, mapLinkInput: 'https://www.google.com/maps/@13.0827,80.2707,17z' }); expect(b.ok && b.doc.location).toMatchObject({ latitude: 9.9, longitude: 78.1 });
  });
  it('a short link in the field is refused with the reason; an empty location removes it', () => {
    expect(code(writeLocation(emptyDoc(), { ...FULL, mapLinkInput: 'https://maps.app.goo.gl/abc' }))).toBe('SHORT_LINK_NOT_EXPANDED');
    const a = writeLocation(emptyDoc(), FULL); const b = writeLocation(a.ok ? a.doc : emptyDoc(), {}); expect(b.ok && b.doc.location).toBeUndefined();
  });
  it('compares and normalises', () => { const a = writeLocation(emptyDoc(), FULL); expect(diffDocs(emptyDoc(), a.ok ? a.doc : emptyDoc()).location).toBe(true); expect(diffDocs(emptyDoc(), emptyDoc()).location).toBe(false); expect(normaliseDoc({ location: 5 }).location).toBeUndefined(); });
});

describe('what the page gets', () => {
  const src = (): SourceDocument => ({ vendor: { id: 'v', subdomain: 'v', businessName: 'Shop', name: 'O', phone: '+919800000000', email: 'o@example.test', status: 'ACTIVE', industry: 'plumber' }, cms: { businessName: 'Shop', tagline: null, about: null, logo: null, banner: null, favicon: null, phone: '+919800000000', email: null, address: 'Old address, Salem 636001', businessHours: null, whatsapp: null, facebook: null, instagram: null, linkedin: null, youtube: null, googleMaps: 'https://old.example.test/map', portfolio: null, testimonials: null, pages: null, extras: null, packKey: 'plumber', siteStatus: 'DRAFT', ogImage: null, seoTitle: null, seoDesc: null }, items: [], claimed: true });
  it('the address, city, pincode and the directions link reach the renderer input; nothing else of the legacy map text is used', () => {
    const w = writeLocation(emptyDoc(), { ...FULL, latitude: 13.0827, longitude: 80.2707 }); if (!w.ok) throw new Error('x');
    const r = toRendererInput(applyToSource(src(), w.doc), { categoryId: 'plumber', lang: 'en', year: 2026, siteBase: 'g4d.test' });
    expect(r.content.contact).toMatchObject({ address: composeAddress(w.doc.location!), city: 'Chennai', pin: '600040', mapUrl: 'https://www.google.com/maps/search/?api=1&query=13.0827,80.2707' });
  });
  it('a site with no location written keeps its legacy address and map text', () => {
    const r = toRendererInput(applyToSource(src(), emptyDoc()), { categoryId: 'plumber', lang: 'en', year: 2026, siteBase: 'g4d.test' });
    expect(r.content.contact).toMatchObject({ address: 'Old address, Salem 636001', city: 'Salem', pin: '636001', mapUrl: 'https://old.example.test/map' });
  });
});
