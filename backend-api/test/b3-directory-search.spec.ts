import { asPincode, categoriesForToken, toPrefixTsQuery, tsWord, categoryTerms, likePrefix, nameRank, parseSuggestTypes, resolvePlaceText } from '../src/directory/core/search';
import { directoryWorld, DirectoryWorld } from './support/directory-world';

/** B3.5: what a text search matches (G49), suggestions (G50), typed place text (G51), the business id on results (G53). Near-me and open-now are not built. */
let w: DirectoryWorld;
beforeEach(async () => { w = await directoryWorld(); });
const names = async (q: object) => (await w.read.list(q)).items.map((i) => i.name);

describe('pure rules', () => {
  const cats = [
    categoryTerms({ id: 'c1', name: 'Plumber', slug: 'plumber', ancestors: ['Home services'], keywords: { singular: 'plumber', plural: 'plumbers', synonyms: ['pipe repair', 'tap fitter'], specialisations: ['Bathroom fitting'] } }),
    categoryTerms({ id: 'c2', name: 'Dentist', slug: 'dentist', ancestors: ['Healthcare'], keywords: null }),
  ];
  it('a word matches a category by its name, its parent, its plural, a synonym or a specialisation (prefix, two letters at least)', () => {
    expect(categoriesForToken('plumb', cats)).toEqual(['c1']); expect(categoriesForToken('plumbers', cats)).toEqual(['c1']); expect(categoriesForToken('pipe', cats)).toEqual(['c1']);
    expect(categoriesForToken('bathroom', cats)).toEqual(['c1']); expect(categoriesForToken('home', cats)).toEqual(['c1']); expect(categoriesForToken('health', cats)).toEqual(['c2']);
    expect(categoriesForToken('p', cats)).toEqual([]); expect(categoriesForToken('zzz', cats)).toEqual([]);
  });
  const places = [
    { id: 'tn', parentId: null, name: 'Tamil Nadu', slug: 'tamil-nadu' }, { id: 'd', parentId: 'tn', name: 'Chennai', slug: 'chennai' }, { id: 'ci', parentId: 'd', name: 'Chennai', slug: 'chennai' },
    { id: 'ad', parentId: 'ci', name: 'Adyar', slug: 'adyar' }, { id: 'ad2', parentId: 'm', name: 'Adyar', slug: 'adyar' }, { id: 'm', parentId: 'tn', name: 'Mangalore Road', slug: 'mangalore-road' },
  ];
  it('typed place text: a name, "Locality, City", a partial word; an exact name wins; nothing is invented for text that matches no place', () => {
    expect(resolvePlaceText(places, 'adyar chennai').map((p) => p.id)).toEqual(['ad']);
    expect(resolvePlaceText(places, 'Adyar').map((p) => p.id).sort()).toEqual(['ad', 'ad2']);
    expect(resolvePlaceText(places, 'Adyar, Chennai').map((p) => p.id)).toEqual(['ad']);
    expect(resolvePlaceText(places, 'adya').map((p) => p.id).sort()).toEqual(['ad', 'ad2']);
    expect(resolvePlaceText(places, 'Chennai').map((p) => p.id).sort()).toEqual(['ci', 'd']);
    expect(resolvePlaceText(places, 'near the airport')).toEqual([]); expect(resolvePlaceText(places, '')).toEqual([]);
  });
  it('a typed word reaches a tsquery as letters and digits only, and a word with none left is dropped (a bare ":*" is a database error)', () => {
    expect(tsWord('plumber')).toBe('plumber'); expect(tsWord("o'neil")).toBe('oneil'); expect(tsWord('ça-va')).toBe('çava'); expect(tsWord('!!')).toBe(''); expect(tsWord('zzqq')).toBe('zzqq');
    expect(toPrefixTsQuery(['plumb', 'chen'])).toBe('plumb:* & chen:*');
  });
  it('a pincode is exactly six digits not starting with 0; like prefixes carry no wildcard; suggestion types default to all and ignore unknown words', () => {
    expect(asPincode('600020')).toBe('600020'); expect(asPincode(' 600020 ')).toBe('600020'); expect(asPincode('060020')).toBeNull(); expect(asPincode('6000200')).toBeNull(); expect(asPincode('chennai')).toBeNull();
    expect(likePrefix("a%b_c'd")).toBe('abcd%');
    expect(parseSuggestTypes(undefined)).toEqual(['category', 'place', 'business']); expect(parseSuggestTypes('place, business')).toEqual(['place', 'business']); expect(parseSuggestTypes('x,y')).toEqual(['category', 'place', 'business']);
    expect(nameRank('Sri Plumber Works', 'sri')).toBe(0); expect(nameRank('Sri Plumber Works', 'plum')).toBe(1); expect(nameRank('Sri Plumber Works', 'zzz')).toBeNull();
  });
});

describe('G49: what a text search matches', () => {
  it('a word that is only in the category name finds the business (the name and description do not say it)', async () => {
    await w.biz({ name: 'Alpha Works', descriptionText: 'We do good work for every home in the city.', categoryId: w.ids.dentist });
    await w.biz({ name: 'Beta Works', descriptionText: 'We do good work for every home in the city.', categoryId: w.ids.electrician });
    expect(await names({ q: 'dentist' })).toEqual(['Alpha Works']); expect(await names({ q: 'dent' })).toEqual(['Alpha Works']);
    expect(await names({ q: 'electrician' })).toEqual(['Beta Works']);
  });
  it('a family (parent) word finds every business below it', async () => {
    await w.biz({ name: 'Alpha Works', descriptionText: 'We do good work for every home in the city.', categoryId: w.ids.plumber });
    await w.biz({ name: 'Gamma Works', descriptionText: 'We do good work for every home in the city.', categoryId: w.ids.dentist });
    expect(await names({ q: 'healthcare' })).toEqual(['Gamma Works']);
  });
  it('a service name finds the business', async () => {
    const b = await w.biz({ name: 'Delta Works', descriptionText: 'We do good work for every home in the city.', categoryId: w.ids.electrician });
    await w.repo.replaceServices(b.id, [{ name: 'Geyser installation', description: '' }]);
    await w.biz({ name: 'Epsilon Works', descriptionText: 'We do good work for every home in the city.', categoryId: w.ids.electrician });
    expect(await names({ q: 'geyser' })).toEqual(['Delta Works']);
  });
  it('a staff-reviewed keyword or synonym finds the category ("pipe repair" finds the plumber)', async () => {
    w.repo.keywords = [{ categorySlug: 'plumber', singular: 'plumber', plural: 'plumbers', synonyms: ['pipe repair'], specialisations: ['bathroom fitting'] }];
    await w.biz({ name: 'Zeta Works', descriptionText: 'We do good work for every home in the city.', categoryId: w.ids.plumber });
    await w.biz({ name: 'Eta Works', descriptionText: 'We do good work for every home in the city.', categoryId: w.ids.dentist });
    expect(await names({ q: 'pipe repair' })).toEqual(['Zeta Works']); expect(await names({ q: 'bathroom' })).toEqual(['Zeta Works']);
  });
  it('every typed word must be found (somewhere), and the order of results stays organic; a hostile text matches nothing', async () => {
    await w.biz({ name: 'Theta Works', descriptionText: 'Quick help in Madurai.', categoryId: w.ids.dentist, locationId: w.ids.madurai });
    expect(await names({ q: 'dentist madurai' })).toEqual(['Theta Works']); expect(await names({ q: 'dentist chennai' })).toEqual([]);
    expect(await names({ q: "dentist'; DROP TABLE x;--" })).toEqual([]);
  });
});

describe('G51: typed place text', () => {
  it('the place may be typed ("Madurai", "madurai", "Tamil Nadu") as well as a slug path', async () => {
    await w.biz({ name: 'Alpha Plumber', locationId: w.ids.chennaiCity }); await w.biz({ name: 'Beta Plumber', locationId: w.ids.madurai });
    expect(await names({ location: 'Madurai' })).toEqual(['Beta Plumber']); expect(await names({ location: 'tamil nadu' })).toEqual(['Alpha Plumber', 'Beta Plumber']);
    expect(await names({ location: 'tamil-nadu/chennai/chennai' })).toEqual(['Alpha Plumber']);
    expect((await w.read.list({ location: 'Madurai' })).filters.location).toBe('madurai');
  });
  it('text that matches no place is said to be unknown and shows no results (never "everything")', async () => {
    await w.biz({ name: 'Alpha Plumber' });
    const r = await w.read.list({ location: 'near the airport' });
    expect(r.items).toEqual([]); expect(r.filters.locationUnknown).toBe(true);
    expect((await w.read.list({ location: 'madurai' })).filters.locationUnknown).toBeUndefined();
  });
});

describe('G53: the business id on each result', () => {
  it('every result and the detail carry the directory business id, and never the vendor id', async () => {
    const b = await w.biz({ name: 'Iota Plumber', vendorId: 'vendor-secret-9' });
    const r = await w.read.list({}); expect(r.items[0].id).toBe(b.id);
    const d = (await w.read.detail('iota-plumber')) as unknown as { business: { id: string } };
    expect(d.business.id).toBe(b.id);
    expect(JSON.stringify(r)).not.toContain('vendor-secret-9');
  });
});

describe('G50: suggestions', () => {
  it('categories (with sub categories and their parent), places and businesses, each at most eight, public data only', async () => {
    await w.biz({ name: 'Plumbline Services', status: 'CLAIMED', vendorId: 'vendor-secret-1' }); await w.biz({ name: 'Draft Plumbers', status: 'DRAFT' }); await w.biz({ name: 'Gone Plumbers', status: 'REMOVED' });
    const r = await w.read.suggest('plum', undefined, undefined);
    expect(r.categories).toEqual([{ slug: 'plumber', name: 'Plumber', kind: 'subcategory', parent: 'Home services' }]);
    expect(r.businesses.map((x) => x.name)).toEqual(['Plumbline Services']);     // a draft and a removed business are never suggested
    expect(r.businesses[0]).toMatchObject({ slug: 'plumbline-services', category: 'Plumber', city: 'Chennai' });
    expect(JSON.stringify(r)).not.toMatch(/vendor-secret|vendorId|emailMasked|phone/);
    const p = await w.read.suggest('chen', 'place', undefined);
    expect(p.categories).toEqual([]); expect(p.businesses).toEqual([]);
    expect(p.places.map((x) => x.path)).toEqual(['tamil-nadu/chennai', 'tamil-nadu/chennai/chennai']);
    expect(p.places[1]).toMatchObject({ name: 'Chennai', kind: 'CITY', label: 'Chennai, Chennai' });
  });
  it('a family word finds its family; the limit is capped at eight; one letter or nothing suggests nothing', async () => {
    const f = await w.read.suggest('home', 'category', undefined);
    expect(f.categories.map((c) => c.slug)).toEqual(['home-services', 'electrician', 'plumber']);
    for (let i = 1; i <= 12; i++) await w.biz({ name: `Alpha Shop ${String(i).padStart(2, '0')}` });
    expect((await w.read.suggest('alpha', 'business', 1000)).businesses).toHaveLength(8);
    expect((await w.read.suggest('alpha', 'business', 3)).businesses).toHaveLength(3);
    expect(await w.read.suggest('a', undefined, undefined)).toMatchObject({ categories: [], places: [], businesses: [] });
    expect(await w.read.suggest(undefined, undefined, undefined)).toMatchObject({ q: '', categories: [], places: [], businesses: [] });
  });
  it('a hostile text is only ever a normalised word list', async () => {
    const r = await w.read.suggest("x'; DROP TABLE y;--%_", undefined, undefined);
    expect(r.q).toBe('x drop table y'); expect(r.businesses).toEqual([]);
  });
});
