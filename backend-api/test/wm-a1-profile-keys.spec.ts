import { toRendererInput } from '../src/site-publish/content/content-adapter';
import { SourceDocument } from '../src/site-publish/content/content-types';
import { applyToSource, emptyDoc, FIELD_DEFS, ManagedDoc, validYear, writeField } from '../src/v3-website/core/managed-doc';
import { COMMON_FIELDS, COMMON_MAP } from '../src/v3-profile-fields/core/profile-core';

/** Website Manager lane A, item c: owner name, organisation name, year established and the Google Business Profile link are editable fields that reach the site content. */
const source = (): SourceDocument => ({
  vendor: { id: 'va', subdomain: 'va', businessName: 'Shop va', name: 'Owner Person', phone: '+919800000000', email: 'o@example.test', status: 'ACTIVE', industry: 'plumber' },
  cms: {
    businessName: 'Shop va', tagline: 'Legacy tagline', about: 'Legacy about', logo: null, banner: null, favicon: null, phone: '+919800000000', email: 'o@example.test',
    address: '1 Main Road, Madurai 625001', businessHours: null, whatsapp: null, facebook: null, instagram: null, linkedin: null, youtube: null, googleMaps: null, portfolio: null,
    testimonials: null, pages: null, extras: null, packKey: 'plumber', siteStatus: 'DRAFT', ogImage: null, seoTitle: null, seoDesc: null,
  },
  items: [],
  claimed: true,
});
const set = (d: ManagedDoc, k: string, v: string): ManagedDoc => { const r = writeField(d, k, v); if (!r.ok) throw new Error(`${k}: ${r.code}`); return r.doc; };

describe('the four new profile keys', () => {
  it('are editable fields with a label', () => {
    for (const k of ['about.ownerName', 'about.organisation', 'about.established', 'social.googleBusiness']) expect(FIELD_DEFS[k].label.length).toBeGreaterThan(3);
  });

  it('the year must be four digits, not before 1800 and not in the future; empty removes it', () => {
    const now = new Date('2026-11-25T00:00:00Z');
    expect(validYear('2012', now)).toBe(true);
    expect(validYear('1800', now)).toBe(true);
    expect(validYear('2026', now)).toBe(true);
    for (const v of ['2027', '1799', '12', 'abcd', '20 12', '02012']) expect(validYear(v, now)).toBe(false);
    expect(writeField(emptyDoc(), 'about.established', 'twenty').ok).toBe(false);
    expect(writeField(emptyDoc(), 'about.established', '2999').ok).toBe(false);
    const ok = writeField(emptyDoc(), 'about.established', '2012');
    expect(ok.ok && ok.doc.fields['about.established']).toBe('2012');
    const cleared = writeField(ok.ok ? ok.doc : emptyDoc(), 'about.established', '');
    expect(cleared.ok && 'about.established' in cleared.doc.fields).toBe(false);
  });

  it('the Google Business Profile link must be an https link; markup in a name is refused', () => {
    expect(writeField(emptyDoc(), 'social.googleBusiness', 'http://g.page/x').ok).toBe(false);
    expect(writeField(emptyDoc(), 'social.googleBusiness', 'https://g.page/r/abc').ok).toBe(true);
    expect(writeField(emptyDoc(), 'about.ownerName', '<b>Ravi</b>').ok).toBe(false);
  });

  it('reach the site content: about.ownerName, organisation, established and social.googleBusiness', () => {
    let d = emptyDoc();
    d = set(d, 'about.ownerName', 'Ravi Kumar'); d = set(d, 'about.organisation', 'Kumar Plumbing Works'); d = set(d, 'about.established', '2012'); d = set(d, 'social.googleBusiness', 'https://g.page/r/abc');
    const c = toRendererInput(applyToSource(source(), d), { categoryId: 'plumber', lang: 'en', year: 2026, siteBase: 'g4d.test' }).content as { about: Record<string, string>; social: Record<string, string> };
    expect(c.about).toMatchObject({ ownerName: 'Ravi Kumar', organisation: 'Kumar Plumbing Works', established: '2012' });
    expect(c.social.googleBusiness).toBe('https://g.page/r/abc');
  });

  it('are empty when nothing was written: the vendor account name is never used as the owner name', () => {
    const c = toRendererInput(applyToSource(source(), emptyDoc()), { categoryId: 'plumber', lang: 'en', year: 2026, siteBase: 'g4d.test' }).content as { about: Record<string, string>; social: Record<string, string> };
    expect(c.about).toMatchObject({ ownerName: '', organisation: '', established: '' });
    expect(c.social.googleBusiness).toBe('');
  });

  it('are in the common profile set and mapped to the site fields', () => {
    const keys = COMMON_FIELDS.map((f) => f[0]);
    for (const k of ['owner_name', 'organisation_name', 'established_year', 'google_business_link']) expect(keys).toContain(k);
    const m = (k: string) => COMMON_MAP.find((x) => x.fieldKey === k);
    expect(m('owner_name')).toMatchObject({ targetKind: 'FIELD', targetKey: 'about.ownerName' });
    expect(m('organisation_name')).toMatchObject({ targetKey: 'about.organisation' });
    expect(m('established_year')).toMatchObject({ targetKey: 'about.established' });
    expect(m('google_business_link')).toMatchObject({ targetKey: 'social.googleBusiness' });
  });
});
