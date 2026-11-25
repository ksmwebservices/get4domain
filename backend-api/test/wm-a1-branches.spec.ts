import { toRendererInput } from '../src/site-publish/content/content-adapter';
import { SourceDocument } from '../src/site-publish/content/content-types';
import { applyToSource, emptyDoc, ManagedDoc, validateList, writeList } from '../src/v3-website/core/managed-doc';
import { BRANCHES_MAX, branchAddress, directionsFor } from '../src/v3-website/core/branch-core';

/** Website Manager lane A, item e: several locations per business, each with address, village or locality, area, city and a map link. */
const source = (): SourceDocument => ({
  vendor: { id: 'va', subdomain: 'va', businessName: 'Shop va', name: 'Owner', phone: '+919800000000', email: 'o@example.test', status: 'ACTIVE', industry: 'plumber' },
  cms: {
    businessName: 'Shop va', tagline: 't', about: 'a', logo: null, banner: null, favicon: null, phone: '+919800000000', email: 'o@example.test', address: '1 Main Road, Madurai 625001', businessHours: null,
    whatsapp: null, facebook: null, instagram: null, linkedin: null, youtube: null, googleMaps: null, portfolio: null, testimonials: null, pages: null, extras: null, packKey: 'plumber',
    siteStatus: 'DRAFT', ogImage: null, seoTitle: null, seoDesc: null,
  },
  items: [], claimed: true,
});
const put = (d: ManagedDoc, rows: unknown): ManagedDoc => { const r = writeList(d, 'branches', rows); if (!r.ok) throw new Error(`${r.code} ${r.message}`); return r.doc; };
const out = (d: ManagedDoc, directions = true) => toRendererInput(applyToSource(source(), d), { categoryId: 'plumber', lang: 'en', year: 2026, siteBase: 'g4d.test', directions }).content as { branches: Array<Record<string, string>> };
const MAP = 'https://www.google.com/maps/place/Aluva/@10.1,76.35,15z';

describe('branches', () => {
  it('a branch needs a name; the pincode is six digits; the map link must be a Google Maps link', () => {
    expect(validateList('branches', [{ addressLine: 'x' }]).ok).toBe(false);
    expect(validateList('branches', [{ name: 'Aluva', pincode: '68310' }]).ok).toBe(false);
    expect(validateList('branches', [{ name: 'Aluva', pincode: '683101' }]).ok).toBe(true);
    expect(validateList('branches', [{ name: 'Aluva', mapLink: 'https://evil.example.test/maps' }]).ok).toBe(false);
    expect(validateList('branches', [{ name: 'Aluva', mapLink: 'http://www.google.com/maps/x' }]).ok).toBe(false);
    expect(validateList('branches', [{ name: 'Aluva', mapLink: MAP }]).ok).toBe(true);
    expect(validateList('branches', [{ name: 'Aluva', mapLink: 'https://maps.app.goo.gl/abc123' }]).ok).toBe(true);
    expect(validateList('branches', [{ name: '<b>x</b>' }]).ok).toBe(false);
  });

  it(`at most ${BRANCHES_MAX} branches`, () => {
    expect(validateList('branches', Array.from({ length: BRANCHES_MAX }, (_, i) => ({ name: `B${i}` }))).ok).toBe(true);
    expect(validateList('branches', Array.from({ length: BRANCHES_MAX + 1 }, (_, i) => ({ name: `B${i}` }))).ok).toBe(false);
  });

  it('reach the site content with a composed address and a map link', () => {
    const d = put(emptyDoc(), [
      { name: 'Aluva branch', addressLine: '12 Market Road', locality: 'Thottakkattukara', area: 'Aluva', city: 'Ernakulam', pincode: '683101', mapLink: MAP },
      { name: 'Kakkanad branch', addressLine: '3 Info Park Road', city: 'Kochi' },
    ]);
    const [a, b] = out(d).branches;
    expect(a).toMatchObject({ id: 'aluva-branch', name: 'Aluva branch', address: '12 Market Road, Thottakkattukara, Aluva, Ernakulam, 683101', locality: 'Thottakkattukara', area: 'Aluva', city: 'Ernakulam', pin: '683101', mapUrl: MAP });
    expect(b.address).toBe('3 Info Park Road, Kochi');
    expect(b.mapUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);   // built from the address, never fetched
  });

  it('a Free site (no directions) shows no map link, only the address', () => {
    const d = put(emptyDoc(), [{ name: 'Aluva', addressLine: '12 Market Road', mapLink: MAP }]);
    expect(out(d, false).branches[0]).toMatchObject({ address: '12 Market Road', mapUrl: '' });
  });

  it('are an empty list when none were written', () => { expect(out(emptyDoc()).branches).toEqual([]); });

  it('helpers: the address leaves out empty parts; nothing to point at gives no link', () => {
    expect(branchAddress({ addressLine: ' A ', city: 'B' })).toBe('A, B');
    expect(directionsFor({ name: 'x' })).toBe('');
  });
});
