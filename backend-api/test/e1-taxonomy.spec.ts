import * as fs from 'fs';
import * as path from 'path';
import { describeSchemaSlice, modelBlock, migrationSql } from './support/schema-checks';
import {
  allowedFamilies, EXPECTED, MasterFile, matchLegacy, multiFamilyCount, relatedOf, slugify, validateAliases, validateMaster, validateRelated, RelatedFile,
} from '../src/v3-taxonomy/taxonomy-core';
import { loadTaxonomy, MemoryTaxonomyStore, TaxonomyFiles } from '../src/v3-taxonomy/taxonomy-loader';
import { readTaxonomyFiles } from '../src/v3-taxonomy/taxonomy-files';
import { buildSeed } from '../src/v3-packs/seed/pack-seed';
import { readSeedSources } from '../src/v3-packs/seed/seed-files';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const gen = require('../scripts/lib/category-master-45-lib') as { slugify: (s: string) => string; parseInput: (t: string) => unknown; buildMaster: (p: unknown) => unknown };

const backend = path.resolve(__dirname, '..');
const files = (): TaxonomyFiles => readTaxonomyFiles();
const legacy = (): Array<{ categoryKey: string; name: string }> => buildSeed(readSeedSources()).categories.map((c) => ({ categoryKey: c.categoryKey, name: c.name }));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describeSchemaSlice('E1 taxonomy', {
  suffix: '_v3_e1_taxonomy',
  tables: ['g4d_taxonomy_families', 'g4d_taxonomy_categories', 'g4d_taxonomy_family_categories', 'g4d_taxonomy_related_families', 'g4d_taxonomy_legacy_map'],
  enums: [],
  fkTargets: ['g4d_pack_categories'],
});

describe('E1 migration is additive and leaves the existing categories alone', () => {
  const { code } = migrationSql('_v3_e1_taxonomy');
  it('never touches g4d_pack_categories except as the target of one foreign key from the new map table', () => {
    const stmts = code.split(';').map((s) => s.trim()).filter((s) => s.includes('"g4d_pack_categories"'));
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toMatch(/^ALTER TABLE "g4d_taxonomy_legacy_map" ADD CONSTRAINT .* REFERENCES "g4d_pack_categories"\("categoryKey"\)/s);
  });
  it('stores a related pair once, smaller id first', () => {
    expect(code).toMatch(/CHECK \("familyAId" < "familyBId"\)/);
    expect(modelBlock('g4d_taxonomy_related_families')).toMatch(/@@unique\(\[familyAId, familyBId\]\)/);
  });
  it('a family carries the planned pack key (unique, no foreign key to the packs) and every row a source tag', () => {
    expect(modelBlock('g4d_taxonomy_families')).toMatch(/plannedPackKey\s+String\s+@unique/);
    expect(code).not.toMatch(/REFERENCES "g4d_packs"/);
    for (const t of ['g4d_taxonomy_families', 'g4d_taxonomy_categories']) expect(modelBlock(t)).toMatch(/sourceTag\s+String/);
  });
  it('adds no column to an existing table (the schema change on V3PackCategory is a back relation only)', () => {
    expect(code).not.toMatch(/ALTER TABLE "g4d_pack_categories"/);
    expect(modelBlock('g4d_pack_categories')).toMatch(/taxonomyMap\s+V3TaxonomyLegacyMap\?/);
  });
});

describe('E1 master data file', () => {
  const f = files();
  it('has the counts the owner gave: 45 families, 1,277 listed links, 1,213 unique categories, 61 in several families', () => {
    expect(f.master.families).toHaveLength(EXPECTED.families);
    expect(f.master.links).toHaveLength(EXPECTED.listedLinks);
    expect(f.master.listedLinks).toBe(EXPECTED.listedLinks);
    expect(f.master.categories).toHaveLength(EXPECTED.uniqueCategories);
    expect(multiFamilyCount(f.master)).toBe(EXPECTED.multiFamily);
    expect(validateMaster(f.master)).toEqual([]);
  });
  it('families are numbered 1 to 45 in order, each with a slug, a name and a planned pack key', () => {
    expect(f.master.families.map((x) => x.order)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1));
    for (const x of f.master.families) { expect(x.name.length).toBeGreaterThan(3); expect(x.plannedPackKey).toMatch(/^[A-Z][A-Z0-9_]+$/); }
    expect(f.master.families.find((x) => x.order === 21)?.name).toBe('IT, Software & Digital Services');
  });
  it('slugs are lowercase, unique and derived from the name (deterministic)', () => {
    const slugs = f.master.categories.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of f.master.categories) { expect(c.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/); expect(slugify(c.name)).toBe(c.slug); }
    expect(slugify('Packers & Movers')).toBe('packers-and-movers');
  });
  it('the TypeScript slug rule equals the generator slug rule on every name', () => {
    for (const c of f.master.categories) expect(gen.slugify(c.name)).toBe(slugify(c.name));
  });
  it('the same name in several families is one category with several links (Home Tutors)', () => {
    const links = f.master.links.filter((l) => l.category === 'home-tutors').map((l) => l.family);
    expect(links.length).toBeGreaterThan(1);
    expect(f.master.categories.filter((c) => c.slug === 'home-tutors')).toHaveLength(1);
  });
  it('link integrity: every link points at a real family and category, no link twice, every category linked', () => {
    const fam = new Set(f.master.families.map((x) => x.slug)); const cat = new Set(f.master.categories.map((x) => x.slug));
    const seen = new Set<string>();
    for (const l of f.master.links) { expect(fam.has(l.family)).toBe(true); expect(cat.has(l.category)).toBe(true); const k = `${l.family}|${l.category}`; expect(seen.has(k)).toBe(false); seen.add(k); }
    expect(new Set(f.master.links.map((l) => l.category)).size).toBe(cat.size);
  });
  it('the committed file equals what the generator makes from the owner input file', () => {
    const input = path.resolve(backend, '..', 'docs', 'v3', 'inputs', 'REQ_CATEGORY_MASTER_45_FAMILIES.md');
    if (!fs.existsSync(input)) return;   // the input file is not committed in every checkout
    const made = JSON.stringify(gen.buildMaster(gen.parseInput(fs.readFileSync(input, 'utf8'))), null, 1) + '\n';
    expect(fs.readFileSync(path.join(backend, 'data', 'category-master-45.json'), 'utf8')).toBe(made);
  });
  it('validateMaster catches a broken file', () => {
    const bad = clone(f.master) as MasterFile;
    bad.links.push({ family: 'no-such-family', category: bad.categories[0].slug });
    bad.links.push({ ...bad.links[0] });
    expect(validateMaster(bad).join(' | ')).toMatch(/unknown family.*listed twice|listed twice.*unknown family|unknown family/);
    expect(validateMaster(bad).length).toBeGreaterThan(2);
  });
});

describe('E1 related families', () => {
  const f = files();
  const slugs = f.master.families.map((x) => x.slug);
  it('is flagged for owner review and passes every check', () => {
    expect(f.related.needsOwnerReview).toBe(true);
    expect(validateRelated(f.related, slugs)).toEqual([]);
  });
  it('covers all 45 families, each with at least one related family and a reason', () => {
    for (const s of slugs) expect(relatedOf(f.related, s).length).toBeGreaterThan(0);
    for (const p of f.related.pairs) expect(p.reason.length).toBeGreaterThan(10);
  });
  it('is symmetric: if B is related to A then A is related to B, with the same reason, and a family may use its own category', () => {
    for (const p of f.related.pairs) {
      expect(relatedOf(f.related, p.a).find((x) => x.family === p.b)?.reason).toBe(p.reason);
      expect(relatedOf(f.related, p.b).find((x) => x.family === p.a)?.reason).toBe(p.reason);
      expect(allowedFamilies(f.related, p.a)).toEqual(expect.arrayContaining([p.a, p.b]));
    }
  });
  it('rejects a pair stored in both directions, a self relation and an unknown family', () => {
    const r: RelatedFile = { needsOwnerReview: true, pairs: [{ a: slugs[0], b: slugs[1], reason: 'both ways shown' }, { a: slugs[1], b: slugs[0], reason: 'both ways shown' }, { a: slugs[2], b: slugs[2], reason: 'itself' }, { a: 'nope', b: slugs[3], reason: 'unknown one' }] };
    const p = validateRelated(r, slugs).join(' | ');
    expect(p).toMatch(/listed twice/); expect(p).toMatch(/related to itself/); expect(p).toMatch(/unknown family/);
  });
});

describe('E1 the existing 196 categories', () => {
  const f = files();
  const slugSet = new Set(f.master.categories.map((c) => c.slug));
  const old = legacy();
  it('there are 196 of them, and the alias table points only at real categories and real existing keys', () => {
    expect(old).toHaveLength(196);
    expect(validateAliases(f.aliases, slugSet)).toEqual([]);
    const keys = new Set(old.map((c) => c.categoryKey));
    for (const a of f.aliases.aliases) expect([a.legacyKey, keys.has(a.legacyKey)]).toEqual([a.legacyKey, true]);
    expect(f.aliases.needsOwnerReview).toBe(true);
  });
  it('exact name first, then the alias table; the rest is listed as unmatched and nothing is lost', () => {
    const m = matchLegacy(old, slugSet, f.aliases);
    expect(m.matched.length + m.unmatched.length).toBe(196);
    expect(m.matched.filter((x) => x.kind === 'EXACT')).toHaveLength(12);
    expect(m.matched.filter((x) => x.kind === 'ALIAS')).toHaveLength(74);
    expect(m.unmatched).toHaveLength(110);
    expect(new Set([...m.matched.map((x) => x.legacyKey), ...m.unmatched.map((x) => x.categoryKey)]).size).toBe(196);
    expect(m.matched.find((x) => x.legacyKey === 'electrician')).toEqual({ legacyKey: 'electrician', categorySlug: 'electricians', kind: 'ALIAS' });
  });
  it('an exact name wins over an alias for the same category', () => {
    const m = matchLegacy([{ categoryKey: 'x', name: 'Electricians' }], slugSet, { needsOwnerReview: true, aliases: [{ legacyKey: 'x', category: 'plumbers', reason: 'test' }] });
    expect(m.matched).toEqual([{ legacyKey: 'x', categorySlug: 'electricians', kind: 'EXACT' }]);
  });
  it('the loader and its store can only READ the existing categories', () => {
    const store = fs.readFileSync(path.join(backend, 'src/v3-taxonomy/prisma-taxonomy.store.ts'), 'utf8');
    const uses = [...store.matchAll(/v3PackCategory\.(\w+)/g)].map((x) => x[1]);
    expect(uses).toEqual(['findMany']);
    expect(Object.getOwnPropertyNames(MemoryTaxonomyStore.prototype).filter((n) => /legacyCategor/i.test(n) && n.startsWith('create'))).toEqual([]);
    expect(store).not.toMatch(/\.(delete|deleteMany|update|updateMany|upsert)\(/);
  });
});

describe('E1 loader', () => {
  it('a dry run writes nothing and reports the counts', async () => {
    const s = new MemoryTaxonomyStore(legacy());
    const r = await loadTaxonomy(s, files(), { apply: false });
    expect([r.families.toCreate, r.categories.toCreate, r.links.toCreate, r.related.toCreate, r.legacy.toCreate]).toEqual([45, 1213, 1277, 114, 86]);
    expect(s.families).toHaveLength(0); expect(s.categories).toHaveLength(0); expect(s.links).toHaveLength(0);
    expect(r.unmatched).toHaveLength(110);
    expect(r.needsOwnerReview).toEqual({ aliasTable: true, relatedMap: true });
  });
  it('apply creates everything, and a second apply creates nothing (idempotent)', async () => {
    const s = new MemoryTaxonomyStore(legacy());
    const a = await loadTaxonomy(s, files(), { apply: true });
    expect([a.families.created, a.categories.created, a.links.created, a.related.created, a.legacy.created]).toEqual([45, 1213, 1277, 114, 86]);
    const before = JSON.stringify([s.families, s.categories, s.links, s.related, s.legacyMaps]);
    const b = await loadTaxonomy(s, files(), { apply: true });
    expect([b.families.created, b.categories.created, b.links.created, b.related.created, b.legacy.created]).toEqual([0, 0, 0, 0, 0]);
    expect([b.families.existing, b.categories.existing, b.links.existing, b.related.existing, b.legacy.existing]).toEqual([45, 1213, 1277, 114, 86]);
    expect(JSON.stringify([s.families, s.categories, s.links, s.related, s.legacyMaps])).toBe(before);
    expect(b.legacyAlreadyMapped).toBe(86);
  });
  it('a stopped run is finished by the next one (only the missing rows are created)', async () => {
    const s = new MemoryTaxonomyStore(legacy());
    await loadTaxonomy(s, files(), { apply: true });
    s.links.splice(0, 100); s.legacyMaps.splice(0, 5);
    const r = await loadTaxonomy(s, files(), { apply: true });
    expect([r.links.created, r.legacy.created, r.families.created]).toEqual([100, 5, 0]);
    expect(s.links).toHaveLength(1277);
  });
  it('link integrity in storage: every link has a family and a category, 61 categories are in several families, positions run 1..n per family', async () => {
    const s = new MemoryTaxonomyStore(legacy());
    await loadTaxonomy(s, files(), { apply: true });
    const fam = new Set(s.families.map((x) => x.slug)); const cat = new Set(s.categories.map((x) => x.slug));
    for (const l of s.links) { expect(fam.has(l.family)).toBe(true); expect(cat.has(l.category)).toBe(true); }
    const per = new Map<string, number[]>();
    for (const l of s.links) per.set(l.family, [...(per.get(l.family) ?? []), l.sortOrder]);
    for (const v of per.values()) expect(v).toEqual(Array.from({ length: v.length }, (_, i) => i + 1));
    const n = new Map<string, number>();
    for (const l of s.links) n.set(l.category, (n.get(l.category) ?? 0) + 1);
    expect([...n.values()].filter((x) => x > 1)).toHaveLength(61);
    for (const m of s.legacyMaps) expect(cat.has(m.category)).toBe(true);
    expect(s.families.every((x) => x.sourceTag === 'REQ_CATEGORY_MASTER_45_FAMILIES@1')).toBe(true);
  });
  it('never changes a row that exists: an edited name is only named in the report', async () => {
    const s = new MemoryTaxonomyStore(legacy());
    await loadTaxonomy(s, files(), { apply: true });
    s.categories[0].name = 'Edited by staff';
    const r = await loadTaxonomy(s, files(), { apply: true });
    expect(r.differs).toEqual([`category ${s.categories[0].slug}`]);
    expect(s.categories[0].name).toBe('Edited by staff');
  });
  it('an apply is refused while a data file has a problem, and nothing is written', async () => {
    const bad = files(); bad.master = clone(bad.master); bad.master.families.pop();
    const s = new MemoryTaxonomyStore(legacy());
    const r = await loadTaxonomy(s, bad, { apply: true });
    expect(r.refused).toBe(true); expect(r.problems.length).toBeGreaterThan(0);
    expect(s.families).toHaveLength(0);
  });
});

describe('E1 builds no screen and no public route', () => {
  it('the taxonomy folder has no controller, module or route decorator', () => {
    const dir = path.join(backend, 'src/v3-taxonomy');
    for (const f of fs.readdirSync(dir)) {
      expect(f).not.toMatch(/controller|module/);
      expect(fs.readFileSync(path.join(dir, f), 'utf8')).not.toMatch(/@(Controller|Get|Post|Put|Patch|Delete)\(/);
    }
  });
  it('the loader script is on the live runner list and confirms with a typed word', () => {
    const lib = fs.readFileSync(path.join(backend, 'scripts/live/live-env-lib.js'), 'utf8');
    expect(lib).toContain("'seed-v3-taxonomy.js'");
    const script = fs.readFileSync(path.join(backend, 'scripts/seed-v3-taxonomy.js'), 'utf8');
    expect(script).toMatch(/Type STAGING to continue/);
    expect(script).toMatch(/--apply/);
  });
});
