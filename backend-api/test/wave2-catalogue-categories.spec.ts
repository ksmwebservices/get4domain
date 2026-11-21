import * as fs from 'fs';
import * as path from 'path';
import { CATALOGUE_CATEGORIES } from '../src/directory/core/catalogue-categories';
import { catalogueCategory, familySlug, isListableCategory, KIT_ONLY_PACK, kitCategoryFor, listableCategories, PACK_KIT_FALLBACK } from '../src/directory/core/listable-categories';
import { CatalogueCategoryRow, CatalogueCategoryStore, familyLabel, loadCatalogueCategories } from '../src/directory/seed/catalogue-category-loader';
import { parseCsv } from '../src/v3-packs/core/pack-core';
import { validateSeedRow } from '../src/seeded-sites/core/seeded';
import { SeededSitesService } from '../src/seeded-sites/seeded-sites.service';
import { categoryFor } from '../src/site-publish/content/content-adapter';
import { loadKit } from '../src/site-publish/renderer/renderer-loader';
import { row } from './support/seeded-world';

/** Wave 2 job K1: every one of the 196 catalogue categories is listable, the directory rows are made by an idempotent loader, and a listing in a category the kit has no design for still gets a site. */
jest.setTimeout(120_000);
const kit = loadKit(); const kitIds = kit.CATEGORIES.map((c) => c.id); const kitHas = (id: string): boolean => kit.hasCategory(id);

describe('the catalogue constant', () => {
  it('is exactly the sheet: 196 unique categories with id, name, family and primary pack (regenerate with scripts/gen-catalogue-categories.js after a sheet change)', () => {
    const sheet = parseCsv(fs.readFileSync(path.resolve(__dirname, '..', 'prisma/seed/pack-engine/CATEGORY_MASTER_V3_ADMIN_REGISTRATION.csv'), 'utf8')).filter((r) => r.id && r.id.trim());
    expect(CATALOGUE_CATEGORIES).toEqual(sheet.map((r) => ({ id: r.id.trim(), name: r.name.trim(), family: r.family.trim(), pack: r.primary_pack.trim() })));
    expect(CATALOGUE_CATEGORIES).toHaveLength(196); expect(new Set(CATALOGUE_CATEGORIES.map((c) => c.id)).size).toBe(196);
    for (const c of CATALOGUE_CATEGORIES) { expect(c.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/); expect(c.name && c.family && c.pack).toBeTruthy(); }
  });
});

describe('why only 37 passed, and what passes now', () => {
  it('the theme kit has 41 categories and only 37 are in the catalogue; the check used to be the kit alone', () => {
    expect(kitIds).toHaveLength(41); expect(CATALOGUE_CATEGORIES.filter((c) => kitHas(c.id))).toHaveLength(37);
    expect(kitIds.filter((k) => !catalogueCategory(k)).sort()).toEqual(['auto-mechanic', 'gym-yoga', 'salon-spa', 'tutor']);
  });
  it('every one of the 196 catalogue categories is listable, and so is every kit category (the four the sheet does not name keep working)', () => {
    for (const c of CATALOGUE_CATEGORIES) expect([c.id, isListableCategory(c.id, kitHas)]).toEqual([c.id, true]);
    for (const k of kitIds) expect([k, isListableCategory(k, kitHas)]).toEqual([k, true]);
  });
  it('anything else is not: unknown, empty, upper case, a family name, odd types', () => {
    for (const v of ['nope', '', 'Plumber', 'home-services', ' plumber', 'plumber ', 5, null, undefined, {}]) expect([String(v), isListableCategory(v, kitHas)]).toEqual([String(v), false]);
  });
  it('the real row check of a seeded listing accepts each of the 196 (and still refuses an unknown one with the same words)', () => {
    for (const c of CATALOGUE_CATEGORIES) { const v = validateSeedRow(row({ category: c.id }), { categoryExists: (id) => isListableCategory(id, kitHas) }); expect([c.id, v.ok]).toEqual([c.id, true]); }
    const bad = validateSeedRow(row({ category: 'not-a-category' }), { categoryExists: (id) => isListableCategory(id, kitHas) }); expect(bad.ok).toBe(false);
  });
});

describe('the site of a listing in a category the kit has no design for', () => {
  it('every catalogue category resolves to a real kit category: its own when the kit has one, else the kit category of its pack', () => {
    for (const c of CATALOGUE_CATEGORIES) { const k = kitCategoryFor(c.id, kitHas); expect([c.id, k !== null && kitHas(k)]).toEqual([c.id, true]); if (kitHas(c.id)) expect(k).toBe(c.id); else expect(k).toBe(PACK_KIT_FALLBACK[c.pack]); }
    expect(kitCategoryFor('nope', kitHas)).toBeNull();
  });
  it('the fallback table names a real kit category for every pack the catalogue uses, and for no pack the catalogue does not use', () => {
    const packs = new Set(CATALOGUE_CATEGORIES.map((c) => c.pack));
    for (const p of packs) expect([p, kitHas(PACK_KIT_FALLBACK[p])]).toEqual([p, true]);
    expect(Object.keys(PACK_KIT_FALLBACK).sort()).toEqual([...packs].sort());
    for (const [k, p] of Object.entries(KIT_ONLY_PACK)) { expect(kitHas(k)).toBe(true); expect(packs.has(p)).toBe(true); }
  });
  it('the site build finds a kit category for a vendor whose industry is any of the 196 (before, 159 of them answered "no category yet" and blocked publishing)', () => {
    const doc = (industry: string) => ({ vendor: { industry }, cms: null }) as never; const map = kit.categoryMap();
    for (const c of CATALOGUE_CATEGORIES) { const k = categoryFor(doc(c.id), kit, map); expect([c.id, k !== null && kitHas(k)]).toEqual([c.id, true]); }
    expect(categoryFor(doc('nope'), kit, map)).toBeNull();
  });
  it('the track of the page (shop, handyman, professional) follows the fallback: a B2B dealer is not a shop', () => {
    expect(kit.categoryById(kitCategoryFor('chemical-products-supplier', kitHas)!).track).toBe('professional'); expect(kit.categoryById(kitCategoryFor('audio-equipment-store', kitHas)!).track).toBe('ecommerce');
    expect(kit.categoryById(kitCategoryFor('plumber', kitHas)!).track).toBe('handyman');
  });
});

describe('listableCategories (the route body)', () => {
  const list = listableCategories(kit.CATEGORIES.map((c) => ({ id: c.id, label: c.label, family: c.family })));
  it('is the 196 of the catalogue in the sheet order with pack and family, then the four kit categories the sheet does not name', () => {
    expect(list).toHaveLength(200); expect(list.slice(0, 196).map((c) => c.key)).toEqual(CATALOGUE_CATEGORIES.map((c) => c.id)); expect(list.slice(196).map((c) => c.key).sort()).toEqual(['auto-mechanic', 'gym-yoga', 'salon-spa', 'tutor']);
    for (const c of list) { expect(c.name && c.family && c.pack && c.kitCategory).toBeTruthy(); expect(['CATALOGUE', 'KIT']).toContain(c.source); }
    expect(new Set(list.map((c) => c.key)).size).toBe(200);
  });
  it('says which categories have a design of their own', () => { expect(list.filter((c) => c.hasOwnDesign)).toHaveLength(41); expect(list.find((c) => c.key === 'wholesale-trader')).toMatchObject({ pack: 'B2B_DEALER', hasOwnDesign: false, kitCategory: 'it-consultant' }); });
  it('and carries nothing private or priced', () => { expect(JSON.stringify(list)).not.toMatch(/₹|paise|price|email|phone/i); });
});

describe('family names', () => {
  it('slug and label drop the note in brackets, so the two B2B families of the sheet are one and Healthcare matches the kit family', () => {
    expect(familySlug('Healthcare (disclaimer)')).toBe('healthcare'); expect(familyLabel('Healthcare (disclaimer)')).toBe('Healthcare');
    expect(familySlug('B2B suppliers and manufacturers (enquiry only)')).toBe(familySlug('B2B suppliers and manufacturers (optional family, enquiry only)'));
    expect(familySlug('Hardware, building and auto parts')).toBe('hardware-building-and-auto-parts'); expect(familySlug('Legal and finance (disclaimer)')).toBe('legal-and-finance');
    const slugs = new Set(CATALOGUE_CATEGORIES.map((c) => familySlug(c.family))); expect(slugs.size).toBe(20); for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

/** An in-memory directory category table with the same unique key as the real one (parent and slug) and no way to update or delete: the loader can only create. */
class MemoryCategories implements CatalogueCategoryStore {
  rows: Array<CatalogueCategoryRow & { proposed: boolean; themeCategoryId: string | null; family: string | null; sortOrder: number }> = []; creates = 0; private n = 0;
  async listCategories(): Promise<CatalogueCategoryRow[]> { return this.rows.map((r) => ({ id: r.id, slug: r.slug, parentId: r.parentId, name: r.name })); }
  async createCategory(d: { parentId: string | null; name: string; slug: string; themeCategoryId: string | null; family: string | null; sortOrder: number }): Promise<string> {
    if (this.rows.some((r) => r.parentId === d.parentId && r.slug === d.slug)) throw new Error('unique (parent, slug)');
    const id = `c${++this.n}`; this.rows.push({ id, ...d, proposed: true }); this.creates++; return id;
  }
  /** the 41 rows the theme kit seed made: twelve families, then each kit category under its family with slug = theme id */
  seedKit(): void { const fam = new Map<string, string>(); for (const c of kit.CATEGORIES) { if (!fam.has(c.family)) { fam.set(c.family, `f${fam.size}`); this.rows.push({ id: fam.get(c.family)!, slug: c.family, parentId: null, name: c.family, proposed: false, themeCategoryId: null, family: c.family, sortOrder: 0 }); } this.rows.push({ id: `k-${c.id}`, slug: c.id, parentId: fam.get(c.family)!, name: c.label, proposed: false, themeCategoryId: c.id, family: c.family, sortOrder: 0 }); } }
}

describe('the loader', () => {
  it('a dry run counts what it would create and writes nothing', async () => {
    const s = new MemoryCategories(); s.seedKit(); const before = s.rows.length;
    const r = await loadCatalogueCategories(s, CATALOGUE_CATEGORIES, { apply: false, kitIds });
    expect(r.categories).toEqual({ total: 196, created: 159, existing: 37 }); expect(r.createdKeys).toHaveLength(159); expect(s.creates).toBe(0); expect(s.rows).toHaveLength(before);
  });
  it('an apply creates the 159 missing categories under their families, marked proposed, with the catalogue key as slug and no theme kit link', async () => {
    const s = new MemoryCategories(); s.seedKit();
    const r = await loadCatalogueCategories(s, CATALOGUE_CATEGORIES, { apply: true, kitIds });
    expect(r.categories.created).toBe(159); expect(r.families.created + r.families.existing).toBe(r.families.total);
    const leaves = s.rows.filter((x) => x.parentId !== null); const slugs = new Set(leaves.map((x) => x.slug));
    for (const c of CATALOGUE_CATEGORIES) expect([c.id, slugs.has(c.id)]).toEqual([c.id, true]);
    const made = s.rows.filter((x) => x.proposed); expect(made.filter((x) => x.parentId !== null)).toHaveLength(159);
    for (const x of made.filter((y) => y.parentId !== null)) { expect(x.themeCategoryId).toBeNull(); expect(s.rows.find((p) => p.id === x.parentId)!.parentId).toBeNull(); expect(x.family).toBe(familySlug(CATALOGUE_CATEGORIES.find((c) => c.id === x.slug)!.family)); }
  });
  it('is idempotent: a second apply creates nothing', async () => {
    const s = new MemoryCategories(); s.seedKit(); await loadCatalogueCategories(s, CATALOGUE_CATEGORIES, { apply: true, kitIds }); const n = s.rows.length;
    const again = await loadCatalogueCategories(s, CATALOGUE_CATEGORIES, { apply: true, kitIds });
    expect(again.categories).toEqual({ total: 196, created: 0, existing: 196 }); expect(again.families.created).toBe(0); expect(s.rows).toHaveLength(n);
  });
  it('NEVER overwrites a staff edit: a renamed, re-parented or switched row (and the kit rows) are left exactly as they are, and a staff-made row with a catalogue slug is respected', async () => {
    const s = new MemoryCategories(); s.seedKit();
    await loadCatalogueCategories(s, CATALOGUE_CATEGORIES, { apply: true, kitIds });
    const wh = s.rows.find((x) => x.slug === 'wholesale-trader')!; wh.name = 'Wholesalers (staff name)'; const parentBefore = wh.parentId; const plumber = s.rows.find((x) => x.slug === 'plumber')!; const snapshot = JSON.stringify(s.rows);
    const again = await loadCatalogueCategories(s, CATALOGUE_CATEGORIES, { apply: true, kitIds });
    expect(JSON.stringify(s.rows)).toBe(snapshot); expect(again.categories.created).toBe(0); expect(wh.name).toBe('Wholesalers (staff name)'); expect(wh.parentId).toBe(parentBefore); expect(plumber.name).toBe('Plumber');
    const t = new MemoryCategories(); t.seedKit(); const f = t.rows.find((x) => x.parentId === null)!; t.rows.push({ id: 'x1', slug: 'wholesale-trader', parentId: f.id, name: 'Staff made', proposed: false, themeCategoryId: null, family: null, sortOrder: 0 });
    const r = await loadCatalogueCategories(t, CATALOGUE_CATEGORIES, { apply: true, kitIds }); expect(r.createdKeys).not.toContain('wholesale-trader'); expect(t.rows.filter((x) => x.slug === 'wholesale-trader')).toHaveLength(1);
  });
  it('reuses a family that already exists at the top level (Healthcare) instead of making a second, and on an empty tree makes 20 families and 196 categories', async () => {
    const s = new MemoryCategories(); s.seedKit(); await loadCatalogueCategories(s, CATALOGUE_CATEGORIES, { apply: true, kitIds });
    expect(s.rows.filter((x) => x.parentId === null && x.slug === 'healthcare')).toHaveLength(1);
    const e = new MemoryCategories(); const r = await loadCatalogueCategories(e, CATALOGUE_CATEGORIES, { apply: true, kitIds });
    expect(r).toMatchObject({ families: { total: 20, created: 20, existing: 0 }, categories: { total: 196, created: 196, existing: 0 } }); expect(e.rows.filter((x) => x.parentId === null)).toHaveLength(20);
  });
  it('a dry run on an empty tree and an apply report the same numbers', async () => {
    const a = await loadCatalogueCategories(new MemoryCategories(), CATALOGUE_CATEGORIES, { apply: false, kitIds }); const b = await loadCatalogueCategories(new MemoryCategories(), CATALOGUE_CATEGORIES, { apply: true, kitIds });
    expect(a).toEqual(b);
  });
});

describe('the script', () => {
  const s = fs.readFileSync(path.resolve(__dirname, '..', 'scripts/seed-v3-catalogue-categories.js'), 'utf8');
  it('is a dry run unless --apply is given, uses the staging guard, and prints no connection string', () => {
    expect(s).toContain("args.includes('--apply')"); expect(s).toContain('loadStagingEnv()'); expect(s).toContain('env.mask('); expect(s).not.toMatch(/console\.log\([^)]*DATABASE_URL/);
    expect(s).toContain("OFFLINE && APPLY"); expect(s).not.toMatch(/\.(update|updateMany|upsert|delete|deleteMany)\(/);
  });
  it('the store only creates and reads', () => {
    const t = fs.readFileSync(path.resolve(__dirname, '..', 'src/directory/seed/prisma-catalogue-category-store.ts'), 'utf8');
    expect(t).not.toMatch(/\.(update|updateMany|upsert|delete|deleteMany)\(/); expect(t).toContain('proposed: true');
  });
});

describe('the service route body', () => {
  it('SeededSitesService.listableCategories reports the rows and how many are not in the directory yet', async () => {
    const items = [{ key: 'a', name: 'A', family: 'F', pack: 'RETAIL', source: 'CATALOGUE', kitCategory: 'x', hasOwnDesign: false, inDirectory: true }, { key: 'b', name: 'B', family: 'F', pack: 'RETAIL', source: 'CATALOGUE', kitCategory: 'x', hasOwnDesign: false, inDirectory: false }];
    const svc = new SeededSitesService({} as never, {} as never, {} as never, {} as never, { listableCategories: async () => items } as never, {} as never, {} as never, {} as never);
    expect(await svc.listableCategories()).toEqual({ items, total: 2, missingFromDirectory: 1 });
  });
});

describe('provisioning finds the directory row of a catalogue category by its key', () => {
  async function stepWorld() {
    const { directoryWorld } = await import('./support/directory-world'); const { CreateDirectoryProfileStep } = await import('../src/provisioning/steps/create-directory-profile.step');
    const w = await directoryWorld(); const step = new CreateDirectoryProfileStep(w.repo, w.admin, w.audit);
    const ctx = (category: string, vendorId: string) => ({ vendorId, actor: { type: 'STAFF' as const, id: 's1', ip: null }, job: {}, settings: {}, now: new Date(), input: { businessName: `Shop ${vendorId}`, track: 'ecommerce', category, ownerName: 'Owner', phone: '9811111111', email: `site+${vendorId}@sites.get4domain.invalid`, city: 'Chennai', language: 'en', seeded: true } }) as never;
    return { w, step, ctx };
  }
  it('a category row made by the loader (slug = catalogue key, no theme link) is found; the business is made in that category', async () => {
    const { w, step, ctx } = await stepWorld();
    const fam = await w.repo.createCategory({ parentId: null, name: 'B2B', slug: 'b2b-suppliers-and-manufacturers', themeCategoryId: null, family: 'b2b-suppliers-and-manufacturers', sortOrder: 100 });
    const leaf = await w.repo.createCategory({ parentId: fam.id, name: 'Wholesale trader', slug: 'wholesale-trader', themeCategoryId: null, family: 'b2b-suppliers-and-manufacturers', sortOrder: 0 });
    const r = await step.run(ctx('wholesale-trader', 'v9')); expect((await w.repo.getBusiness((r.outputRef as { businessId: string }).businessId))!.categoryId).toBe(leaf.id);
  });
  it('the older link still works (a row with a theme category and the same key), and a category with no row is the plainly named permanent failure', async () => {
    const { w, step, ctx } = await stepWorld();
    const r = await step.run(ctx('plumber', 'v8')); expect((await w.repo.getBusiness((r.outputRef as { businessId: string }).businessId))!.categoryId).toBe(w.ids.plumber);
    await expect(step.run(ctx('chemical-products-supplier', 'v7'))).rejects.toMatchObject({ code: 'DIRECTORY_CATEGORY_MISSING' });
  });
  it('a family row with the same slug as a category key is never taken for the category', async () => {
    const { w, step, ctx } = await stepWorld();
    await w.repo.createCategory({ parentId: null, name: 'Education family', slug: 'education-clash', themeCategoryId: null, family: null, sortOrder: 0 });
    await expect(step.run(ctx('education-clash', 'v6'))).rejects.toMatchObject({ code: 'DIRECTORY_CATEGORY_MISSING' });
  });
});
