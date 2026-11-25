import { blockEntries, toRendererInput } from '../src/site-publish/content/content-adapter';
import { SourceDocument } from '../src/site-publish/content/content-types';
import { applyToSource, emptyDoc, LIST_DEFS, ManagedDoc, validateList, writeList } from '../src/v3-website/core/managed-doc';

/** Website Manager lane A, item d: groups, areas, offers and blocks are editable lists and reach the site content. */
const source = (): SourceDocument => ({
  vendor: { id: 'va', subdomain: 'va', businessName: 'Shop va', name: 'Owner', phone: '+919800000000', email: 'o@example.test', status: 'ACTIVE', industry: 'plumber' },
  cms: {
    businessName: 'Shop va', tagline: 't', about: 'a', logo: null, banner: null, favicon: null, phone: '+919800000000', email: 'o@example.test', address: '1 Main Road, Madurai 625001', businessHours: null,
    whatsapp: null, facebook: null, instagram: null, linkedin: null, youtube: null, googleMaps: null, portfolio: null, testimonials: null, pages: null, extras: null, packKey: 'plumber',
    siteStatus: 'DRAFT', ogImage: null, seoTitle: null, seoDesc: null,
  },
  items: [], claimed: true,
});
const put = (d: ManagedDoc, name: 'groups' | 'areas' | 'offers' | 'blocks', items: unknown): ManagedDoc => { const r = writeList(d, name, items); if (!r.ok) throw new Error(`${name}: ${r.code} ${r.message}`); return r.doc; };
const content = (d: ManagedDoc) => toRendererInput(applyToSource(source(), d), { categoryId: 'plumber', lang: 'en', year: 2026, siteBase: 'g4d.test' }).content as Record<string, Array<Record<string, unknown>>>;

describe('the four new lists', () => {
  it('are editable lists with their own fields (no longer "That list is not editable")', () => {
    for (const n of ['groups', 'areas', 'offers', 'blocks']) expect(LIST_DEFS[n as keyof typeof LIST_DEFS].label.length).toBeGreaterThan(3);
    expect(validateList('areas', [{ name: 'Kakkanad' }]).ok).toBe(true);
    expect(validateList('nonsense' as never, []).ok).toBe(false);
  });

  it('refuse missing names, markup and over-long text', () => {
    expect(validateList('areas', [{ name: '' }]).ok).toBe(false);
    expect(validateList('offers', [{ detail: 'no title' }]).ok).toBe(false);
    expect(validateList('groups', [{ name: '<b>x</b>' }]).ok).toBe(false);
    expect(validateList('offers', [{ title: 'x'.repeat(81) }]).ok).toBe(false);
    expect(validateList('groups', [{ name: 'Taps', extra: 'x' }]).ok).toBe(false);
  });

  it('a block needs a lower-case key that is unique in the list', () => {
    expect(validateList('blocks', [{ key: 'Price List', title: 'Prices' }]).ok).toBe(false);
    expect(validateList('blocks', [{ key: 'prices', title: 'A' }, { key: 'prices', title: 'B' }]).ok).toBe(false);
    expect(validateList('blocks', [{ key: 'prices', title: 'A' }, { key: 'areas', title: 'B' }]).ok).toBe(true);
  });

  it('reach the site content in the shape the themes read', () => {
    let d = emptyDoc();
    d = put(d, 'groups', [{ name: 'Taps and pipes' }, { name: 'Bathrooms' }]);
    d = put(d, 'areas', [{ name: 'Kakkanad' }, { name: 'Aluva' }]);
    d = put(d, 'offers', [{ title: 'Free visit', detail: 'First visit in Aluva' }, { title: 'Weekend rate' }]);
    d = put(d, 'blocks', [{ key: 'price-list', title: 'Price list', entries: 'Tap repair | 300 | per tap\nPipe fitting | 450\n\n | no title' }]);
    const c = content(d);
    expect(c.groups).toEqual([{ id: 'taps-and-pipes', name: 'Taps and pipes' }, { id: 'bathrooms', name: 'Bathrooms' }]);
    expect(c.areas.map((a) => a.name)).toEqual(['Kakkanad', 'Aluva']);
    expect(c.offers).toEqual([{ title: 'Free visit', detail: 'First visit in Aluva' }, { title: 'Weekend rate', detail: '' }]);
    expect(c.blocks).toEqual([{ key: 'price-list', title: 'Price list', items: [{ title: 'Tap repair', price: '300', detail: 'per tap' }, { title: 'Pipe fitting', price: '450', detail: '' }] }]);
  });

  it('are empty arrays when nothing was written (as before)', () => {
    const c = content(emptyDoc());
    expect(c.groups).toEqual([]); expect(c.areas).toEqual([]); expect(c.offers).toEqual([]); expect(c.blocks).toEqual([]);
  });

  it('block entries: at most 40 lines, a line without a title is dropped', () => {
    expect(blockEntries(Array.from({ length: 60 }, (_, i) => `Item ${i}`).join('\n'))).toHaveLength(40);
    expect(blockEntries('| 5 | x\nReal | 9')).toEqual([{ title: 'Real', price: '9', detail: '' }]);
    expect(blockEntries(undefined)).toEqual([]);
  });

  it('a service area now satisfies the indexing check on its own (the content has areas)', () => {
    expect(content(put(emptyDoc(), 'areas', [{ name: 'Aluva' }])).areas).toHaveLength(1);
  });
});
