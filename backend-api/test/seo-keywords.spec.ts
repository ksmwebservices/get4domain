import { readFileSync } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';
import { deriveKeywordSet, parseCsv, planKeywordLoad, pluraliseName, sheetCategories, StoredKeywordSet } from '../src/seo-directory/core/category-keywords';
import { cleanKeyword, SeoKeywordService } from '../src/seo-directory/keywords/seo-keyword.service';
import { KeywordRow, SeoKeywordStore } from '../src/seo-directory/keywords/seo-keyword.store';
import { KeywordSet } from '../src/seo-directory/core/category-keywords';
import { ADMIN_ROLE_MATRIX, effectiveRolesFor, SEO_ROUTES } from '../src/auth/guards/admin-role-matrix';

class MemoryKeywordStore extends SeoKeywordStore {
  rows = new Map<string, KeywordRow>();
  async list(q: { q?: string; skip: number; take: number }) { const all = [...this.rows.values()].filter((r) => !q.q || r.categorySlug.includes(q.q.toLowerCase())).sort((a, b) => a.categorySlug.localeCompare(b.categorySlug)); return { items: all.slice(q.skip, q.skip + q.take), total: all.length }; }
  async all() { return [...this.rows.values()]; }
  async get(slug: string) { return this.rows.get(slug) ?? null; }
  async upsertDerived(sets: KeywordSet[]) { for (const s of sets) { const h = this.rows.get(s.categorySlug); if (h?.source === 'STAFF') continue; this.rows.set(s.categorySlug, { ...(h ?? { id: `k-${this.rows.size}`, synonyms: [], updatedByStaffId: null }), ...s, synonyms: h?.synonyms ?? [], source: 'DERIVED', updatedAt: new Date(0) } as KeywordRow); } }
  async staffUpdate(slug: string, p: { singular?: string; plural?: string; synonyms?: string[] }, staffId: string | null) { const h = this.rows.get(slug); if (!h) return null; const n = { ...h, ...p, source: 'STAFF' as const, updatedByStaffId: staffId }; this.rows.set(slug, n); return n; }
}

const CSV = 'id,name,family,services_seed_from_specialisations\nplumber,Plumber,Home,"Pipe fitting; Leak repair"\naudio-equipment,Audio equipment,Retail,\ndriving-school,Driving school,Education,Car; Bike\n';
const actor = { type: 'STAFF' as const, id: 'staff-1', ip: null };

describe('category keyword derivation', () => {
  it('pluralises the last word by spelling rules', () => {
    expect(pluraliseName('plumber')).toBe('plumbers');
    expect(pluraliseName('Driving School')).toBe('driving schools');
    expect(pluraliseName('beauty salon')).toBe('beauty salons');
    expect(pluraliseName('pharmacy')).toBe('pharmacies');
    expect(pluraliseName('florist')).toBe('florists');
    expect(pluraliseName('Audio equipment')).toBe('audio equipment');
    expect(pluraliseName('tyres')).toBe('tyres');
    expect(pluraliseName('boutique')).toBe('boutiques');
    expect(pluraliseName('bus')).toBe('bus');
    expect(pluraliseName('')).toBe('');
  });
  it('keeps the sheet specialisations and invents no synonym', () => {
    const k = deriveKeywordSet({ id: 'Plumber', name: ' Plumber ', specialisations: ['Pipe fitting', 'Pipe fitting', ' Leak repair '] });
    expect(k).toEqual({ categorySlug: 'plumber', name: 'Plumber', singular: 'plumber', plural: 'plumbers', synonyms: [], specialisations: ['Pipe fitting', 'Leak repair'] });
  });
});

describe('names that are not pluralised', () => {
  const plural = (name: string): string => deriveKeywordSet({ id: 'x', name, specialisations: [] }).plural;
  it('leaves the plural empty (and keeps the singular) for " and ", a last word ending in "ing", or more than three words', () => {
    expect(plural('Motivational speaker and trainer')).toBe('');
    expect(plural('Pumps and motors supplier')).toBe('');
    expect(plural('Interior decorating')).toBe('');
    expect(plural('Car accessories fitting')).toBe('');
    expect(plural('Agricultural machinery dealer shop')).toBe('');
    expect(deriveKeywordSet({ id: 'x', name: 'Interior decorating', specialisations: [] }).singular).toBe('interior decorating');
  });
  it('still pluralises ordinary names, including exactly three words', () => {
    expect(plural('Plumber')).toBe('plumbers'); expect(plural('Driving school')).toBe('driving schools'); expect(plural('Agricultural machinery dealer')).toBe('agricultural machinery dealers');
  });
  it('the loader stores the empty plural and does not call it a change on the second run', async () => {
    const store = new MemoryKeywordStore(); const svc = new SeoKeywordService(store, { record: async () => undefined });
    const csv = 'id,name\nspeaker,Motivational speaker and trainer\n';
    await svc.load(csv, { apply: true });
    expect(store.rows.get('speaker')).toMatchObject({ singular: 'motivational speaker and trainer', plural: '' });
    expect((await svc.load(csv, { apply: true })).unchanged).toBe(1);
  });
});

describe('csv and sheet', () => {
  it('parses quotes, commas, doubled quotes and line breaks inside quotes', () => { expect(parseCsv('a,b\n"x, y","he said ""hi""\nthere"\r\n')).toEqual([['a', 'b'], ['x, y', 'he said "hi"\nthere']]); });
  it('reports bad rows instead of guessing', () => {
    const r = sheetCategories('id,name\nplumber,Plumber\nplumber,Plumber again\n,No id\nBad Slug,Name\n');
    expect(r.categories.map((c) => c.id)).toEqual(['plumber']);
    expect(r.problems.length).toBe(3);
    expect(sheetCategories('name\nx').problems[0]).toMatch(/id and name/);
    expect(sheetCategories('').problems[0]).toMatch(/empty/);
  });
});

describe('the loader plan', () => {
  it('creates everything on an empty store, and is idempotent once applied', async () => {
    const store = new MemoryKeywordStore(); const svc = new SeoKeywordService(store, { record: async () => undefined });
    const dry = await svc.load(CSV, { apply: false });
    expect(dry).toMatchObject({ total: 3, unchanged: 0, keptStaff: 0 }); expect(dry.create).toHaveLength(3); expect(store.rows.size).toBe(0);   // a dry run writes nothing
    await svc.load(CSV, { apply: true }); expect(store.rows.size).toBe(3);
    const again = await svc.load(CSV, { apply: true });
    expect(again.create).toHaveLength(0); expect(again.update).toHaveLength(0); expect(again.unchanged).toBe(3);
  });
  it('refreshes a derived row when the sheet changed but never touches an edited one', async () => {
    const store = new MemoryKeywordStore(); const svc = new SeoKeywordService(store, { record: async () => undefined });
    await svc.load(CSV, { apply: true });
    await svc.update('plumber', { synonyms: ['plumbing services'] }, actor);
    const changed = CSV.replace('Leak repair', 'Leak repair; Drain cleaning').replace('Driving school', 'Driving academy');
    const plan = await svc.load(changed, { apply: true });
    expect(plan.keptStaff).toBe(1); expect(plan.update.map((u) => u.categorySlug)).toEqual(['driving-school']);
    expect(store.rows.get('plumber')!.specialisations).toEqual(['Pipe fitting', 'Leak repair']);
    expect(store.rows.get('plumber')!.synonyms).toEqual(['plumbing services']);
    expect(store.rows.get('driving-school')!.name).toBe('Driving academy');
  });
  it('writes nothing while the sheet has problems', async () => {
    const store = new MemoryKeywordStore(); const svc = new SeoKeywordService(store, { record: async () => undefined });
    const plan = await svc.load('id,name\nplumber,Plumber\nplumber,Dup\n', { apply: true });
    expect(plan.problems).toHaveLength(1); expect(store.rows.size).toBe(0);
  });
  it('plan keeps staff rows even when given as a map', () => {
    const staff = new Map<string, StoredKeywordSet>([['plumber', { ...deriveKeywordSet({ id: 'plumber', name: 'Plumber', specialisations: [] }), source: 'STAFF' }]]);
    expect(planKeywordLoad(CSV, staff)).toMatchObject({ keptStaff: 1 });
  });
  const sheet = [join(__dirname, '../../docs/v3/catalog/CATEGORY_MASTER_V3_ADMIN_REGISTRATION.csv'), 'C:/Get4Domain/get4domain-site/docs/v3/catalog/CATEGORY_MASTER_V3_ADMIN_REGISTRATION.csv'].find((p) => existsSync(p));
  (sheet ? it : it.skip)('the real catalog sheet loads: 196 categories, no problems, no synonyms invented', () => {
    const plan = planKeywordLoad(readFileSync(sheet!, 'utf8'), new Map());
    expect(plan.problems).toEqual([]); expect(plan.total).toBe(196); expect(plan.create).toHaveLength(196);
    expect(plan.create.every((c) => c.synonyms.length === 0 && c.singular)).toBe(true);
  });
});

describe('staff edits', () => {
  const setup = async () => { const store = new MemoryKeywordStore(); const audit: unknown[][] = []; const svc = new SeoKeywordService(store, { record: async (...a: unknown[]) => { audit.push(a); } }); await svc.load(CSV, { apply: true }); return { store, svc, audit }; };
  it('cleans, de-duplicates and audits', async () => {
    const { svc, audit } = await setup();
    const r = await svc.update('plumber', { synonyms: ['Plumbing  Services', 'plumbing services', 'pipe fitters'], plural: 'Plumbers' }, actor);
    expect(r.synonyms).toEqual(['plumbing services', 'pipe fitters']); expect(r.plural).toBe('plumbers'); expect(r.source).toBe('STAFF');
    expect(audit).toHaveLength(1); expect(audit[0][1]).toBe('seo.keywords.update');
  });
  it('refuses a price, markup, an over-long list and an unknown category', async () => {
    const { svc } = await setup();
    await expect(svc.update('plumber', { synonyms: ['plumber from ₹999'] }, actor)).rejects.toMatchObject({ response: { code: 'SEO_INVALID' } });
    await expect(svc.update('plumber', { synonyms: ['<b>x</b>'] }, actor)).rejects.toMatchObject({ response: { code: 'SEO_INVALID' } });
    await expect(svc.update('plumber', { synonyms: Array.from({ length: 31 }, (_, i) => `kw${i}`) }, actor)).rejects.toMatchObject({ response: { code: 'SEO_INVALID' } });
    await expect(svc.update('nope', { singular: 'x' }, actor)).rejects.toMatchObject({ response: { code: 'SEO_NOT_FOUND' } });
    expect(cleanKeyword('  Pipe   Fitters ')).toBe('pipe fitters'); expect(cleanKeyword('')).toBeNull(); expect(cleanKeyword('x'.repeat(81))).toBeNull();
  });
});

describe('role matrix for the SEO routes', () => {
  it('SALES reads, ADMIN and SUPER_ADMIN write, OPERATIONS and SUPPORT have no access', () => {
    for (const [key, base] of Object.entries(SEO_ROUTES)) {
      expect(ADMIN_ROLE_MATRIX[key]).toBe(base);
      const roles = effectiveRolesFor(key);
      expect(roles).toContain('SUPER_ADMIN'); expect(roles).toContain('ADMIN');
      expect(roles).not.toContain('OPERATIONS'); expect(roles).not.toContain('SUPPORT');
      expect(roles.includes('MARKETING')).toBe(key.startsWith('GET '));
    }
  });
});
