import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_DIRECTORY_SETTINGS } from '../src/directory/settings/directory-settings';
import { CategoryRow, LocationRow } from '../src/directory/directory.repository';
import { badgeEmbedHtml, badgeSvg } from '../src/seo-directory/core/badge';
import { anchorCandidates, BacklinkPage, buildBacklinkBlock, MAX_DIRECTORY_LINKS, stableHash } from '../src/seo-directory/core/backlink-block';
import { generateKeywordPlan } from '../src/seo-directory/core/keyword-plan';
import { checkTarget, csvCell, normalizeTargetPath, pickOverride, planTargetImport, TargetInput, TargetRow, targetKey, targetsToCsv } from '../src/seo-directory/core/keyword-target';
import { buildTrackedLink } from '../src/seo-directory/core/link-builder';
import { hasRankingClaim } from '../src/seo-directory/core/ranking-claims';
import { enumerateListingPaths, Stat } from '../src/seo-directory/core/sitemap';
import { UtmCardinalityGuard, utmVisitOf } from '../src/seo-directory/core/utm-capture';
import { SeoBacklinkService } from '../src/seo-directory/backlinks/seo-backlink.service';
import { SeoUtmService } from '../src/seo-directory/campaigns/seo-utm.service';
import { SeoUtmStore, UtmReportRow } from '../src/seo-directory/campaigns/seo-utm.store';
import { KeywordRow, SeoKeywordStore } from '../src/seo-directory/keywords/seo-keyword.store';
import { DbPageOverrides, SeoKeywordTargetService } from '../src/seo-directory/keywords/seo-keyword-target.service';
import { SeoKeywordTargetStore, TargetImportWrite, TargetListQuery } from '../src/seo-directory/keywords/seo-keyword-target.store';
import { loadPlaces } from '../src/seo-directory/pages/places';

const actor = { type: 'STAFF' as const, id: 'staff-1', ip: null };
const loc = (id: string, parentId: string | null, kind: LocationRow['kind'], name: string, slug: string, sortOrder = 0): LocationRow => ({ id, parentId, parentKey: parentId ?? 'ROOT', kind, name, slug, sortOrder, proposed: false, active: true });
const cat = (id: string, parentId: string | null, name: string, slug: string, sortOrder = 0): CategoryRow => ({ id, parentId, parentKey: parentId ?? 'ROOT', name, slug, themeCategoryId: null, family: null, sortOrder, proposed: false, active: true });
const LOCS = [loc('tn', null, 'STATE', 'Tamil Nadu', 'tamil-nadu'), loc('chn', 'tn', 'CITY', 'Chennai', 'chennai'), loc('per', 'chn', 'LOCALITY', 'Perambur', 'perambur'), loc('ady', 'chn', 'LOCALITY', 'Adyar', 'adyar'), loc('mdu', 'tn', 'CITY', 'Madurai', 'madurai')];
const CATS = [cat('fam', null, 'Home services', 'home-services'), cat('plm', 'fam', 'Plumber', 'plumber'), cat('ele', 'fam', 'Electrician', 'electrician', 1)];
const kwRow = (slug: string, name: string, plural: string, synonyms: string[] = []): KeywordRow => ({ id: `k-${slug}`, categorySlug: slug, name, singular: name.toLowerCase(), plural, synonyms, specialisations: [], source: 'DERIVED', updatedByStaffId: null, updatedAt: new Date(0) });
class Kw extends SeoKeywordStore {
  constructor(private readonly rows: KeywordRow[] = [kwRow('plumber', 'Plumber', 'plumbers', ['pipe fitter']), kwRow('electrician', 'Electrician', 'electricians')]) { super(); }
  async list() { return { items: [], total: 0 }; } async all() { return this.rows; } async get() { return null; } async upsertDerived() { /* none */ } async staffUpdate() { return null; }
}
const stat = (locationId: string | null, categoryId: string, count: number, pincode: string | null = null): Stat => ({ locationId, categoryId, count, pincode, lastmod: new Date('2026-11-01T00:00:00Z') });
const places = () => loadPlaces({ listLocations: async () => LOCS, listCategories: async () => CATS } as never, new Kw());
const listingOf = async (stats: Stat[], min = 3) => enumerateListingPaths(await places(), stats, min);

// ─── in-memory twins ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
class MemTargets extends SeoKeywordTargetStore {
  rows = new Map<string, TargetRow>(); seq = 0; importCalls = 0;
  private mk(t: TargetInput): TargetRow { const id = `t${++this.seq}`; const r: TargetRow = { ...t, id, createdAt: new Date(1_700_000_000_000 + this.seq * 1000), updatedAt: new Date(1_700_000_000_000 + this.seq * 1000) }; this.rows.set(id, r); return r; }
  async list(q: TargetListQuery) { const all = [...this.rows.values()].filter((r) => (!q.status || r.status === q.status) && (!q.path || r.path === q.path) && (!q.q || r.keyword.includes(q.q) || r.path.includes(q.q))); return { items: all.slice(q.skip, q.skip + q.take), total: all.length }; }
  async all(status?: string) { return [...this.rows.values()].filter((r) => !status || r.status === status).sort((a, b) => (a.path + a.keyword < b.path + b.keyword ? -1 : 1)); }
  async get(id: string) { return this.rows.get(id) ?? null; }
  async create(t: TargetInput) { if ([...this.rows.values()].some((r) => r.keyword === t.keyword && r.path === t.path)) return null; return this.mk(t); }
  async update(id: string, patch: Partial<TargetInput>) { const h = this.rows.get(id); if (!h) return null; const n = { ...h, ...patch, updatedAt: new Date() }; this.rows.set(id, n); return n; }
  async forPath(p: string) { return [...this.rows.values()].filter((r) => r.path === p); }
  async importApply(w: TargetImportWrite) { this.importCalls++; for (const t of w.create) this.mk(t); for (const u of w.update) await this.update(u.id, u.patch); }
}
class MemUtm extends SeoUtmStore {
  rows = new Map<string, UtmReportRow>(); failNext = false;
  async increment(day: string, v: { pageType: string; source: string; medium: string; campaign: string; keywordKey: string }) {
    if (this.failNext) { this.failNext = false; throw new Error('database down'); }
    const k = JSON.stringify([day, v]); const h = this.rows.get(k); this.rows.set(k, { day, ...v, count: (h?.count ?? 0) + 1 });
  }
  async report(q: { from: string; to: string; skip: number; take: number }) { const all = [...this.rows.values()].filter((r) => r.day >= q.from && r.day <= q.to); return { items: all.slice(q.skip, q.skip + q.take), total: all.length }; }
}
const audits: Array<{ action: string; before: unknown; after: unknown }> = [];
const memAudit = { record: async (_a: unknown, action: string, _t: string, _id: string | null, before: unknown, after: unknown) => { audits.push({ action, before, after }); } };

function service(listing: Awaited<ReturnType<typeof listingOf>> = []) {
  const store = new MemTargets(); const overrides = new DbPageOverrides(store);
  const svc = new SeoKeywordTargetService(store, memAudit as never, { listing: async () => listing } as never, new Kw(), { readPublicAppUrl: async () => 'https://www.get4domain.com', get: async () => DEFAULT_DIRECTORY_SETTINGS } as never, overrides);
  return { svc, store, overrides };
}
beforeEach(() => { audits.length = 0; });

// ─── paths and single targets ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('the page path of a target', () => {
  it('accepts a directory page at page 1 and tells the kind of page', () => {
    expect(normalizeTargetPath('/Chennai/Plumbers/')).toEqual({ path: '/chennai/plumbers', pageType: 'cityCategory' });
    expect(normalizeTargetPath('/chennai/plumbers-in-adyar?utm_source=x#top')).toEqual({ path: '/chennai/plumbers-in-adyar', pageType: 'localityCategory' });
    expect(normalizeTargetPath('/category/plumber')?.pageType).toBe('category');
    expect(normalizeTargetPath('/pincode/600011/plumber')?.pageType).toBe('pincodeCategory');
    expect(normalizeTargetPath('/state/tamil-nadu')?.pageType).toBe('state');
    expect(normalizeTargetPath('/chennai')?.pageType).toBe('city');
    expect(normalizeTargetPath('/')?.pageType).toBe('home');
  });
  it('refuses a later page, a host, a protocol-relative address, whitespace, a reserved first segment and nonsense', () => {
    for (const bad of ['/chennai/plumbers/page/2', 'https://get4domain.com/chennai', '//evil.com/chennai', '/chen nai', '/admin/x', 'chennai', '', '/a/b/c/d', '/chennai\\x', null, 12]) expect(normalizeTargetPath(bad as never)).toBeNull();
  });
});

describe('checking one target', () => {
  const ok = { keyword: 'Plumbers  in Chennai', path: '/chennai/plumbers' };
  it('takes the defaults: PLANNED, priority 2, source STAFF, no texts', () => {
    const r = checkTarget(ok); expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ keyword: 'plumbers in chennai', path: '/chennai/plumbers', pageType: 'cityCategory', status: 'PLANNED', priority: 2, titleOverride: null, descriptionOverride: null, h1Override: null, notes: null, source: 'STAFF', volume: null, competition: null });
  });
  it.each([
    [{ ...ok, keyword: '' }, /keyword/], [{ ...ok, keyword: 'plumbers <b>' }, /keyword/], [{ ...ok, keyword: 'plumbers from ₹499' }, /keyword/],
    [{ ...ok, path: '/chennai/plumbers/page/2' }, /path/], [{ ...ok, status: 'LIVE' }, /status/], [{ ...ok, priority: 4 }, /priority/], [{ ...ok, priority: 1.5 }, /priority/], [{ ...ok, source: 'WEB' }, /source/],
    [{ ...ok, titleOverride: 'x'.repeat(61) }, /titleOverride/], [{ ...ok, descriptionOverride: 'x'.repeat(161) }, /descriptionOverride/], [{ ...ok, h1Override: '<script>' }, /h1Override/],
    [{ ...ok, titleOverride: 'Best plumbers in Chennai' }, /ranking/], [{ ...ok, descriptionOverride: 'Plumbers ranked first in Chennai.' }, /ranking/], [{ ...ok, titleOverride: 'Plumbers from Rs 499' }, /titleOverride/], [{ ...ok, notes: 'LeadSpace plan' }, /notes/],
  ])('refuses %j', (input, why) => { const r = checkTarget(input); expect(r.ok).toBe(false); if (!r.ok) expect(r.problem).toMatch(why); });
  it('the ranking-claim rule catches promises and leaves ordinary words alone', () => {
    for (const t of ['best plumbers', 'Top rated', '#1 plumber', 'number one in Chennai', 'guaranteed results', 'ranked first', 'rank higher', 'the leading firm', 'cheapest in town']) expect(hasRankingClaim(t)).toBe(true);
    for (const t of ['Plumbers in Chennai', 'Frank Plumbing', 'Stop-leak repair', 'Hilltop Road', 'Find a plumber in Adyar', 'Rankin Street']) expect(hasRankingClaim(t)).toBe(false);
  });
});

describe('which override a page uses', () => {
  const t = (id: string, status: TargetRow['status'], priority: number, at: number, title: string | null = null): Parameters<typeof pickOverride>[0][number] => ({ id, status, priority, createdAt: new Date(at), titleOverride: title, descriptionOverride: null, h1Override: null });
  it('ignores PLANNED and PAUSED, takes the lowest priority number, then the oldest', () => {
    expect(pickOverride([t('a', 'PLANNED', 1, 1, 'A'), t('b', 'PAUSED', 1, 2, 'B')])).toBeNull();
    expect(pickOverride([t('late', 'ACTIVE', 1, 9, 'Late'), t('early', 'ACTIVE', 1, 1, 'Early'), t('low', 'ACTIVE', 3, 0, 'Low')])).toEqual({ id: 'early', title: 'Early', description: null, h1: null });
  });
  it('keeps the best target for the click attribution but takes the text from the best one that has any', () => {
    expect(pickOverride([t('first', 'ACTIVE', 1, 1), t('second', 'ACTIVE', 2, 2, 'Second title')])).toEqual({ id: 'first', title: 'Second title', description: null, h1: null });
  });
});

// ─── CSV ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('CSV import', () => {
  const head = 'keyword,path,status,priority,title,description,h1,notes,source\n';
  const none = new Map<string, TargetRow>();
  const existing = (rows: TargetRow[]) => new Map(rows.map((r) => [targetKey(r.keyword, r.path), r]));
  const row = (o: Partial<TargetRow> = {}): TargetRow => ({ id: 't1', keyword: 'plumbers in chennai', path: '/chennai/plumbers', pageType: 'cityCategory', status: 'PLANNED', priority: 2, titleOverride: null, descriptionOverride: null, h1Override: null, notes: null, source: 'STAFF', volume: null, competition: null, createdAt: new Date(0), updatedAt: new Date(0), ...o });

  it('creates rows, and the minimum file has only keyword and path', () => {
    const p = planTargetImport('keyword,path\nPlumbers in Chennai,/chennai/plumbers\nplumber in adyar,/chennai/plumbers-in-adyar\n', none);
    expect(p.problems).toEqual([]); expect(p.total).toBe(2); expect(p.create.map((c) => [c.keyword, c.path, c.status, c.priority])).toEqual([['plumbers in chennai', '/chennai/plumbers', 'PLANNED', 2], ['plumber in adyar', '/chennai/plumbers-in-adyar', 'PLANNED', 2]]);
  });
  it('is idempotent: the same file against what it created is all unchanged', () => {
    const csv = `${head}plumbers in chennai,/chennai/plumbers,ACTIVE,1,Plumbers in Chennai,,,note,STAFF\n`;
    const first = planTargetImport(csv, none); expect(first.create).toHaveLength(1);
    const stored = row({ ...first.create[0] });
    const second = planTargetImport(csv, existing([stored])); expect(second.create).toEqual([]); expect(second.update).toEqual([]); expect(second.unchanged).toBe(1);
  });
  it('updates only the columns that are filled, and a blank cell never clears a value', () => {
    const stored = row({ status: 'ACTIVE', priority: 1, titleOverride: 'Kept title', notes: 'old note' });
    const p = planTargetImport(`${head}plumbers in chennai,/chennai/plumbers,PAUSED,,,,,,\n`, existing([stored]));
    expect(p.update).toEqual([{ id: 't1', patch: { status: 'PAUSED' } }]);   // title, priority and notes were blank: kept
  });
  it('reports every bad row with its line number and blocks nothing by itself (the caller refuses to apply)', () => {
    const p = planTargetImport(`${head}plumbers,/chennai/plumbers,LIVE,,,,,,\n,/chennai,,,,,,,\nok words,/chennai/plumbers/page/2,,,,,,,\nplumbers,/chennai/plumbers,,,,,,,\nplumbers,/chennai/plumbers,,,,,,,\n`, none);
    expect(p.problems.map((x) => x.split(':')[0])).toEqual(['Row 2', 'Row 3', 'Row 4', 'Row 6']);
    expect(p.problems[3]).toMatch(/appears twice/);
  });
  it('refuses a file without keyword and path, with an unknown column, empty, or over the row cap', () => {
    expect(planTargetImport('', none).problems[0]).toMatch(/empty/);
    expect(planTargetImport('keyword\nx\n', none).problems.join(' ')).toMatch(/keyword and path/);
    expect(planTargetImport('keyword,path,rank\nx,/chennai,1\n', none).problems.join(' ')).toMatch(/Unknown column: rank/);
    const many = `keyword,path\n${Array.from({ length: 5001 }, (_v, i) => `k${i},/chennai`).join('\n')}\n`;
    expect(planTargetImport(many, none).problems[0]).toMatch(/At most 5000/);
  });
  it('quoted cells with commas, quotes and line breaks survive; a formula-looking cell is guarded on the way out and restored on the way in', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)"); expect(csvCell('+1')).toBe("'+1"); expect(csvCell('a,"b"')).toBe('"a,""b"""'); expect(csvCell(null)).toBe(''); expect(csvCell(3)).toBe('3');
    const r = row({ notes: '=HYPERLINK("x")', titleOverride: 'Plumbers, Chennai' });
    const csv = targetsToCsv([r]); expect(csv).not.toMatch(/,=HYPERLINK/); expect(csv.split('\n')[1]).toContain("'=HYPERLINK");
    const back = planTargetImport(csv, none); expect(back.problems).toEqual([]); expect(back.create[0].titleOverride).toBe('Plumbers, Chennai');
    expect(back.create[0].notes).toBe('=HYPERLINK("x")'.replace(/\s+/g, ' '));
  });
  it('an export imports back unchanged', () => {
    const rows = [row({ status: 'ACTIVE', priority: 1, titleOverride: 'Plumbers in Chennai' }), row({ id: 't2', keyword: 'plumber in chennai', priority: 2, source: 'PLAN' })];
    const p = planTargetImport(targetsToCsv(rows), existing(rows)); expect(p.problems).toEqual([]); expect(p.unchanged).toBe(2); expect(p.create).toEqual([]); expect(p.update).toEqual([]);
  });
});

describe('the keyword targets service', () => {
  it('creates a target with an audit row, refuses a second one for the same keyword and page with SEO_DUPLICATE', async () => {
    const { svc } = service();
    const a = await svc.create({ keyword: 'plumbers in chennai', path: '/chennai/plumbers' }, actor); expect(a.status).toBe('PLANNED');
    await expect(svc.create({ keyword: 'Plumbers in Chennai', path: '/chennai/plumbers/' }, actor)).rejects.toMatchObject({ response: { code: 'SEO_DUPLICATE' } });
    expect(audits.map((x) => x.action)).toEqual(['seo.keyword_target.create']);
  });
  it('refuses a bad target with SEO_INVALID and the reason', async () => {
    const { svc } = service();
    await expect(svc.create({ keyword: 'plumbers', path: '/nope/x/y/z' }, actor)).rejects.toMatchObject({ response: { code: 'SEO_INVALID', message: expect.stringMatching(/path/) } });
  });
  it('edits status and texts, clears a text with an empty string, and never lets the keyword or page change', async () => {
    const { svc } = service();
    const t = await svc.create({ keyword: 'plumbers in chennai', path: '/chennai/plumbers' }, actor);
    const a = await svc.update(t.id, { status: 'ACTIVE', priority: 1, titleOverride: 'Plumbers in Chennai' }, actor); expect([a.status, a.priority, a.titleOverride]).toEqual(['ACTIVE', 1, 'Plumbers in Chennai']);
    const b = await svc.update(t.id, { titleOverride: '' }, actor); expect(b.titleOverride).toBeNull(); expect(b.status).toBe('ACTIVE');
    await expect(svc.update(t.id, { path: '/chennai/electricians' }, actor)).rejects.toMatchObject({ response: { code: 'SEO_INVALID' } });
    await expect(svc.update(t.id, { keyword: 'other words' }, actor)).rejects.toMatchObject({ response: { code: 'SEO_INVALID' } });
    await expect(svc.update(t.id, { titleOverride: 'Best plumbers' }, actor)).rejects.toMatchObject({ response: { code: 'SEO_INVALID' } });
    await expect(svc.update('nope', { status: 'ACTIVE' }, actor)).rejects.toMatchObject({ response: { code: 'SEO_NOT_FOUND' } });
    expect(audits.filter((x) => x.action === 'seo.keyword_target.update')).toHaveLength(2);
  });
  it('an import is a dry run unless apply is true, and writes nothing when any row has a problem', async () => {
    const { svc, store } = service();
    const good = 'keyword,path,status\nplumbers in chennai,/chennai/plumbers,ACTIVE\n';
    const dry = await svc.importCsv(good, { apply: false }, actor); expect(dry.applied).toBe(false); expect(dry.create).toHaveLength(1); expect(store.rows.size).toBe(0); expect(store.importCalls).toBe(0);
    const blocked = await svc.importCsv(`${good}x,/bad/bad/bad/bad\n`, { apply: true }, actor); expect(blocked.applied).toBe(false); expect(blocked.problems).toHaveLength(1); expect(store.rows.size).toBe(0);
    const done = await svc.importCsv(good, { apply: true }, actor); expect(done.applied).toBe(true); expect(store.rows.size).toBe(1); expect(audits.map((x) => x.action)).toEqual(['seo.keyword_target.import']);
    const again = await svc.importCsv(good, { apply: true }, actor); expect(again.applied).toBe(false); expect(again.unchanged).toBe(1); expect(store.importCalls).toBe(1);
  });
  it('the exported CSV of the stored rows re-imports as unchanged', async () => {
    const { svc } = service();
    await svc.create({ keyword: 'plumbers in chennai', path: '/chennai/plumbers', status: 'ACTIVE', titleOverride: 'Plumbers in Chennai' }, actor);
    const csv = await svc.exportCsv(); const r = await svc.importCsv(csv, { apply: false }, actor); expect(r.problems).toEqual([]); expect(r.unchanged).toBe(1);
  });
  it('builds a tracked link, and a keyword target id must exist and be for the same page', async () => {
    const { svc } = service();
    const t = await svc.create({ keyword: 'plumbers in chennai', path: '/chennai/plumbers' }, actor);
    expect(await svc.link({ path: '/chennai/plumbers', source: 'newsletter', medium: 'email', campaign: 'nov-launch', keywordTargetId: t.id })).toEqual({ path: '/chennai/plumbers', url: `https://get4domain.com/chennai/plumbers?utm_source=newsletter&utm_medium=email&utm_campaign=nov-launch&kw=${t.id}` });
    await expect(svc.link({ path: '/chennai/plumbers', source: 'a', medium: 'b', campaign: 'c', keywordTargetId: 'missing' })).rejects.toMatchObject({ response: { code: 'SEO_INVALID' } });
    await expect(svc.link({ path: '/chennai/electricians', source: 'a', medium: 'b', campaign: 'c', keywordTargetId: t.id })).rejects.toMatchObject({ response: { code: 'SEO_INVALID' } });
    await expect(svc.link({ path: '/chennai/plumbers', source: 'Has Space', medium: 'b', campaign: 'c' })).rejects.toMatchObject({ response: { code: 'SEO_INVALID' } });
  });
});

describe('page overrides', () => {
  it('an ACTIVE target gives the page its texts and its id; PLANNED gives nothing; a write drops the cache at once', async () => {
    const { svc, overrides } = service();
    const t = await svc.create({ keyword: 'plumbers in chennai', path: '/chennai/plumbers', titleOverride: 'Plumbers in Chennai' }, actor);
    expect(await overrides.forPath('/chennai/plumbers')).toBeNull();
    await svc.update(t.id, { status: 'ACTIVE' }, actor);
    expect(await overrides.forPath('/chennai/plumbers')).toEqual({ title: 'Plumbers in Chennai', description: null, h1: null, keywordTargetId: t.id });
    await svc.update(t.id, { status: 'PAUSED' }, actor);
    expect(await overrides.forPath('/chennai/plumbers')).toBeNull();
  });
  it('is cached for a minute so a render adds no query, and the cache is bounded', async () => {
    const store = new MemTargets(); let reads = 0; const orig = store.forPath.bind(store); store.forPath = async (p: string) => { reads++; return orig(p); };
    const o = new DbPageOverrides(store); let now = 0; o.clock = () => now;
    await o.forPath('/a'); await o.forPath('/a'); expect(reads).toBe(1); now = 61_000; await o.forPath('/a'); expect(reads).toBe(2);
  });
});

// ─── the keyword plan ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('the keyword plan generator', () => {
  const stats = [stat('per', 'plm', 4, '600011'), stat('ady', 'plm', 3, '600020'), stat('per', 'ele', 3), stat('mdu', 'plm', 1)];
  it('proposes plural, singular and staff synonyms for each listed city + category and locality + category page, and nothing for thin pages', async () => {
    const synonyms = new Map([['plumber', ['pipe fitter']]]);
    const plan = generateKeywordPlan(await listingOf(stats), { synonyms });
    const by = (p: string) => plan.rows.filter((r) => r.path === p).map((r) => [r.keyword, r.priority]);
    expect(by('/chennai/plumbers')).toEqual([['plumbers in chennai', 1], ['plumber in chennai', 2], ['pipe fitter in chennai', 3]]);
    expect(by('/chennai/plumbers-in-adyar')).toEqual([['plumbers in adyar', 1], ['plumber in adyar', 2], ['pipe fitter in adyar', 3]]);
    expect(by('/chennai/electricians')).toEqual([['electricians in chennai', 1], ['electrician in chennai', 2]]);
    expect(plan.rows.some((r) => r.path.startsWith('/madurai'))).toBe(false);   // one business: thin
    expect(plan.rows.some((r) => ['/chennai', '/category/plumber', '/state/tamil-nadu'].includes(r.path) || r.path.startsWith('/pincode'))).toBe(false);
    expect(plan.rows.every((r) => r.status === 'PLANNED' && r.source === 'PLAN' && r.titleOverride === null)).toBe(true);
    expect(plan.truncated).toBe(false);
  });
  it('is deterministic and sorted by path', async () => {
    const a = generateKeywordPlan(await listingOf(stats)); const b = generateKeywordPlan(await listingOf([...stats].reverse()));
    expect(a.rows).toEqual(b.rows); expect(a.rows.map((r) => r.path)).toEqual([...a.rows.map((r) => r.path)].sort());
  });
  it('stops at the cap and says so', async () => { const plan = generateKeywordPlan(await listingOf(stats), { max: 4 }); expect(plan.rows).toHaveLength(4); expect(plan.truncated).toBe(true); });
  it('the exported plan imports as PLANNED rows with no problems, and importing it twice changes nothing', async () => {
    const { svc, store } = service(await listingOf(stats));
    const plan = await svc.plan(); expect(plan.csv.split('\n')[0]).toBe('keyword,path,status,priority,title,description,h1,notes,source,volume,competition');
    const first = await svc.importCsv(plan.csv, { apply: true }, actor); expect(first.problems).toEqual([]); expect(store.rows.size).toBe(plan.rows.length);
    expect([...store.rows.values()].every((r) => r.status === 'PLANNED' && r.source === 'PLAN')).toBe(true);
    const second = await svc.importCsv(plan.csv, { apply: true }, actor); expect(second.applied).toBe(false); expect(second.unchanged).toBe(plan.rows.length);
  });
  it('a plan changes no page: nothing is ACTIVE', async () => {
    const { svc, overrides } = service(await listingOf(stats)); await svc.importCsv((await svc.plan()).csv, { apply: true }, actor);
    expect(await overrides.forPath('/chennai/plumbers')).toBeNull();
  });
});

// ─── link builder and UTM capture ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('the link builder', () => {
  it('uses the canonical host (no www) and lower-cases the tokens', () => {
    expect(buildTrackedLink('https://www.get4domain.com/', { path: '/Chennai/Plumbers', source: 'WhatsApp', medium: 'Social', campaign: 'Diwali_26' })).toEqual({ ok: true, path: '/chennai/plumbers', url: 'https://get4domain.com/chennai/plumbers?utm_source=whatsapp&utm_medium=social&utm_campaign=diwali_26' });
    expect(buildTrackedLink('https://get4domain.com', { path: '/', source: 'a', medium: 'b', campaign: 'c' })).toMatchObject({ ok: true, url: 'https://get4domain.com/?utm_source=a&utm_medium=b&utm_campaign=c' });
  });
  it('refuses free text, URLs, a later page and a missing site address, so nothing but a short token can enter a link', () => {
    const base = { path: '/chennai', source: 'a', medium: 'b', campaign: 'c' };
    for (const bad of [{ source: 'a b' }, { medium: 'x'.repeat(31) }, { campaign: 'https://evil.com' }, { source: '' }, { campaign: '<script>' }, { path: '/chennai/page/2' }, { path: 'https://evil.com/' }, { keywordTargetId: 'a b' }]) expect(buildTrackedLink('https://get4domain.com', { ...base, ...bad }).ok).toBe(false);
    expect(buildTrackedLink('nonsense', base).ok).toBe(false);
  });
});

describe('UTM capture', () => {
  it('reduces a visit to page type, three tokens and a target id; a visit with no campaign information is not recorded', () => {
    expect(utmVisitOf({ path: '/chennai/plumbers?x=1', utm_source: 'News', utm_medium: 'email', utm_campaign: 'nov', kw: 'abc_123' })).toEqual({ pageType: 'cityCategory', source: 'news', medium: 'email', campaign: 'nov', keywordKey: 'abc_123' });
    expect(utmVisitOf({ path: '/chennai/plumbers' })).toBeNull(); expect(utmVisitOf({ path: '/chennai/plumbers', utm_source: '' })).toBeNull();
    expect(utmVisitOf({ path: '/chennai/plumbers', kw: 'abc' })).toMatchObject({ keywordKey: 'abc', source: '' });
  });
  it('a page 2 counts as its base page type; a path that is not a directory page, and invented values, are dropped', () => {
    expect(utmVisitOf({ path: '/chennai/plumbers-in-adyar/page/3', utm_source: 'a' })?.pageType).toBe('localityCategory');
    expect(utmVisitOf({ path: '/dashboard/x', utm_source: 'a' })).toBeNull(); expect(utmVisitOf({ path: 'https://evil.com', utm_source: 'a' })).toBeNull();
    expect(utmVisitOf({ path: '/chennai', utm_source: 'https://evil.com', utm_medium: 'x'.repeat(31), utm_campaign: 'Has Space', kw: '<x>' })).toBeNull();
    expect(utmVisitOf({ path: '/chennai', utm_source: 'ok', utm_medium: 'x'.repeat(31), utm_campaign: '<script>' })).toEqual({ pageType: 'city', source: 'ok', medium: '', campaign: '', keywordKey: '' });
    expect(utmVisitOf({ path: '/chennai', utm_source: ['a'] as never })).toBeNull();
  });
  it('the cardinality guard folds new combinations into "other" past the cap, per day', () => {
    const g = new UtmCardinalityGuard(2); const v = (c: string) => ({ pageType: 'city', source: 's', medium: 'm', campaign: c, keywordKey: '' });
    expect(g.apply('2026-11-01', v('a')).campaign).toBe('a'); expect(g.apply('2026-11-01', v('b')).campaign).toBe('b');
    expect(g.apply('2026-11-01', v('c'))).toEqual({ pageType: 'city', source: 'other', medium: 'other', campaign: 'other', keywordKey: '' });
    expect(g.apply('2026-11-01', v('a')).campaign).toBe('a');   // a combination already counted today still counts as itself
    expect(g.apply('2026-11-02', v('c')).campaign).toBe('c');   // a new day starts clean
  });
  it('the service counts campaign visits, ignores the rest, and never throws when the write fails', async () => {
    const store = new MemUtm(); const svc = new SeoUtmService(store); svc.clock = () => new Date('2026-11-14T10:00:00Z');
    expect(await svc.record({ path: '/chennai/plumbers' })).toBe(false); expect(store.rows.size).toBe(0);
    expect(await svc.record({ path: '/chennai/plumbers', utm_source: 'news', utm_medium: 'email', utm_campaign: 'nov' })).toBe(true);
    expect(await svc.record({ path: '/chennai/plumbers', utm_source: 'news', utm_medium: 'email', utm_campaign: 'nov' })).toBe(true);
    expect([...store.rows.values()]).toEqual([{ day: '2026-11-14', pageType: 'cityCategory', source: 'news', medium: 'email', campaign: 'nov', keywordKey: '', count: 2 }]);
    store.failNext = true; expect(await svc.record({ path: '/chennai', utm_source: 'x' })).toBe(false);
  });
  it('keeps no personal data: the aggregate has no address, agent, referrer, business or visitor, in the key, the rows or the table', async () => {
    const store = new MemUtm(); const svc = new SeoUtmService(store);
    await svc.record({ path: '/chennai', utm_source: 'news', ip: '198.51.100.9', userAgent: 'x', referrer: 'https://r.example/' } as never);
    expect(JSON.stringify([...store.rows.values()])).not.toMatch(/198\.51|referrer|userAgent|r\.example/);
    const schema = fs.readFileSync(path.resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
    const model = schema.slice(schema.indexOf('model V3SeoUtmDaily'), schema.indexOf('@@map("g4d_seo_utm_daily")'));
    expect(model).not.toMatch(/\b(ip|ipHash|userAgent|ua|referrer|referer|businessId|vendorId|email|phone|visitor|session|cookie)\b/i);
  });
  it('the staff report defaults to the last 30 days and refuses a reversed range', async () => {
    const store = new MemUtm(); const svc = new SeoUtmService(store); svc.clock = () => new Date('2026-11-14T10:00:00Z');
    store.rows.set('a', { day: '2026-11-10', pageType: 'city', source: 's', medium: '', campaign: '', keywordKey: '', count: 5 }); store.rows.set('b', { day: '2026-09-01', pageType: 'city', source: 's', medium: '', campaign: '', keywordKey: '', count: 9 });
    expect((await svc.report({ skip: 0, take: 10 })).items.map((r) => r.day)).toEqual(['2026-11-10']);
    await expect(svc.report({ from: '2026-11-14', to: '2026-11-01', skip: 0, take: 10 })).rejects.toMatchObject({ response: { code: 'SEO_INVALID' } });
  });
});

// ─── backlink block and badge ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('the backlink block', () => {
  const pages: BacklinkPage[] = [
    { kind: 'city', path: '/chennai', place: 'Chennai' },
    { kind: 'category', path: '/category/plumber', plural: 'Plumbers', singular: 'Plumber' },
    { kind: 'localityCategory', path: '/chennai/plumbers-in-perambur', place: 'Perambur', city: 'Chennai', plural: 'Plumbers', singular: 'Plumber' },
    { kind: 'cityCategory', path: '/chennai/plumbers', place: 'Chennai', plural: 'Plumbers', singular: 'Plumber' },
    { kind: 'nearbyLocality', path: '/chennai/plumbers-in-adyar', place: 'Adyar', city: 'Chennai', plural: 'Plumbers', singular: 'Plumber' },
  ];
  const build = (seed: string, over: Partial<Parameters<typeof buildBacklinkBlock>[0]> = {}) => buildBacklinkBlock({ origin: 'https://get4domain.com', seed, pages, listed: null, indexable: true, ...over });

  it('has one brand link and up to four directory links: the locality page, the city page, a nearby locality, the city; the bare category page only with room left', () => {
    const b = build('biz-1');
    expect(b.brand).toEqual({ href: 'https://get4domain.com/', text: 'Get4Domain' });
    expect(b.links.map((l) => l.href)).toEqual(['https://get4domain.com/chennai/plumbers-in-perambur', 'https://get4domain.com/chennai/plumbers', 'https://get4domain.com/chennai/plumbers-in-adyar', 'https://get4domain.com/chennai']);
    expect(build('biz-1', { pages: pages.filter((p) => p.kind !== 'nearbyLocality') }).links.map((l) => l.href)).toEqual(['https://get4domain.com/chennai/plumbers-in-perambur', 'https://get4domain.com/chennai/plumbers', 'https://get4domain.com/chennai', 'https://get4domain.com/category/plumber']);
    expect(MAX_DIRECTORY_LINKS).toBe(4);
  });
  it('never has more than four directory links, however many pages qualify, and the links are plain follow links', () => {
    const many: BacklinkPage[] = [...pages, { kind: 'cityCategory', path: '/madurai/plumbers', place: 'Madurai', plural: 'Plumbers', singular: 'Plumber' }, { kind: 'category', path: '/category/other', plural: 'Others', singular: 'Other' }];
    const b = build('x', { pages: many }); expect(b.links).toHaveLength(4); expect(b.html).not.toMatch(/nofollow|sponsored|ugc/i);
  });
  it('different businesses get a different nearby neighbour, so thousands of sites do not all link the same one', () => {
    const extra: BacklinkPage[] = [{ kind: 'nearbyLocality', path: '/chennai/plumbers-in-anna-nagar', place: 'Anna Nagar', city: 'Chennai', plural: 'Plumbers', singular: 'Plumber' }, { kind: 'nearbyLocality', path: '/chennai/plumbers-in-t-nagar', place: 'T Nagar', city: 'Chennai', plural: 'Plumbers', singular: 'Plumber' }];
    const near = (i: number) => build(`b${i}`, { pages: [...pages, ...extra] }).links.map((l) => l.href).find((h) => /in-(adyar|anna-nagar|t-nagar)$/.test(h));
    expect(new Set(Array.from({ length: 40 }, (_v, i) => near(i))).size).toBe(3);
  });
  it('the anchor wordings include the ones the owner asked for', () => {
    const texts = new Set(Array.from({ length: 80 }, (_v, i) => build(`b${i}`).links.map((l) => l.text)).flat());
    expect(texts.has('Plumbers in Perambur, Chennai')).toBe(true); expect(texts.has('Find more Plumbers in Chennai on Get4Domain')).toBe(true); expect(texts.has('Perambur Plumber directory')).toBe(true);
  });
  it('the anchor is stable for one business and rotates across businesses', () => {
    expect(build('biz-1').links).toEqual(build('biz-1').links);
    const wordings = new Set(Array.from({ length: 60 }, (_v, i) => build(`biz-${i}`).links[0].text));
    expect(wordings.size).toBeGreaterThanOrEqual(3);   // four honest wordings exist for a city + category page
    expect(build('biz-1', { period: '2026-11' }).links.length).toBe(4);
  });
  it('the period changes the wording over time when one is given', () => {
    const seen = new Set(Array.from({ length: 24 }, (_v, i) => build('biz-1', { period: `2026-${i}` }).links[0].text)); expect(seen.size).toBeGreaterThan(1);
  });
  it('no anchor, for any business, claims a rank, names a price or carries markup', () => {
    for (let i = 0; i < 200; i++) for (const l of build(`b${i}`).links) { expect(hasRankingClaim(l.text)).toBe(false); expect(l.text).not.toMatch(/[<>₹]/); }
    for (const p of pages) expect(anchorCandidates(p).length).toBeGreaterThan(1);
  });
  it('drops a candidate wording that would claim a rank (a place called Top Slip loses only that wording)', () => {
    const odd: BacklinkPage = { kind: 'cityCategory', path: '/top-slip/plumbers', place: 'Top Slip', plural: 'Plumbers', singular: 'Plumber' };
    expect(anchorCandidates(odd)).toEqual([]);
    expect(build('x', { pages: [odd] }).links).toEqual([]);
  });
  it('lists only pages that are listed, and only while the directory pages are indexable', () => {
    expect(build('x', { listed: new Set(['/chennai']) }).links.map((l) => l.href)).toEqual(['https://get4domain.com/chennai']);
    const off = build('x', { indexable: false }); expect(off.links).toEqual([]); expect(off.brand.text).toBe('Get4Domain'); expect(off.html).toContain('Listed on');
  });
  it('the HTML escapes every value and has no script, style or tracking', () => {
    const hostile: BacklinkPage = { kind: 'category', path: '/category/x"><script>', plural: '<b>"Tags"</b>', singular: 'Tag' };
    const html = build('x', { pages: [hostile], origin: 'https://get4domain.com' }).html;
    expect(html).not.toMatch(/<script|<b>|" onerror/i); expect(html).toContain('&lt;b&gt;'); expect(html).toMatch(/^<p class="g4d-backlinks">Listed on <a href="https:\/\/get4domain\.com\/" rel="noopener">Get4Domain<\/a>/);
  });
  it('the hash is stable', () => { expect(stableHash('abc')).toBe(stableHash('abc')); expect(stableHash('abc')).not.toBe(stableHash('abd')); });
});

describe('the badge', () => {
  it('is fixed text: no business name, number, rating or claim of rank', () => {
    const svg = badgeSvg();
    expect(svg).toContain('Listed on Get4Domain'); expect(svg).not.toMatch(/<script|<style|href=|onload|\d+\s*(star|review)/i); expect(hasRankingClaim(svg.replace(/<[^>]+>/g, ' '))).toBe(false);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  });
  it('the embed snippet links to the profile and escapes its values', () => {
    const html = badgeEmbedHtml({ origin: 'https://get4domain.com', apiBase: 'https://api.get4domain.com/', businessId: 'b1', slug: 'ranjith-plumber' });
    expect(html).toBe('<a href="https://get4domain.com/business/ranjith-plumber" rel="noopener"><img src="https://api.get4domain.com/v3/directory/badge/b1.svg" alt="Listed on Get4Domain" width="176" height="40"></a>');
    expect(badgeEmbedHtml({ origin: 'https://get4domain.com', apiBase: '', businessId: 'a"b', slug: 'x"><script>' })).not.toMatch(/"><script>/);
  });
});

describe('the backlink service', () => {
  const biz = (o: Partial<{ status: string; categoryId: string; locationId: string | null }> = {}) => ({ id: 'b1', slug: 'ranjith-plumber', status: 'CLAIMED', categoryId: 'plm', locationId: 'per', ...o });
  async function setup(over: { business?: ReturnType<typeof biz> | null; indexable?: boolean } = {}) {
    const listing = await listingOf([stat('per', 'plm', 4, '600011'), stat('ady', 'plm', 3, '600020'), stat('mdu', 'plm', 5)]);
    const business = over.business === undefined ? biz() : over.business;
    const svc = new SeoBacklinkService(
      { getBusiness: async (id: string) => (business && business.id === id ? business : null), getBusinessByVendor: async (v: string) => (business && v === 'v1' ? business : null), listLocations: async () => LOCS, listCategories: async () => CATS } as never,
      { get: async () => ({ ...DEFAULT_DIRECTORY_SETTINGS, directoryPagesIndexable: over.indexable ?? true }), readPublicAppUrl: async () => 'https://www.get4domain.com' } as never,
      { listing: async () => listing } as never, new Kw(),
    );
    return svc;
  }
  it('links a business to ITS locality and city pages, a neighbour in the same city, and no other city', async () => {
    const b = await (await setup()).block('b1');
    const hrefs = b!.links.map((l) => l.href);
    expect(hrefs).toEqual(['https://get4domain.com/chennai/plumbers-in-perambur', 'https://get4domain.com/chennai/plumbers', 'https://get4domain.com/chennai/plumbers-in-adyar', 'https://get4domain.com/chennai']);   // its own locality, its city, a neighbouring locality of the SAME city, the city
    expect(hrefs.some((h) => /madurai/.test(h))).toBe(false);
  });
  it('gives the brand link only while the directory pages are not indexable', async () => { const b = await (await setup({ indexable: false })).block('b1'); expect(b!.links).toEqual([]); expect(b!.brand.href).toBe('https://get4domain.com/'); });
  it('is a 404 (null) for an unknown, removed or draft business and for a malformed id, on the block, the badge and the embed', async () => {
    for (const status of ['REMOVED', 'DRAFT']) { const s = await setup({ business: biz({ status }) }); expect(await s.block('b1')).toBeNull(); expect(await s.badge('b1')).toBeNull(); expect(await s.embed('b1')).toBeNull(); }
    const s = await setup(); for (const id of ['nope', '', 'a b', '../x', 'x'.repeat(65)]) { expect(await s.block(id)).toBeNull(); expect(await s.badge(id)).toBeNull(); }
  });
  it('the embed also carries the plain text link "Find {name} on Get4Domain" to the profile, escaped, and the vendor reaches only their own', async () => {
    const s = await setup({ business: { ...biz(), name: 'Ranjith <b>Plumber</b> & Sons' } as never });
    const e = (await s.embed('b1'))!;
    expect(e.text).toEqual({ label: 'Find Ranjith bPlumber/b & Sons on Get4Domain', url: 'https://get4domain.com/business/ranjith-plumber', plain: 'Find Ranjith bPlumber/b & Sons on Get4Domain: https://get4domain.com/business/ranjith-plumber', html: '<a href="https://get4domain.com/business/ranjith-plumber" rel="noopener">Find Ranjith bPlumber/b &amp; Sons on Get4Domain</a>' });
    expect(await s.listedOfVendor('v1')).toMatchObject({ id: 'b1' }); expect(await s.listedOfVendor('someone-else')).toBeNull();
  });
  it('serves the badge and the embed for a listed business, an unclaimed and a suspended one included', async () => {
    for (const status of ['CLAIMED', 'UNCLAIMED', 'SUSPENDED']) { const s = await setup({ business: biz({ status }) }); expect(await s.badge('b1')).toContain('<svg'); expect((await s.embed('b1'))!.profileUrl).toBe('https://get4domain.com/business/ranjith-plumber'); }
  });
});

// ─── routes, matrix and schema ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('the routes', () => {
  const read = (f: string) => fs.readFileSync(path.resolve(__dirname, '../src/seo-directory/api', f), 'utf8');
  it('every public route of slice 5 is @Public and rate limited, and the badge is sandboxed and not indexable', () => {
    const src = read('seo-public.controller.ts');
    expect(src).toMatch(/@Public\(\) @Throttle\(RATE\.directoryVisit\) @Post\('page-visits'\)/); expect(src).toMatch(/@Public\(\) @Throttle\(RATE\.directoryRead\) @Get\('backlink-block\/:businessId'\)/);
    expect(src).toMatch(/@Public\(\) @Throttle\(RATE\.directoryRead\) @Get\('badge\/:file'\)/); expect(src).toMatch(/@Public\(\) @Throttle\(RATE\.directoryRead\) @Get\('badge-embed\/:businessId'\)/);
    expect(src).toContain("'Content-Security-Policy': \"default-src 'none'"); expect(src).toContain("'X-Content-Type-Options': 'nosniff'"); expect(src).toContain("'X-Robots-Tag': 'noindex'");
    expect(src).not.toMatch(/req\.(ip|headers)|@Req|@Headers/);   // the beacon reads no address and no header: nothing about the visitor can be stored
  });
  it("the vendor's badge route is owner-only and takes the vendor from the principal, never from the request", () => {
    const src = read('seo-me.controller.ts');
    expect(src).toMatch(/@UseTenant\(\)/); expect(src).toMatch(/@UseGuards\(VendorOwnerGuard\)/); expect(src).toContain("@Controller('v3/me/directory')"); expect(src).not.toMatch(/@Param|@Query|@Body|req\./);
  });
  it('the staff controller is behind AdminGuard and has no delete route', () => {
    const src = read('seo-targets-admin.controller.ts');
    expect(src).toMatch(/@UseGuards\(AdminGuard\)/); expect(src).not.toMatch(/@Delete/);
  });
  it('the staff routes are all in the role matrix: reads for SALES, writes for ADMIN and SUPER_ADMIN only', async () => {
    const { ADMIN_ROLE_MATRIX, effectiveRolesFor } = await import('../src/auth/guards/admin-role-matrix');
    for (const r of ['GET /v3/admin/seo-directory/keyword-targets', 'GET /v3/admin/seo-directory/keyword-plan', 'POST /v3/admin/seo-directory/links', 'GET /v3/admin/seo-directory/utm-report']) { expect(ADMIN_ROLE_MATRIX[r]).toEqual(['SUPER_ADMIN', 'MARKETING']); expect(effectiveRolesFor(r)).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'MARKETING', 'ADMIN'])); expect(effectiveRolesFor(r)).not.toContain('OPERATIONS'); }
    for (const r of ['POST /v3/admin/seo-directory/keyword-targets', 'PUT /v3/admin/seo-directory/keyword-targets/:id', 'POST /v3/admin/seo-directory/keyword-targets/import']) { expect(ADMIN_ROLE_MATRIX[r]).toEqual(['SUPER_ADMIN']); expect(effectiveRolesFor(r)).toEqual(expect.arrayContaining(['SUPER_ADMIN', 'ADMIN'])); expect(effectiveRolesFor(r)).not.toContain('MARKETING'); expect(effectiveRolesFor(r)).not.toContain('SUPPORT'); }
  });
});

describe('the migration', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20261217100000_v3_seo_keyword_targets/migration.sql'), 'utf8');
  it('is additive: two new tables, their indexes, RLS on both, and nothing destructive', () => {
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(2); expect(sql).toContain('"g4d_seo_keyword_targets"'); expect(sql).toContain('"g4d_seo_utm_daily"');
    expect(sql).toContain('ALTER TABLE "g4d_seo_keyword_targets" ENABLE ROW LEVEL SECURITY'); expect(sql).toContain('ALTER TABLE "g4d_seo_utm_daily" ENABLE ROW LEVEL SECURITY');
    expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE|UPDATE|ALTER TABLE "(?!g4d_seo_))/i.test(sql.replace(/--.*$/gm, '')) ? /^$/ : /(?!)/);
    expect(sql.replace(/--.*$/gm, '')).not.toMatch(/\bDROP\b|\bDELETE\b|\bTRUNCATE\b|\bUPDATE\b/i);
  });
  it('has the unique keys that make the aggregate and the targets safe, and the status and priority checks', () => {
    expect(sql).toContain('CREATE UNIQUE INDEX "g4d_seo_keyword_targets_key" ON "g4d_seo_keyword_targets"("keyword", "path")');
    expect(sql).toContain('CREATE UNIQUE INDEX "g4d_seo_utm_daily_key" ON "g4d_seo_utm_daily"("day", "pageType", "source", "medium", "campaign", "keywordKey")');
    expect(sql).toMatch(/CHECK \("status" IN \('PLANNED', 'ACTIVE', 'PAUSED'\)\)/); expect(sql).toMatch(/CHECK \("priority" BETWEEN 1 AND 3\)/);
  });
  it('the models carry no tenant column', () => {
    const schema = fs.readFileSync(path.resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
    const m = schema.slice(schema.indexOf('model V3SeoKeywordTarget'), schema.indexOf('@@map("g4d_seo_keyword_targets")'));
    expect(m).not.toMatch(/\b(vendorId|tenantId)\b/);
  });
});
