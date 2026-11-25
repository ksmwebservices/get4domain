import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ContentPack, CurrentContent, fillPlaceholders, pickVariant, planImport, validatePack, variantIndex, VendorFacts } from '../src/v3-content-pack/core/content-pack-core';
import { emptyDoc, writeField, writeList } from '../src/v3-website/core/managed-doc';
import { samplePack, v3 } from './support/e5-pack-fixture';

/** E5: the content pack importer, pure. */
const facts = (over: Partial<VendorFacts> = {}): VendorFacts => ({ vendorId: 'vendor-aaa', businessName: 'Sri Builders', owner: 'Ravi', town: 'Aluva', phone: '+919800000000', branches: 'Aluva, Kakkanad', ...over });
const none: CurrentContent = { fields: {}, lists: {}, seoHome: false, existingNames: [], existingDetailIds: [] };
const pack = (over: Record<string, unknown> = {}): ContentPack => { const r = validatePack(samplePack(over)); if (!r.ok) throw new Error(r.errors.join('; ')); return r.pack; };

describe('validating a pack', () => {
  it('accepts a complete pack', () => { expect(validatePack(samplePack()).ok).toBe(true); });
  it('refuses a wrong schema, a non-object and a missing type', () => {
    expect(validatePack(samplePack({ schema: 'other/1' }))).toMatchObject({ ok: false });
    expect(validatePack('x')).toMatchObject({ ok: false });
    expect(validatePack(samplePack({ type: '' }))).toMatchObject({ ok: false });
  });
  it('refuses double curly braces (the template syntax), empty variants, a duplicate slug and a price that is not marked indicative', () => {
    expect(validatePack(samplePack({ about: { title: 'A', text: ['hello {{x}} there'] } }))).toMatchObject({ ok: false });
    expect(validatePack(samplePack({ hero: { title: [], subtitle: v3('s'), bannerText: v3('b') } }))).toMatchObject({ ok: false });
    const items = (samplePack().items as Array<Record<string, unknown>>);
    expect(validatePack(samplePack({ items: [items[0], { ...items[1], slug: 'villas' }] }))).toMatchObject({ ok: false });
    expect(validatePack(samplePack({ items: [{ ...items[0], priceFrom: { amount: 5, indicative: false } }] }))).toMatchObject({ ok: false });
  });
  it('a single text is accepted where variants are allowed', () => {
    const r = validatePack(samplePack({ hero: { title: 'One title', subtitle: 'One sub', bannerText: 'One banner' } }));
    expect(r.ok && r.pack.hero.title).toEqual(['One title']);
  });
});

describe('choosing the wording variant by vendor id', () => {
  it('is stable for the same vendor and place, and different places can differ', () => {
    for (let i = 0; i < 5; i++) expect(variantIndex('v-1', 'hero.title', 3)).toBe(variantIndex('v-1', 'hero.title', 3));
    expect(pickVariant('v-1', 'a', ['x'])).toBe('x');
    expect(variantIndex('v-1', 'a', 1)).toBe(0);
  });
  it('spreads vendors over the variants so sites of the same kind do not read alike', () => {
    const counts = [0, 0, 0];
    for (let i = 0; i < 900; i++) counts[variantIndex(`vendor-${i}`, 'hero.title', 3)]++;
    for (const c of counts) expect(c).toBeGreaterThan(220);
  });
  it('two vendors usually get different wording for the same pack', () => {
    const a = planImport(pack(), facts({ vendorId: 'vendor-1' }), none); const b = planImport(pack(), facts({ vendorId: 'vendor-2' }), none);
    const f = (p: typeof a) => p.fields.map((x) => x.value).join('|');
    let differ = 0; for (let i = 1; i < 8; i++) { const x = planImport(pack(), facts({ vendorId: `vendor-${i}` }), none); if (f(x) !== f(a)) differ++; }
    expect(differ).toBeGreaterThan(2); expect(f(b).length).toBeGreaterThan(10);
  });
});

describe('placeholders', () => {
  it('are filled from the vendor facts and never left in the text', () => {
    const p = pack();
    expect(fillPlaceholders('[[vendor_name]] in [[town]], call [[phone]]', p, facts())).toBe('Sri Builders in Aluva, call +919800000000');
    expect(fillPlaceholders('Hello [[owner]] [[nonsense]] there', p, facts({ owner: '' }))).toBe('Hello our team there');
    expect(fillPlaceholders('Visit [[town]] and [[area]]', p, facts({ town: '' }))).toBe('Visit your town and your area');
    const plan = planImport(p, facts({ town: '', owner: '', phone: '', branches: '' }), none);
    expect(JSON.stringify(plan)).not.toContain('[[');
  });
});

describe('planning the import', () => {
  it('into an empty business: fields, lists, search text and every service are planned', () => {
    const plan = planImport(pack(), facts(), none);
    expect(plan.fields.map((x) => x.key).sort()).toEqual(['about.text', 'cta.label', 'hero.subtitle', 'hero.title']);
    expect(plan.lists.map((l) => l.name).sort()).toEqual(['areas', 'blocks', 'credentials', 'faqs', 'groups', 'steps', 'team', 'trust']);
    expect(plan.seoHome?.seoTitle).toContain('Sri Builders'); expect(plan.items.map((i) => i.name)).toEqual(['Villas', 'Plots']);
    expect(plan.skipped).toEqual([]);
    expect(plan.lists.find((l) => l.name === 'groups')?.items).toEqual([{ name: 'Homes' }, { name: 'Plots in Aluva' }]);
    expect(plan.lists.find((l) => l.name === 'areas')?.items[0]).toEqual({ name: 'Aluva' });
    expect(plan.lists.find((l) => l.name === 'blocks')?.items[0]).toMatchObject({ key: 'price-list', entries: 'Villa | from 45 lakh | per unit\nPlot | on request | per cent' });
    expect(plan.items[0]).toMatchObject({ group: 'Homes', priceFrom: { amount: 4500000 } });
    expect(plan.items[0].detail.details).toContain('Bedrooms: 3 or 4'); expect(plan.items[0].detail.details).toContain('- Own parking');
    expect(plan.items[0].detail.faqs).toMatch(/^Is parking included\? \| Yes, parking is included \((one|two|three)\)$/);
    expect(plan.items[1].priceFrom).toBeNull();
  });

  it('never overwrites what the vendor has: text, rows, a service of the same name, home page search text', () => {
    const cur: CurrentContent = { fields: { 'hero.title': 'My own headline', 'about.text': 'My story' }, lists: { faqs: [{ q: 'q', a: 'a' }], groups: [{ name: 'Mine' }] }, seoHome: true, existingNames: ['villas'], existingDetailIds: [] };
    const plan = planImport(pack(), facts(), cur);
    expect(plan.fields.map((x) => x.key).sort()).toEqual(['cta.label', 'hero.subtitle']);
    expect(plan.lists.map((l) => l.name)).not.toEqual(expect.arrayContaining(['faqs', 'groups']));
    expect(plan.seoHome).toBeNull();
    expect(plan.items.map((i) => i.name)).toEqual(['Plots']);
    const why = plan.skipped.map((s) => s.what);
    expect(why).toEqual(expect.arrayContaining(['hero.title', 'about.text', 'list faqs', 'list groups', 'home page search text', 'service Villas']));
  });

  it('running it again after applying the plan plans nothing new (idempotent)', () => {
    const first = planImport(pack(), facts(), none);
    const after: CurrentContent = {
      fields: Object.fromEntries(first.fields.map((f) => [f.key, f.value])), lists: Object.fromEntries(first.lists.map((l) => [l.name, l.items])), seoHome: first.seoHome !== null,
      existingNames: first.items.map((i) => i.name), existingDetailIds: [],
    };
    const second = planImport(pack(), facts(), after);
    expect(second.fields).toEqual([]); expect(second.lists).toEqual([]); expect(second.items).toEqual([]); expect(second.seoHome).toBeNull();
  });

  it('every planned write passes the same rules a vendor typing it would meet', () => {
    const plan = planImport(pack(), facts(), none);
    let doc = emptyDoc();
    for (const f of plan.fields) { const r = writeField(doc, f.key, f.value); expect(r.ok).toBe(true); if (r.ok) doc = r.doc; }
    for (const l of plan.lists) { const r = writeList(doc, l.name, l.items); expect(r.ok).toBe(true); if (r.ok) doc = r.doc; }
    const rows = plan.items.map((i, n) => ({ itemId: `id-${n}`, summary: i.detail.summary, details: i.detail.details, faqs: i.detail.faqs }));
    expect(writeList(doc, 'itemDetails', rows).ok).toBe(true);
  });

  it('a pack text over its limit is refused outright; a text that only becomes too long once filled in is skipped with the reason, not cut', () => {
    expect(validatePack(samplePack({ hero: { title: ['x'.repeat(121)], subtitle: v3('ok'), bannerText: v3('b') } }))).toMatchObject({ ok: false });
    const p = pack({ hero: { title: [`[[vendor_name]] ${'y'.repeat(100)}`], subtitle: v3('ok'), bannerText: v3('b') } });
    const plan = planImport(p, facts({ businessName: 'N'.repeat(60) }), none);
    expect(plan.fields.map((f) => f.key)).not.toContain('hero.title');
    expect(plan.skipped.find((s) => s.what === 'hero.title')?.reason).toMatch(/longer than 120/);
  });
});

describe('the real packs of the theme factory (only where the folder exists on this machine)', () => {
  const root = 'C:\\Get4Domain\\get4domain-themes-factory\\packs';
  const files: string[] = [];
  if (existsSync(root)) for (const fam of readdirSync(root)) { const fp = join(root, fam); try { for (const t of readdirSync(fp)) { const f = join(fp, t, 'content.json'); if (existsSync(f)) files.push(f); } } catch { /* a file, not a folder */ } }
  (files.length ? it : it.skip)('every content.json there is a valid pack and plans cleanly into an empty business', () => {
    const bad: string[] = [];
    for (const f of files) {
      const r = validatePack(JSON.parse(readFileSync(f, 'utf8')));
      if (!r.ok) { bad.push(`${f}: ${r.errors.slice(0, 2).join('; ')}`); continue; }
      const plan = planImport(r.pack, facts(), none);
      if (JSON.stringify(plan).includes('[[')) bad.push(`${f}: placeholder left`);
    }
    expect(bad).toEqual([]);
  });
});
