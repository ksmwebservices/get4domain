import { toRendererInput } from '../src/site-publish/content/content-adapter';
import { SourceDocument } from '../src/site-publish/content/content-types';
import { applyToSource, emptyDoc, ManagedDoc, validateList, writeList } from '../src/v3-website/core/managed-doc';
import { parseFaqLines, parseImageLines } from '../src/v3-website/core/item-detail-core';

/** Website Manager lane A, item f: each item can have its own landing page details (title, summary, details, price, pictures, questions, status, area). */
const source = (): SourceDocument => ({
  vendor: { id: 'va', subdomain: 'va', businessName: 'Shop va', name: 'Owner', phone: '+919800000000', email: 'o@example.test', status: 'ACTIVE', industry: 'plumber' },
  cms: {
    businessName: 'Shop va', tagline: 't', about: 'a', logo: null, banner: null, favicon: null, phone: '+919800000000', email: 'o@example.test', address: '1 Main Road, Madurai 625001', businessHours: null,
    whatsapp: null, facebook: null, instagram: null, linkedin: null, youtube: null, googleMaps: null, portfolio: null, testimonials: null, pages: null, extras: null, packKey: 'plumber',
    siteStatus: 'DRAFT', ogImage: null, seoTitle: null, seoDesc: null,
  },
  items: [
    { id: 'item-one-0001', name: 'Villa project', description: 'Legacy text', price: '5000000', image: null, category: null, active: true, sample: false, samplePrice: false },
    { id: 'item-two-0002', name: 'Tap repair', description: 'Fix taps', price: '300', image: null, category: null, active: true, sample: false, samplePrice: false },
  ],
  claimed: true,
});
const put = (d: ManagedDoc, items: unknown): ManagedDoc => { const r = writeList(d, 'itemDetails', items); if (!r.ok) throw new Error(`${r.code} ${r.message}`); return r.doc; };
type Item = Record<string, unknown>;
const items = (d: ManagedDoc): Item[] => (toRendererInput(applyToSource(source(), d), { categoryId: 'plumber', lang: 'en', year: 2026, siteBase: 'g4d.test' }).content as { items: Item[] }).items;

describe('item details', () => {
  it('pictures: one per line, https only, each with a description, at most twelve', () => {
    expect(parseImageLines('https://img.example.test/a.jpg | Front view\nhttps://img.example.test/b.jpg | Garden')).toMatchObject({ ok: true, rows: [{ src: 'https://img.example.test/a.jpg', alt: 'Front view' }, { alt: 'Garden' }] });
    expect(parseImageLines('http://img.example.test/a.jpg | x').ok).toBe(false);
    expect(parseImageLines('https://img.example.test/a.jpg').ok).toBe(false);
    expect(parseImageLines('javascript:alert(1) | x').ok).toBe(false);
    expect(parseImageLines(Array.from({ length: 13 }, (_, i) => `https://img.example.test/${i}.jpg | p${i}`).join('\n')).ok).toBe(false);
    expect(parseImageLines('')).toEqual({ ok: true, rows: [] });
  });

  it('questions: question | answer per line, at most ten', () => {
    expect(parseFaqLines('How long? | About six weeks\nCost? | On request | per site')).toMatchObject({ ok: true, rows: [{ q: 'How long?', a: 'About six weeks' }, { q: 'Cost?', a: 'On request | per site' }] });
    expect(parseFaqLines('No answer here').ok).toBe(false);
    expect(parseFaqLines(Array.from({ length: 11 }, (_, i) => `q${i} | a${i}`).join('\n')).ok).toBe(false);
  });

  it('the row is checked: item id needed, status one of ongoing, upcoming, completed, one row per item', () => {
    expect(validateList('itemDetails', [{ summary: 'x' }]).ok).toBe(false);
    expect(validateList('itemDetails', [{ itemId: 'a', status: 'finished' }]).ok).toBe(false);
    for (const s of ['ongoing', 'upcoming', 'completed', '']) expect(validateList('itemDetails', [{ itemId: 'a', status: s }]).ok).toBe(true);
    expect(validateList('itemDetails', [{ itemId: 'a' }, { itemId: 'a' }]).ok).toBe(false);
    expect(validateList('itemDetails', [{ itemId: 'a', images: 'not a link | x' }]).ok).toBe(false);
    expect(validateList('itemDetails', [{ itemId: 'a', details: '<script>' }]).ok).toBe(false);
  });

  it('the details reach only the item they belong to: title, summary, details, price, pictures, questions, status and area', () => {
    const d = put(emptyDoc(), [{
      itemId: 'item-one-0001', title: 'Villa project, Aluva', summary: 'A four-bedroom villa', details: 'Built in 2025.\nHandover in March.', price: 'from 50 lakh',
      images: 'https://img.example.test/a.jpg | Front view', faqs: 'Is parking included? | Yes, two cars', status: 'ongoing', area: 'Aluva',
    }]);
    const [one, two] = items(d);
    expect(one).toMatchObject({
      name: 'Villa project, Aluva', description: 'A four-bedroom villa', summary: 'A four-bedroom villa', details: 'Built in 2025.\nHandover in March.', price: 'from 50 lakh', status: 'ongoing', area: 'Aluva',
      gallery: [{ src: 'https://img.example.test/a.jpg', alt: 'Front view' }], faqs: [{ q: 'Is parking included?', a: 'Yes, two cars' }],
    });
    expect(String(one.slug)).toMatch(/^villa-project-/);   // the web address does not change when the title is edited
    expect(two).toMatchObject({ name: 'Tap repair', description: 'Fix taps', price: '300', summary: '', details: '', status: '', area: '', gallery: [], faqs: [] });
  });

  it('with no details written, an item is as before', () => {
    const [one] = items(emptyDoc());
    expect(one).toMatchObject({ name: 'Villa project', description: 'Legacy text', price: '5000000', gallery: [], faqs: [] });
  });

  it('a row for an item that no longer exists is ignored', () => {
    expect(items(put(emptyDoc(), [{ itemId: 'gone', title: 'x' }])).map((i) => i.name)).toEqual(['Villa project', 'Tap repair']);
  });
});
