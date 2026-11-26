import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ContentPackService } from '../src/v3-content-pack/content-pack.service';
import { emptyDoc, ManagedDoc, writeField, writeList } from '../src/v3-website/core/managed-doc';
import { samplePack } from './support/e5-pack-fixture';

/** E5: the importer service with fake twins of the database and the Website manager. */
const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };
type Row = { id: string; name: string; customFields?: Record<string, unknown>; price?: string | null; description?: string | null; category?: string | null };

function make(o: { cms?: Record<string, unknown> | null; products?: Row[]; vendor?: Record<string, unknown> | null; failList?: string } = {}) {
  const state = { doc: emptyDoc() as ManagedDoc, products: [...(o.products ?? [])], n: 0, saves: [] as string[] };
  const prisma = {
    vendor: { findUnique: async () => (o.vendor === null ? null : { businessName: 'Sri Builders', name: 'Ravi', phone: '+919800000000', industry: 'mason-contractor', ...(o.vendor ?? {}) }) },
    vendorCMS: { findUnique: async () => (o.cms === undefined ? { about: '', tagline: '', address: '12 Market Road, Aluva 683101', extras: {} } : o.cms) },
    vendorProduct: {
      findMany: async () => state.products.map((p) => ({ name: p.name })),
      create: async ({ data }: { data: Row }) => { const row = { ...data, id: `prod-${++state.n}` }; state.products.push(row); return { id: row.id }; },
    },
  };
  const web = {
    draftAndLive: async () => ({ draft: state.doc, live: emptyDoc(), hasCurrent: false }),
    save: async (_v: string, _a: unknown, c: { kind: string; key?: string; value?: unknown; name?: string; items?: unknown; pageKey?: string; edit?: unknown }) => {
      if (c.kind === 'list' && c.name === o.failList) throw Object.assign(new Error('limit'), { getResponse: () => ({ message: 'Your plan allows fewer rows here.' }) });
      if (c.kind === 'field') { const r = writeField(state.doc, c.key!, c.value); if (!r.ok) throw new Error(r.message); state.doc = r.doc; }
      else if (c.kind === 'list') { const r = writeList(state.doc, c.name as never, c.items); if (!r.ok) throw new Error(r.message); state.doc = r.doc; }
      else if (c.kind === 'seo') state.doc = { ...state.doc, seo: { ...state.doc.seo, [c.pageKey!]: c.edit as never } };
      state.saves.push(`${c.kind}:${c.key ?? c.name ?? c.pageKey}`);
      return {};
    },
  };
  return { svc: new ContentPackService(prisma as never, web as never), state };
}

describe('the content pack import service', () => {
  it('writes the fields, lists, search text, services and the item page details; services are starter items with a hidden indicative price', async () => {
    const { svc, state } = make();
    const r = await svc.import('vendor-1', samplePack(), STAFF);
    expect(r.dryRun).toBe(false);
    expect(r.wrote.fields.sort()).toEqual(['about.text', 'cta.label', 'hero.subtitle', 'hero.title']);
    expect(r.wrote.lists.sort()).toEqual(['areas', 'blocks', 'credentials', 'faqs', 'groups', 'itemDetails', 'steps', 'team', 'trust']);
    expect(r.wrote.seoHome).toBe(true); expect(r.wrote.itemsCreated).toEqual(['Villas', 'Plots']);
    expect(r.skipped).toEqual([]);
    const [villas, plots] = state.products;
    expect(villas).toMatchObject({ name: 'Villas', price: 'From ₹4500000 per villa', category: 'Homes', customFields: { sample: 'true', samplePrice: 'true', importedFrom: 'content-pack:builder-developer', packSlug: 'villas' } });
    expect(plots.customFields).toEqual({ sample: 'true', importedFrom: 'content-pack:builder-developer', packSlug: 'plots' });   // no price, so no hidden price mark
    expect(plots.price).toBeNull();
    const rows = state.doc.lists.itemDetails ?? [];
    expect(rows.map((x) => x.itemId)).toEqual([villas.id, plots.id]);
    expect(String(rows[0].details)).toContain('Bedrooms: 3 or 4');
    expect(state.doc.seo.home?.seoTitle).toContain('Sri Builders');
    expect(state.doc.fields['about.text']).toContain('Sri Builders');
  });

  it('a dry run writes nothing and reports what would be written', async () => {
    const { svc, state } = make();
    const r = await svc.import('vendor-1', samplePack(), STAFF, { dryRun: true });
    expect(r.dryRun).toBe(true); expect(r.wrote.itemsCreated).toEqual(['Villas', 'Plots']); expect(r.wrote.fields.length).toBe(4);
    expect(state.products).toHaveLength(0); expect(state.saves).toEqual([]);
  });

  it('a second import changes nothing and says why', async () => {
    const { svc, state } = make();
    await svc.import('vendor-1', samplePack(), STAFF);
    const saves = state.saves.length; const products = state.products.length;
    const again = await svc.import('vendor-1', samplePack(), STAFF);
    expect(again.wrote).toEqual({ fields: [], lists: [], seoHome: false, itemsCreated: [] });
    expect(again.skipped.length).toBeGreaterThan(8);
    expect(state.saves.length).toBe(saves); expect(state.products.length).toBe(products);
  });

  it("the vendor's own older text is kept, a starter text is replaced", async () => {
    const own = make({ cms: { about: 'Our family story', tagline: '', address: '', extras: { headline: 'Real headline', faq: [{ q: 'q', a: 'a' }] } } });
    const a = await own.svc.import('vendor-1', samplePack(), STAFF);
    expect(a.wrote.fields).not.toContain('about.text'); expect(a.wrote.fields).not.toContain('hero.title'); expect(a.wrote.lists).not.toContain('faqs');
    expect(a.skipped.map((s) => s.what)).toEqual(expect.arrayContaining(['about.text', 'hero.title', 'list faqs']));
    const starter = make({ cms: { about: 'Starter about text', tagline: '', address: '', extras: { headline: 'Starter headline', sample: { about: true, headline: true } } } });
    const b = await starter.svc.import('vendor-1', samplePack(), STAFF);
    expect(b.wrote.fields).toEqual(expect.arrayContaining(['about.text', 'hero.title']));
  });

  it('a service the business already has (same name) is not added twice', async () => {
    const { svc, state } = make({ products: [{ id: 'old', name: 'villas' }] });
    const r = await svc.import('vendor-1', samplePack(), STAFF);
    expect(r.wrote.itemsCreated).toEqual(['Plots']); expect(state.products.map((p) => p.name)).toEqual(['villas', 'Plots']);
  });

  it('a refused write is reported, never thrown, and the others still go through', async () => {
    const { svc } = make({ failList: 'faqs' });
    const r = await svc.import('vendor-1', samplePack(), STAFF);
    expect(r.wrote.lists).not.toContain('faqs'); expect(r.wrote.lists).toContain('trust');
    expect(r.skipped).toEqual(expect.arrayContaining([{ what: 'list faqs', reason: 'Your plan allows fewer rows here.' }]));
  });

  it('an invalid pack is a 422 with every problem named; an unknown business is a 404', async () => {
    const { svc } = make();
    await expect(svc.import('vendor-1', { schema: 'wrong' }, STAFF)).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(svc.import('vendor-1', samplePack({ about: { title: 'A', text: ['bad {{x}}'] } }), STAFF)).rejects.toMatchObject({ response: { code: 'CONTENT_PACK_INVALID' } });
    const none = make({ vendor: null });
    await expect(none.svc.import('ghost', samplePack(), STAFF)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('the wording variant follows the vendor id: the same business always gets the same words, other businesses usually differ', async () => {
    const heroOf = async (id: string): Promise<string> => { const { svc, state } = make(); await svc.import(id, samplePack(), STAFF); return state.doc.fields['hero.title']; };
    expect(await heroOf('vendor-7')).toBe(await heroOf('vendor-7'));
    const set = new Set<string>(); for (const id of ['v-1', 'v-2', 'v-3', 'v-4', 'v-5', 'v-6']) set.add(await heroOf(id));
    expect(set.size).toBeGreaterThan(1);
  });
});
