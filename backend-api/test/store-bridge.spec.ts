import { Catalogue, CatalogueItem, ContentCatalogue, PrismaStoreProducts, StoreFirstCatalogue, StoreProducts } from '../src/requests-orders/requests-ports';
import { priceCart } from '../src/requests-orders/core/commerce-core';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * The bridge between the store catalogue (slice 5.24c) and the Stage 9 checkout: the shop catalogue answers first for its own business, the published content items answer for every other site, and the
 * tax rate and HSN or SAC code of a product reach the order line. A fake Prisma that honours vendor, id and archived filters stands in for the database.
 */
type Row = Record<string, unknown>;
const matches = (row: Row, where: Row): boolean => Object.entries(where).every(([k, v]) => (v === null ? row[k] === null || row[k] === undefined : row[k] === v));
function fakePrisma(products: Row[], variants: Row[]): PrismaService {
  return {
    v3StoreVariant: { findFirst: async ({ where }: { where: Row }) => { const v = variants.find((x) => matches(x, where)); return v ? { ...v, product: products.find((p) => p.id === v.productId) } : null; } },
    v3StoreProduct: { findFirst: async ({ where }: { where: Row }) => { const p = products.find((x) => matches(x, where)); return p ? { ...p, variants: variants.filter((v) => v.productId === p.id && v.archivedAt === null).map((v) => ({ id: v.id })) } : null; } },
  } as unknown as PrismaService;
}
const prod = (o: Row = {}): Row => ({ id: 'p1', vendorId: 'A', name: 'Copper pipe', hsnSac: '7411', pricePaise: 25000, taxRatePercent: 18, archivedAt: null, ...o });
const vari = (o: Row = {}): Row => ({ id: 'v1', vendorId: 'A', productId: 'p2', label: 'Large', pricePaise: null, archivedAt: null, ...o });

describe('the store catalogue as the checkout sees it', () => {
  it('a product with a price, a whole-percent rate and an HSN code is offered with all three', async () => {
    const c = new PrismaStoreProducts(fakePrisma([prod()], [])); expect(await c.find('A', 'p1')).toEqual({ productRef: 'p1', name: 'Copper pipe', unitPaise: 25000, taxPercent: 18, hsnSac: '7411' });
  });
  it('a product with no rate carries 0, and one with a fractional rate is not offered', async () => {
    expect((await new PrismaStoreProducts(fakePrisma([prod({ taxRatePercent: null })], [])).find('A', 'p1'))?.taxPercent).toBe(0);
    expect(await new PrismaStoreProducts(fakePrisma([prod({ taxRatePercent: 0.25 })], [])).find('A', 'p1')).toBeNull();
  });
  it('a variant is offered under its own id, at its own price or else the product price; a product with variants is ordered through a variant only', async () => {
    const c = new PrismaStoreProducts(fakePrisma([prod({ id: 'p2' })], [vari(), vari({ id: 'v2', label: 'Small', pricePaise: 20000 })]));
    expect(await c.find('A', 'v1')).toMatchObject({ productRef: 'v1', name: 'Copper pipe Large', unitPaise: 25000 }); expect((await c.find('A', 'v2'))?.unitPaise).toBe(20000); expect(await c.find('A', 'p2')).toBeNull();
  });
  it('another business, an archived product or variant, and an unknown reference are not available', async () => {
    const c = new PrismaStoreProducts(fakePrisma([prod(), prod({ id: 'p3', archivedAt: new Date() }), prod({ id: 'p2' })], [vari({ archivedAt: new Date() })]));
    expect(await c.find('B', 'p1')).toBeNull(); expect(await c.find('A', 'p3')).toBeNull(); expect(await c.find('A', 'v1')).toBeNull(); expect(await c.find('A', 'nope')).toBeNull();
  });
});

describe('shop catalogue first, content items after', () => {
  class Shop extends StoreProducts { async find(_v: string, ref: string): Promise<CatalogueItem | null> { return ref === 'shop' ? { productRef: 'shop', name: 'Shop item', unitPaise: 100, taxPercent: 5, hsnSac: '1234' } : null; } }
  const content = { find: async (_v: string, ref: string) => (ref === 'page' ? { productRef: 'page', name: 'Page item', unitPaise: 200, taxPercent: 0 } : null) } as unknown as ContentCatalogue;
  const cat: Catalogue = new StoreFirstCatalogue(new Shop(), content);
  it('answers from the shop first, then the content, then nothing', async () => {
    expect((await cat.find('A', 'shop'))?.hsnSac).toBe('1234'); expect((await cat.find('A', 'page'))?.name).toBe('Page item'); expect(await cat.find('A', 'none')).toBeNull();
  });
  it('the HSN code and the rate reach the priced cart line the order is built from', async () => {
    const item = (await cat.find('A', 'shop'))!;
    const cart = priceCart([{ productRef: item.productRef, name: item.name, unitPaise: item.unitPaise, qty: 3, taxPercent: item.taxPercent, hsnSac: item.hsnSac }], null, new Date());
    expect(cart.lines[0]).toMatchObject({ hsnSac: '1234', taxPercent: 5, lineSubtotalPaise: 300, taxPaise: 15 }); expect(cart.totalPaise).toBe(315);
  });
});
