import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_DIRECTORY_SETTINGS } from '../src/directory/settings/directory-settings';
import { CategoryRow, LocationRow } from '../src/directory/directory.repository';
import { generateResearchPlan, plannerCsv, ProfileFact, ResearchRow, researchToCsv, ServiceCityCount } from '../src/seo-directory/core/keyword-research';
import { checkTarget, parseCompetition, parseVolume, planTargetImport, TargetInput, TargetRow, targetsToCsv } from '../src/seo-directory/core/keyword-target';
import { MAX_REPORTED, MAX_VOLUME_ROWS, parseVolumeCsv, planVolumeImport } from '../src/seo-directory/core/keyword-volume';
import { enumerateListingPaths, Stat } from '../src/seo-directory/core/sitemap';
import { hasRankingClaim } from '../src/seo-directory/core/ranking-claims';
import { KeywordRow, SeoKeywordStore } from '../src/seo-directory/keywords/seo-keyword.store';
import { SeoKeywordResearchService } from '../src/seo-directory/keywords/seo-keyword-research.service';
import { SeoKeywordTargetStore, TargetImportWrite, TargetListQuery } from '../src/seo-directory/keywords/seo-keyword-target.store';
import { SeoDirectoryData, ServiceStat, ProfileName } from '../src/seo-directory/pages/seo-directory.data';
import { loadPlaces } from '../src/seo-directory/pages/places';
import { DEFAULT_SEO_MODIFIERS, resolveSeoModifiers, seoModifiersProblem, seoTemplatesProblem } from '../src/seo-directory/settings/seo-settings';
import { SeoSettingsService } from '../src/seo-directory/settings/seo-settings.service';
import { SeoSitemapService } from '../src/seo-directory/sitemaps/seo-sitemap.service';

/** Prompt 8d: the keyword research list, the modifiers setting, and reading a Keyword Planner export back into the targets. */
const actor = { type: 'STAFF' as const, id: 'staff-1', ip: null };
const loc = (id: string, parentId: string | null, kind: LocationRow['kind'], name: string, slug: string): LocationRow => ({ id, parentId, parentKey: parentId ?? 'ROOT', kind, name, slug, sortOrder: 0, proposed: false, active: true });
const cat = (id: string, name: string, slug: string): CategoryRow => ({ id, parentId: null, parentKey: 'ROOT', name, slug, themeCategoryId: null, family: null, sortOrder: 0, proposed: false, active: true });
const LOCS = [loc('tn', null, 'STATE', 'Tamil Nadu', 'tamil-nadu'), loc('chn', 'tn', 'CITY', 'Chennai', 'chennai'), loc('per', 'chn', 'LOCALITY', 'Perambur', 'perambur'), loc('ady', 'chn', 'LOCALITY', 'Adyar', 'adyar'), loc('mdu', 'tn', 'CITY', 'Madurai', 'madurai')];
const CATS = [cat('plm', 'Plumber', 'plumber'), cat('ele', 'Electrician', 'electrician')];
const KW: KeywordRow[] = [
  { id: 'k1', categorySlug: 'plumber', name: 'Plumber', singular: 'plumber', plural: 'plumbers', synonyms: ['pipe fitter'], specialisations: [], source: 'DERIVED', updatedByStaffId: null, updatedAt: new Date(0) },
  { id: 'k2', categorySlug: 'electrician', name: 'Electrician', singular: 'electrician', plural: 'electricians', synonyms: [], specialisations: [], source: 'DERIVED', updatedByStaffId: null, updatedAt: new Date(0) },
];
class Kw extends SeoKeywordStore { async list() { return { items: [], total: 0 }; } async all() { return KW; } async get() { return null; } async upsertDerived() { /* none */ } async staffUpdate() { return null; } }
const stat = (locationId: string, categoryId: string, count: number, pincode: string | null = null): Stat => ({ locationId, categoryId, count, pincode, lastmod: new Date('2026-11-01T00:00:00Z') });
const STATS = [stat('per', 'plm', 4, '600011'), stat('ady', 'plm', 3, '600020'), stat('per', 'ele', 3), stat('mdu', 'plm', 1)];
const listing = async (stats = STATS, min = 3) => enumerateListingPaths(await loadPlaces({ listLocations: async () => LOCS, listCategories: async () => CATS } as never, new Kw()), stats, min);
const synonyms = new Map([['plumber', ['pipe fitter']]]);
const MODS = ['best', 'top', 'near me', '24 hours', 'in {locality}', 'services'];
const plan = async (o: Partial<Parameters<typeof generateResearchPlan>[0]> = {}) => generateResearchPlan({ listing: await listing(), synonyms, modifiers: MODS, serviceCounts: [], profiles: [], min: 3, ...o });
const kws = (p: { rows: ResearchRow[] }, kind?: string, path?: string): string[] => p.rows.filter((r) => (!kind || r.kind === kind) && (!path || r.path === path)).map((r) => r.keyword);

describe('the research list: places and pincodes', () => {
  it('category words (plural, singular, staff synonyms) in each city and locality that has a page; the page path rides on each row', async () => {
    const p = await plan({ modifiers: [] });
    expect(kws(p, 'place', '/chennai/plumbers')).toEqual(['plumbers in chennai', 'plumber in chennai', 'pipe fitter in chennai']);
    expect(kws(p, 'place', '/chennai/plumbers-in-perambur')).toEqual(['plumbers in perambur', 'plumber in perambur', 'pipe fitter in perambur']);
    expect(kws(p, 'place', '/chennai/electricians')).toEqual(['electricians in chennai', 'electrician in chennai']);
    expect(p.rows.every((r) => r.path.startsWith('/'))).toBe(true);
  });
  it('only pages that exist: nothing for a thin page (Madurai has one business; Adyar electricians none)', async () => {
    const p = await plan();
    expect(p.rows.some((r) => r.path.startsWith('/madurai') || /madurai/.test(r.keyword))).toBe(false); expect(p.rows.some((r) => r.path === '/chennai/electricians-in-adyar')).toBe(false);
  });
  it('pincodes: the words in each pincode that has a page', async () => {
    const p = await plan({ modifiers: [] });
    expect(kws(p, 'pincode', '/pincode/600011/plumber')).toEqual(['plumbers in 600011', 'plumber in 600011', 'pipe fitter in 600011']); expect(p.counts.pincode).toBeGreaterThan(0);
  });
});

describe('the research list: modifiers, services and vendors', () => {
  it('"best", "top" and "24 hours" go in front; "services" after the word; "in {locality}" only on locality pages; "near me" on the category page', async () => {
    const p = await plan({ synonyms: new Map() });
    const city = kws(p, 'modifier', '/chennai/plumbers'); const loc = kws(p, 'modifier', '/chennai/plumbers-in-perambur');
    expect(city).toEqual(expect.arrayContaining(['best plumbers in chennai', 'top plumber in chennai', '24 hours plumbers in chennai', 'plumbers services in chennai']));
    expect(city.some((k) => /perambur/.test(k))).toBe(false);   // the {locality} entry does not apply to a city page
    expect(loc).toEqual(expect.arrayContaining(['best plumbers in perambur', 'plumbers services in perambur']));
    expect(kws(p, 'modifier', '/category/plumber')).toEqual(['plumbers near me', 'plumber near me']);   // one page for it, not one per city
  });
  it('an "in {locality}" entry becomes the locality phrase on the locality page (and is a duplicate of the place row, so it is not repeated)', async () => {
    const p = await plan({ modifiers: ['in {locality}'], synonyms: new Map() });
    expect(p.rows.filter((r) => r.keyword === 'plumbers in perambur')).toHaveLength(1);
  });
  it('service x city only where at least the minimum number of businesses offer it, mapped to the city + category page', async () => {
    const counts: ServiceCityCount[] = [{ name: 'leak repair', catId: 'plm', cityId: 'chn', cityName: 'Chennai', count: 3 }, { name: 'tap fitting', catId: 'plm', cityId: 'chn', cityName: 'Chennai', count: 2 }, { name: 'leak repair', catId: 'plm', cityId: 'mdu', cityName: 'Madurai', count: 9 }];
    const p = await plan({ serviceCounts: counts });
    expect(p.rows.filter((r) => r.kind === 'service')).toEqual([{ keyword: 'leak repair in chennai', path: '/chennai/plumbers', kind: 'service' }]);   // 2 is below 3; Madurai has no page
  });
  it('vendor name x locality and x city, mapped to the profile; a name with a price or odd characters is skipped', async () => {
    const profiles: ProfileFact[] = [{ name: 'Ranjith Plumber', slug: 'ranjith-plumber', localityName: 'Perambur', cityName: 'Chennai' }, { name: 'Plumber from Rs 99', slug: 'cheap', localityName: 'Adyar', cityName: 'Chennai' }, { name: 'No Place Co', slug: 'no-place', localityName: null, cityName: null }];
    const p = await plan({ profiles, modifiers: [] });
    expect(p.rows.filter((r) => r.kind === 'vendor')).toEqual([{ keyword: 'ranjith plumber perambur', path: '/business/ranjith-plumber', kind: 'vendor' }, { keyword: 'ranjith plumber chennai', path: '/business/ranjith-plumber', kind: 'vendor' }]);
  });
  it('is deterministic, deduplicated, counted by kind, and stops at the cap', async () => {
    const a = await plan(); const b = await generateResearchPlan({ listing: [...(await listing())].reverse(), synonyms, modifiers: MODS, serviceCounts: [], profiles: [], min: 3 });
    expect(b.rows).toEqual(a.rows); expect(new Set(a.rows.map((r) => `${r.keyword}|${r.path}`)).size).toBe(a.rows.length);
    expect(Object.values(a.counts).reduce((x, y) => x + y, 0)).toBe(a.total);
    const cut = await plan({ max: 5 }); expect(cut.rows).toHaveLength(5); expect(cut.truncated).toBe(true); expect(a.truncated).toBe(false);
  });
  it('modifiers stay in the research: a ranking word in a modifier is allowed here and nowhere else (a template with it is refused)', async () => {
    expect((await plan()).rows.some((r) => hasRankingClaim(r.keyword))).toBe(true);
    expect(seoTemplatesProblem({ cityCategory: { title: ['Best {categoryPlural} in {city}'] } })).toMatch(/cannot claim a rank/);
  });
  it('the CSVs: the research file maps each keyword to its page and guards spreadsheet formulas; the Planner file is one unique keyword per row', async () => {
    const p = await plan(); const csv = researchToCsv(p.rows);
    expect(csv.split('\n')[0]).toBe('keyword,path,type'); expect(csv.split('\n')[1]).toMatch(/^[a-z0-9 ]+,\/[^,]+,(place|pincode|modifier|service|vendor)$/);
    const pl = plannerCsv(p.rows).trimEnd().split('\n'); expect(pl[0]).toBe('Keyword'); expect(new Set(pl).size).toBe(pl.length); expect(pl.every((l) => !l.includes(','))).toBe(true);
    expect(researchToCsv([{ keyword: '=sum(a1)', path: '/x', kind: 'place' }])).toContain("'=sum(a1)");
  });
});

describe('the modifiers setting', () => {
  it('defaults to best, top, near me, 24 hours, in {locality}, services; an empty list is valid (no modifiers); a stored bad value is ignored whole', () => {
    expect(resolveSeoModifiers(undefined)).toEqual([...DEFAULT_SEO_MODIFIERS]); expect([...DEFAULT_SEO_MODIFIERS]).toEqual(MODS);
    expect(resolveSeoModifiers([])).toEqual([]); expect(resolveSeoModifiers(['cheap'])).toEqual(['cheap']); expect(resolveSeoModifiers(['{city}'])).toEqual([...DEFAULT_SEO_MODIFIERS]);
  });
  it.each([[['Best']], [['{city} plumbers']], [['x'.repeat(41)]], [['best', 'best']], [['from Rs 99']], [['Workspace']], [[1]], [['<b>']], [Array.from({ length: 21 }, (_v, i) => `m${i}`)], ['best']])('refuses %j', (v) => { expect(seoModifiersProblem(v)).not.toBeNull(); });
  it('accepts the documented shapes', () => { expect(seoModifiersProblem(['best', 'near me', '24 hours', 'in {locality}', "kids' services", 'a & b'])).toBeNull(); });
});

describe('reading a Keyword Planner export', () => {
  const FILE = ['Keyword Stats 2026-10-01 to 2026-10-31', '', 'Keyword,Currency,Avg. monthly searches,Three month change,Competition,Competition (indexed value)',
    'plumbers in chennai,INR,"1,300",+10%,Low,12', 'best plumbers in chennai,INR,590,0%,HIGH,81', 'plumber in adyar,INR,1K - 10K,0%,Medium,40', 'pipe fitter in chennai,INR,,0%,,', 'plumbers near me,INR,90,0%,medium,', 'plumbers in chennai,INR,"1,500",+5%,Low,12', '"=cmd|x",INR,10,0%,Low,1', 'tap leak,INR,70,0%,Low,5'].join('\n');
  it('finds the header under the title lines, reads whole numbers with commas, takes the later of a repeated keyword, and keeps competition only when it is Low, Medium or High', () => {
    const f = parseVolumeCsv(FILE); expect(f.problems).toEqual([]);
    expect(f.rows).toEqual([{ keyword: 'plumbers in chennai', volume: 1500, competition: 'LOW' }, { keyword: 'best plumbers in chennai', volume: 590, competition: 'HIGH' }, { keyword: 'plumbers near me', volume: 90, competition: 'MEDIUM' }, { keyword: 'tap leak', volume: 70, competition: 'LOW' }]);
    expect(f.duplicates).toBe(1);
  });
  it('a range, a blank and an odd keyword are skipped and listed with their row, never turned into a number', () => {
    const f = parseVolumeCsv(FILE);
    expect(f.skipped.map((s) => [s.row, s.reason.slice(0, 22)])).toEqual([[5, 'no whole number of mon'], [6, 'no whole number of mon'], [9, 'not an acceptable keyw']]);   // rows of the file, blank lines not counted
    expect(parseVolume('1K - 10K')).toBeNull(); expect(parseVolume('')).toBeNull(); expect(parseVolume('12.5')).toBeNull(); expect(parseVolume('-4')).toBeNull(); expect(parseVolume('1,234')).toBe(1234); expect(parseVolume(0)).toBe(0); expect(parseVolume('99999999999')).toBeNull();
    expect(parseCompetition('Low')).toBe('LOW'); expect(parseCompetition('0.45')).toBeNull(); expect(parseCompetition('')).toBeNull();
  });
  it('refuses a file with no Keyword column, no monthly searches column, or too many rows', () => {
    expect(parseVolumeCsv('a,b\n1,2\n').problems[0]).toMatch(/No header row/); expect(parseVolumeCsv('Keyword,Competition\nx,Low\n').problems[0]).toMatch(/No monthly searches column/);
    expect(parseVolumeCsv(`Keyword,Avg. monthly searches\n${Array.from({ length: MAX_VOLUME_ROWS + 1 }, (_v, i) => `k${i},1`).join('\n')}\n`).problems[0]).toMatch(/At most 50000/);
  });
  it('the list of skipped rows is capped', () => { expect(parseVolumeCsv(`Keyword,Volume\n${Array.from({ length: 200 }, () => 'x,abc').join('\n')}\n`).skipped).toHaveLength(MAX_REPORTED); });
});

describe('what an import does to the targets', () => {
  const target = (o: Partial<TargetRow> = {}): TargetRow => ({ id: 't1', keyword: 'plumbers in chennai', path: '/chennai/plumbers', pageType: 'cityCategory', status: 'PLANNED', priority: 2, titleOverride: null, descriptionOverride: null, h1Override: null, notes: null, source: 'STAFF', volume: null, competition: null, createdAt: new Date(0), updatedAt: new Date(0), ...o });
  const research = (rows: ResearchRow[]) => { const m = new Map<string, ResearchRow[]>(); for (const r of rows) m.set(r.keyword, [...(m.get(r.keyword) ?? []), r]); return m; };
  const R: ResearchRow[] = [{ keyword: 'best plumbers in chennai', path: '/chennai/plumbers', kind: 'modifier' }, { keyword: 'plumbers in adyar', path: '/chennai/plumbers-in-adyar', kind: 'place' }, { keyword: 'zero volume thing', path: '/chennai', kind: 'place' }];
  it('sets volume and competition on every target of a keyword; leaves competition alone when the file has none; unchanged rows are counted', () => {
    const file = [{ keyword: 'plumbers in chennai', volume: 1500, competition: 'LOW' as const }, { keyword: 'same', volume: 5, competition: null }];
    const p = planVolumeImport(file, [target(), target({ id: 't2', path: '/chennai', pageType: 'city', competition: 'HIGH' }), target({ id: 't3', keyword: 'same', volume: 5 })], research([]));
    expect(p.update).toEqual([{ id: 't1', patch: { volume: 1500, competition: 'LOW' } }, { id: 't2', patch: { volume: 1500, competition: 'LOW' } }]); expect(p.unchanged).toBe(1); expect(p.create).toEqual([]);
    expect(planVolumeImport([{ keyword: 'plumbers in chennai', volume: 7, competition: null }], [target({ competition: 'HIGH' })], research([])).update).toEqual([{ id: 't1', patch: { volume: 7 } }]);
  });
  it("one of OUR research keywords that is not a target yet becomes PLANNED targets with the volume, so the whole research list never has to be imported first; a volume of 0 creates nothing; a stranger is unmatched", () => {
    const p = planVolumeImport([{ keyword: 'best plumbers in chennai', volume: 590, competition: 'HIGH' }, { keyword: 'zero volume thing', volume: 0, competition: null }, { keyword: 'not ours at all', volume: 40, competition: null }], [], research(R));
    expect(p.create).toEqual([{ keyword: 'best plumbers in chennai', path: '/chennai/plumbers', pageType: 'cityCategory', status: 'PLANNED', priority: 2, titleOverride: null, descriptionOverride: null, h1Override: null, notes: null, source: 'PLAN', volume: 590, competition: 'HIGH' }]);
    expect(p.unmatched).toEqual(['not ours at all']); expect(p.unmatchedCount).toBe(1);
  });
});

describe('the targets carry volume and competition', () => {
  const base = { keyword: 'plumbers in chennai', path: '/chennai/plumbers' };
  it('a typed or CSV volume must be a whole number, competition one of three words; a range is refused', () => {
    expect(checkTarget({ ...base, volume: '1,300', competition: 'low' })).toMatchObject({ ok: true, value: { volume: 1300, competition: 'LOW' } });
    expect(checkTarget(base)).toMatchObject({ ok: true, value: { volume: null, competition: null } });
    expect(checkTarget({ ...base, volume: '1K - 10K' })).toMatchObject({ ok: false }); expect(checkTarget({ ...base, competition: 'sky high' })).toMatchObject({ ok: false });
  });
  it('the export carries both columns and re-imports unchanged; a blank cell never clears a stored volume', () => {
    const r: TargetRow = { ...checkTargetValue({ ...base, volume: 1300, competition: 'LOW', status: 'ACTIVE' }), id: 't1', createdAt: new Date(0), updatedAt: new Date(0) };
    const csv = targetsToCsv([r]); expect(csv.split('\n')[0]).toBe('keyword,path,status,priority,title,description,h1,notes,source,volume,competition'); expect(csv.split('\n')[1]).toMatch(/,1300,LOW$/);
    const key = `${r.keyword}\u0000${r.path}`; const again = planTargetImport(csv, new Map([[key, r]])); expect(again.problems).toEqual([]); expect(again.unchanged).toBe(1);
    expect(planTargetImport('keyword,path,volume\nplumbers in chennai,/chennai/plumbers,\n', new Map([[key, r]])).update).toEqual([]);
  });
});
function checkTargetValue(raw: Record<string, unknown>): TargetInput { const c = checkTarget(raw); if (!c.ok) throw new Error(c.problem); return c.value; }

// ─── the service over memory twins ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
class MemData extends SeoDirectoryData {
  async businesses() { return { items: [], total: 0 }; } async facets() { return { byLocation: new Map(), byCategory: new Map(), byPincode: new Map() }; } async businessBySlug() { return null; }
  async groupStats() { return STATS; } async indexableBusinesses() { return []; } async indexableBusinessMeta() { return { total: 0, newest: null }; } async publishedIndexableSites() { return { items: [], total: 0 }; }
  async serviceStats(): Promise<ServiceStat[]> { return [{ name: 'leak repair', categoryId: 'plm', locationId: 'per', count: 2 }, { name: 'leak repair', categoryId: 'plm', locationId: 'ady', count: 1 }, { name: 'tap fitting', categoryId: 'plm', locationId: 'per', count: 1 }]; }
  async profileNames(): Promise<ProfileName[]> { return [{ name: 'Ranjith Plumber', slug: 'ranjith-plumber', locationId: 'per' }]; }
}
class MemTargets extends SeoKeywordTargetStore {
  rows: TargetRow[] = []; writes = 0;
  async list(q: TargetListQuery) { return { items: this.rows.slice(q.skip, q.skip + q.take), total: this.rows.length }; } async all() { return [...this.rows]; } async get(id: string) { return this.rows.find((r) => r.id === id) ?? null; }
  async create() { return null; } async update() { return null; } async forPath() { return []; }
  async importApply(w: TargetImportWrite) { this.writes++; for (const t of w.create) this.rows.push({ ...t, id: `n${this.rows.length}`, createdAt: new Date(0), updatedAt: new Date(0) }); for (const u of w.update) this.rows = this.rows.map((r) => (r.id === u.id ? { ...r, ...u.patch } : r)); }
}
const audits: string[] = [];
function service() {
  const repo = { listLocations: async () => LOCS, listCategories: async () => CATS } as never; const directory = { get: async () => ({ ...DEFAULT_DIRECTORY_SETTINGS, directoryPagesIndexable: true }), readPublicAppUrl: async () => 'https://get4domain.com' } as never;
  const data = new MemData(); const keywords = new Kw(); const seo = { modifiers: async () => MODS, crawlers: async () => [] } as unknown as SeoSettingsService; const targets = new MemTargets(); const audit = { record: async (_a: unknown, action: string) => { audits.push(action); } };
  const sitemaps = new SeoSitemapService(data, repo, keywords, directory, seo);
  return { svc: new SeoKeywordResearchService(data, repo, keywords, sitemaps, seo, directory, targets, audit), targets };
}
beforeEach(() => { audits.length = 0; });

describe('the research service', () => {
  it('builds the list from the real services of the data port: the service and vendor rows are there, and the thin place is not', async () => {
    const p = await service().svc.plan();
    expect(p.counts.service).toBe(1); expect(kws(p, 'service')).toEqual(['leak repair in chennai']);   // 3 businesses offer it across Chennai; tap fitting has 1
    expect(kws(p, 'vendor')).toEqual(['ranjith plumber perambur', 'ranjith plumber chennai']); expect(p.rows.some((r) => /madurai/.test(r.keyword))).toBe(false);
  });
  it('the dry run counts only; the CSV and the Planner file have the same keywords', async () => {
    const { svc } = service(); const c = await svc.csv(); const p = await svc.plan();
    expect(c.total).toBe(p.total); expect(c.csv.trimEnd().split('\n')).toHaveLength(p.total + 1); expect(c.planner.startsWith('Keyword\n')).toBe(true);
  });
  it('an import is a dry run unless apply; one transaction; an audit row; and a second run changes nothing', async () => {
    const { svc, targets } = service(); const csv = 'Keyword Stats\nKeyword,Avg. monthly searches,Competition\nbest plumbers in chennai,590,High\nplumbers in adyar,"1,200",Low\nnot ours,40,Low\nplumbers near me,1K - 10K,Low\n';
    const dry = await svc.importVolumes(csv, { apply: false }, actor);
    expect(dry).toMatchObject({ applied: false, created: 2, updated: 0, unmatchedCount: 1, unmatched: ['not ours'], skippedCount: 1 }); expect(targets.rows).toHaveLength(0); expect(targets.writes).toBe(0);
    const done = await svc.importVolumes(csv, { apply: true }, actor);
    expect(done).toMatchObject({ applied: true, created: 2 }); expect(targets.writes).toBe(1); expect(audits).toEqual(['seo.keyword_target.volumes']);
    expect(targets.rows.map((r) => [r.keyword, r.path, r.volume, r.competition, r.status, r.source]).sort()).toEqual([['best plumbers in chennai', '/chennai/plumbers', 590, 'HIGH', 'PLANNED', 'PLAN'], ['plumbers in adyar', '/chennai/plumbers-in-adyar', 1200, 'LOW', 'PLANNED', 'PLAN']]);
    const again = await svc.importVolumes(csv, { apply: true }, actor); expect(again).toMatchObject({ applied: false, created: 0, updated: 0, unchanged: 2 }); expect(targets.writes).toBe(1);
  });
  it('a bad file writes nothing and says why', async () => {
    const { svc, targets } = service(); const r = await svc.importVolumes('nothing here\n', { apply: true }, actor);
    expect(r.applied).toBe(false); expect(r.problems[0]).toMatch(/No header row/); expect(targets.writes).toBe(0); expect(audits).toEqual([]);
  });
});

describe('routes, script and migration', () => {
  const read = (...p: string[]) => fs.readFileSync(path.resolve(__dirname, '..', ...p), 'utf8');
  it('the staff routes are behind AdminGuard; the settings route names the modifiers and the defaults', () => {
    const t = read('src/seo-directory/api/seo-targets-admin.controller.ts'); const a = read('src/seo-directory/api/seo-admin.controller.ts');
    for (const r of ["@Post('keyword-targets/import-volumes')", "@Get('keyword-plan/research')", "@Get('keyword-plan/research.csv')", "@Get('keyword-plan/planner.csv')"]) expect(t).toContain(r);
    expect(a).toContain("@Get('modifiers')"); expect(a).toContain("@Put('modifiers')"); expect(t).toMatch(/@UseGuards\(AdminGuard\)/);
  });
  it('the script is a dry run by default, reads the database and writes only two local files', () => {
    const s = read('scripts/seo-keyword-research.js');
    expect(s).toContain("args.includes('--apply')"); expect(s).toContain('DRY RUN (counts only, nothing written)'); expect(s).toContain('loadStagingEnv()');
    expect(s).not.toMatch(/\.(create|update|upsert|delete|deleteMany|createMany|importApply)\(|\$execute|\$transaction/); expect(s).toContain('keyword-planner-upload.csv');
  });
  it('the volume migration is additive: two nullable columns, two checks and an index, nothing dropped or updated', () => {
    const sql = read('prisma/migrations/20261218100000_v3_seo_keyword_volume/migration.sql').replace(/--.*$/gm, '');
    expect(sql).toContain('ADD COLUMN "volume" INTEGER'); expect(sql).toContain('ADD COLUMN "competition" TEXT'); expect(sql).toContain('CHECK ("volume" IS NULL OR "volume" >= 0)'); expect(sql).toContain("CHECK (\"competition\" IS NULL OR \"competition\" IN ('LOW', 'MEDIUM', 'HIGH'))");
    expect(sql).not.toMatch(/\bDROP\b|\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b|NOT NULL/i);
  });
});
