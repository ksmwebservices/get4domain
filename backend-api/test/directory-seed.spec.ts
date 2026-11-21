import * as fs from 'fs';
import * as path from 'path';
import { applyDirectorySeed, DirectorySeedStore } from '../src/directory/seed/seed-applier';
import { DirectorySeed, validateDirectorySeed } from '../src/directory/seed/seed-file';
import { loadKit } from '../src/site-publish/renderer/renderer-loader';

const seed: DirectorySeed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-directory.seed.json'), 'utf8'));
const kitIds = loadKit().CATEGORIES.map((c) => c.id);

class MemStore implements DirectorySeedStore {
  locs = new Map<string, { id: string; name: string; kind: string; sortOrder: number; proposed: boolean }>();
  cats = new Map<string, { id: string; name: string; themeCategoryId: string | null; family: string | null; sortOrder: number; proposed: boolean }>();
  writes = 0; private n = 0;
  async findLocation(parentKey: string, slug: string) { return this.locs.get(`${parentKey}/${slug}`) ?? null; }
  async createLocation(d: { parentId: string | null; parentKey: string; kind: string; name: string; slug: string; sortOrder: number; proposed: boolean }) { this.writes++; const id = `L${++this.n}`; this.locs.set(`${d.parentKey}/${d.slug}`, { id, name: d.name, kind: d.kind, sortOrder: d.sortOrder, proposed: d.proposed }); return id; }
  async updateLocation(id: string, d: { name: string; sortOrder: number }) { this.writes++; for (const v of this.locs.values()) if (v.id === id) Object.assign(v, d); }
  async findCategory(parentKey: string, slug: string) { return this.cats.get(`${parentKey}/${slug}`) ?? null; }
  async createCategory(d: { parentId: string | null; parentKey: string; name: string; slug: string; themeCategoryId: string | null; family: string | null; sortOrder: number; proposed: boolean }) { this.writes++; const id = `C${++this.n}`; this.cats.set(`${d.parentKey}/${d.slug}`, { id, name: d.name, themeCategoryId: d.themeCategoryId, family: d.family, sortOrder: d.sortOrder, proposed: d.proposed }); return id; }
  async updateCategory(id: string, d: { name: string; themeCategoryId: string | null; family: string | null; sortOrder: number }) { this.writes++; for (const v of this.cats.values()) if (v.id === id) Object.assign(v, d); }
}

describe('the committed directory seed', () => {
  it('is valid, every row is marked proposed, and it says what it left out', () => {
    expect(validateDirectorySeed(seed, kitIds)).toEqual([]);
    expect(seed.status).toBe('proposed');
    expect([...seed.locations, ...seed.categories].every((r) => r.proposed === true)).toBe(true);
    expect(seed.missing.length).toBeGreaterThan(0);
  });
  it('has Tamil Nadu with its 38 districts and cities under the district that contains them', () => {
    expect(seed.locations.filter((l) => l.kind === 'STATE').map((l) => l.name)).toEqual(['Tamil Nadu']);
    expect(seed.locations.filter((l) => l.kind === 'DISTRICT')).toHaveLength(38);
    const cities = seed.locations.filter((l) => l.kind === 'CITY');
    expect(cities.length).toBeGreaterThanOrEqual(10);
    const hosur = cities.find((c) => c.name === 'Hosur')!; expect(hosur.parent).toBe('tamil-nadu/krishnagiri');
    expect(cities.find((c) => c.name === 'Chennai')!.parent).toBe('tamil-nadu/chennai');
  });
  it('maps ALL 41 theme kit categories exactly once into 12 families', () => {
    const leaves = seed.categories.filter((c) => c.themeCategoryId);
    expect(leaves.map((c) => c.themeCategoryId).sort()).toEqual([...kitIds].sort());
    expect(seed.categories.filter((c) => !c.parent)).toHaveLength(12);
    expect(leaves.every((c) => seed.categories.some((p) => p.key === c.parent && !p.parent))).toBe(true);
  });
  it('contains no rupee price, no retired product name and no old tagline', () => {
    const text = JSON.stringify(seed);
    expect(text).not.toMatch(/₹|\bRs\.?\s?\d|Workspace|\bBOS\b|LeadSpace|Online Identity/i);
  });
});

describe('validateDirectorySeed', () => {
  const clone = (): DirectorySeed => JSON.parse(JSON.stringify(seed));
  it('refuses a row that is not marked proposed, a child before its parent, a wrong kind under a parent, a duplicate key or slug, and an unknown theme category', () => {
    let s = clone(); s.locations[3].proposed = false as never; expect(validateDirectorySeed(s, kitIds).join()).toMatch(/proposed/);
    s = clone(); s.locations.reverse(); expect(validateDirectorySeed(s, kitIds).join()).toMatch(/parent/);
    s = clone(); s.locations[1].kind = 'CITY'; expect(validateDirectorySeed(s, kitIds).join()).toMatch(/kind/);
    s = clone(); s.locations[2].key = s.locations[1].key; expect(validateDirectorySeed(s, kitIds).join()).toMatch(/duplicate/);
    s = clone(); s.categories[20].slug = s.categories[21].slug; s.categories[20].parent = s.categories[21].parent; expect(validateDirectorySeed(s, kitIds).join()).toMatch(/slug/);
    s = clone(); s.categories[20].themeCategoryId = 'not-a-kit-category'; expect(validateDirectorySeed(s, kitIds).join()).toMatch(/theme category/);
    expect(validateDirectorySeed({ ...clone(), schemaVersion: 2 as never }, kitIds).join()).toMatch(/schemaVersion/);
  });
});

describe('applyDirectorySeed', () => {
  it('a dry run reports what it would create and writes nothing', async () => {
    const st = new MemStore(); const r = await applyDirectorySeed(st, seed, { apply: false });
    expect(st.writes).toBe(0); expect(r.locations.created).toBe(58); expect(r.categories.created).toBe(53);
  });
  it('--apply creates everything once; a second apply creates and updates nothing', async () => {
    const st = new MemStore(); const a = await applyDirectorySeed(st, seed, { apply: true });
    expect([a.locations.created, a.categories.created]).toEqual([58, 53]); expect(st.locs.size).toBe(58); expect(st.cats.size).toBe(53);
    const w = st.writes; const b = await applyDirectorySeed(st, seed, { apply: true });
    expect([b.locations.created, b.categories.created, b.locations.updated, b.categories.updated]).toEqual([0, 0, 0, 0]); expect(st.writes).toBe(w);
  });
  it('a proposed row whose seed text changed is updated; a row the owner has reviewed (proposed = false) is never overwritten', async () => {
    const st = new MemStore(); await applyDirectorySeed(st, seed, { apply: true });
    const changed = JSON.parse(JSON.stringify(seed)) as DirectorySeed; changed.locations[0].name = 'Tamil Nadu (renamed)'; changed.locations[1].name = 'Ariyalur (renamed)';
    st.locs.get('ROOT/tamil-nadu')!.proposed = false;   // reviewed by the owner
    const r = await applyDirectorySeed(st, changed, { apply: true });
    expect(r.locations.updated).toBe(1); expect(r.locations.keptReviewed).toBe(1);
    expect(st.locs.get('ROOT/tamil-nadu')!.name).toBe('Tamil Nadu');
  });
});
