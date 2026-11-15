// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { VendorSeoSettings } from '../src/site-publish/seo/vendor-seo-settings';

/**
 * The SEO block on STAGING (docs/v3/V3_SEO_DIRECTORY.md): the real database, the real controllers, guards, pipe, filter and interceptor over the slim app (includeSeoApi), no third-party calls.
 * Covers what the unit tests cannot: the migration's objects (RLS, unique keys, checks), the staff role matrix over HTTP, keyword target writes and the CSV round trip, the override reaching a page
 * model and the click-out (kw=), the atomic daily aggregates under real concurrency (clicks and UTM), the sitemap and plan reading real rows, the backlink block, the badge and the 404 for a removed
 * business, and the vendor templates the site build reads. Synthetic data only, under one run id; every row is removed at the end and the settings it changes are restored.
 * NOT RUN in the build session that wrote it (no .env.staging there): the owner runs `npm.cmd run test:int` (or this file alone) after applying the slice 5 migration on staging.
 */
jest.setTimeout(300_000);

describe('the SEO block on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let sup: string; let adm: string; let mkt: string; let ops: string;
  const tag = RUN_ID.toLowerCase().replace(/[^a-z0-9]/g, '');
  const stateSlug = `v3t${tag}st`; const citySlug = `v3t${tag}city`; const locSlug = `v3t${tag}loc`; const catSlug = `v3t${tag}cat`; const pluralSlug = `v3t${tag}cats`;
  const campaign = `v3t${tag}`.slice(0, 30);
  let stateId = ''; let cityId = ''; let locId = ''; let catId = ''; const bizIds: string[] = []; let clickBiz = ''; const targetIds: string[] = [];
  const saved = new Map<string, { existed: boolean; value: unknown }>();
  const get = (url: string, token?: string) => { const r = request(app.getHttpServer()).get(url).timeout({ response: 60_000, deadline: 90_000 }); return token ? r.set('Authorization', `Bearer ${token}`) : r; };
  const send = (method: 'post' | 'put', url: string, token: string, body: object) => request(app.getHttpServer())[method](url).timeout({ response: 60_000, deadline: 90_000 }).set('Authorization', `Bearer ${token}`).send(body);
  const base = '/v3/admin/seo-directory';
  /** remembers what a setting was BEFORE the suite touches it (a staff route counts as touching it), so afterAll can put it back exactly */
  const remember = async (k: string) => { if (!saved.has(k)) { const row = await prisma.v3PlanSetting.findUnique({ where: { key: k } }); saved.set(k, { existed: !!row, value: row?.valueJson ?? null }); } };
  const setSetting = async (k: string, v: unknown) => { await remember(k); await prisma.v3PlanSetting.upsert({ where: { key: k }, create: { key: k, valueJson: v as never, description: 'v3test' }, update: { valueJson: v as never } }); };
  const must = (step: string, r: { status: number; body: unknown }, ok = [200, 201]) => { if (!ok.includes(r.status)) throw new Error(`setup step "${step}" answered ${r.status}: ${JSON.stringify(r.body).slice(0, 300)}`); return r; };

  beforeAll(async () => {
    let step = 'start';
    try {
      step = 'settings and app'; prisma = newPrisma();
      // set BEFORE the app serves anything, so no cache holds the old value: the directory pages are indexable for this run, the thin-page minimum is the default 3
      for (const k of ['seoPageTemplates', 'seoCrawlerAgents', 'seoKeywordModifiers']) await remember(k);   // the templates and crawler tests change these through the staff routes
      await setSetting('directoryPagesIndexable', true); await setSetting('directoryThinPageMinBusinesses', 3);
      app = await buildProvisioningTestApp({ includeDirectoryApi: true, includeSeoApi: true, includeSiteApi: true, b3: true });
      step = 'staff'; sup = await seedStaff(prisma, 'seosup', RUN_ID, 'SUPER_ADMIN'); adm = await seedStaff(prisma, 'seoadm', RUN_ID, 'ADMIN'); mkt = await seedStaff(prisma, 'seomkt', RUN_ID, 'MARKETING'); ops = await seedStaff(prisma, 'seoops', RUN_ID, 'OPERATIONS');
      step = 'places and category';
      stateId = (await prisma.v3DirectoryLocation.create({ data: { parentKey: 'ROOT', kind: 'STATE', name: `V3T State ${tag}`, slug: stateSlug } })).id;
      cityId = (await prisma.v3DirectoryLocation.create({ data: { parentId: stateId, parentKey: stateId, kind: 'CITY', name: `V3T City ${tag}`, slug: citySlug } })).id;
      locId = (await prisma.v3DirectoryLocation.create({ data: { parentId: cityId, parentKey: cityId, kind: 'LOCALITY', name: `V3T Loc ${tag}`, slug: locSlug } })).id;
      catId = (await prisma.v3DirectoryCategory.create({ data: { parentKey: 'ROOT', name: `V3T Cat ${tag}`, slug: catSlug } })).id;
      await prisma.v3SeoCategoryKeyword.create({ data: { categorySlug: catSlug, name: `V3T Cat ${tag}`, singular: catSlug.replace(/\d/g, ''), plural: pluralSlug.replace(/\d/g, ''), source: 'STAFF' } });
      step = 'businesses'; A = await seedTenant(prisma, 'seoa', RUN_ID);
      for (let i = 0; i < 3; i++) {
        const t = i === 0 ? A : await seedTenant(prisma, `seo${i}`, RUN_ID);
        const b = await prisma.v3DirectoryBusiness.create({ data: { vendorId: t.vendorId, slug: `v3t-${tag}-b${i}`, name: `V3T Biz ${i} ${tag}`, categoryId: catId, locationId: locId, pincode: '600099', status: 'CLAIMED', claimedAt: new Date(), descriptionText: 'A synthetic business used by the staging suite.' } });
        bizIds.push(b.id);
        await prisma.vendor.update({ where: { id: t.vendorId }, data: { subdomain: `v3t${tag}${i}`.slice(0, 30) } });
      }
      clickBiz = bizIds[0];
    } catch (e) { throw new Error(`SEO suite setup failed at step "${step}": ${e instanceof Error ? e.message : String(e)}`); }
  }, 300000);

  afterAll(async () => {
    const del = (label: string, run: () => Promise<unknown>) => async () => { try { await run(); } catch (e) { throw new Error(`cleanup "${label}": ${e instanceof Error ? e.message : String(e)}`); } };
    await runCleanup([
      prisma ? del('targets', () => prisma.v3SeoKeywordTarget.deleteMany({ where: { OR: [{ path: { startsWith: `/${citySlug}` } }, { path: { contains: pluralSlug.replace(/\d/g, '') } }] } })) : null,
      prisma ? del('utm rows', () => prisma.v3SeoUtmDaily.deleteMany({ where: { campaign } })) : null,
      prisma ? del('click rows', () => prisma.v3SeoClickDaily.deleteMany({ where: { categoryKey: catId } })) : null,
      prisma ? del('businesses', () => prisma.v3DirectoryBusiness.deleteMany({ where: { id: { in: bizIds } } })) : null,
      prisma ? del('keyword row', () => prisma.v3SeoCategoryKeyword.deleteMany({ where: { categorySlug: catSlug } })) : null,
      prisma ? () => cleanupTenants(prisma, RUN_ID) : null,
      prisma && catId ? del('category', () => prisma.v3DirectoryCategory.deleteMany({ where: { id: catId } })) : null,
      prisma && locId ? del('locality', () => prisma.v3DirectoryLocation.deleteMany({ where: { id: locId } })) : null,
      prisma && cityId ? del('city', () => prisma.v3DirectoryLocation.deleteMany({ where: { id: cityId } })) : null,
      prisma && stateId ? del('state', () => prisma.v3DirectoryLocation.deleteMany({ where: { id: stateId } })) : null,
      prisma ? del('settings', async () => { for (const [k, p] of saved) { if (p.existed) await prisma.v3PlanSetting.update({ where: { key: k }, data: { valueJson: p.value as never } }); else await prisma.v3PlanSetting.deleteMany({ where: { key: k } }); } }) : null,
      app ? () => app.close() : null,
      prisma ? () => prisma.$disconnect() : null,
    ]);
  }, 330000);

  // ─── the migration ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  it('the migration objects exist: RLS on both tables, the unique keys, and the status and priority checks refuse bad rows', async () => {
    const rls = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('g4d_seo_keyword_targets', 'g4d_seo_utm_daily')`;
    expect(rls.map((r) => [r.relname, r.relrowsecurity]).sort()).toEqual([['g4d_seo_keyword_targets', true], ['g4d_seo_utm_daily', true]]);
    const idx = await prisma.$queryRaw<Array<{ indexname: string }>>`SELECT indexname FROM pg_indexes WHERE indexname IN ('g4d_seo_keyword_targets_key', 'g4d_seo_utm_daily_key')`;
    expect(idx.map((i) => i.indexname).sort()).toEqual(['g4d_seo_keyword_targets_key', 'g4d_seo_utm_daily_key']);
    const row = (status: string, priority: number, path: string) => prisma.v3SeoKeywordTarget.create({ data: { keyword: `v3t ${tag}`, path, pageType: 'city', status, priority } });
    await expect(row('LIVE', 2, `/${citySlug}/x1`)).rejects.toThrow(); await expect(row('PLANNED', 4, `/${citySlug}/x2`)).rejects.toThrow(); await expect(row('PLANNED', 0, `/${citySlug}/x3`)).rejects.toThrow();
    const ok = await row('PLANNED', 2, `/${citySlug}/x4`); await expect(row('PLANNED', 2, `/${citySlug}/x4`)).rejects.toThrow();   // the same keyword and path twice
    await prisma.v3SeoKeywordTarget.delete({ where: { id: ok.id } });
  });

  it('the volume migration objects exist: the nullable columns, the checks that refuse a negative volume or an unknown competition, and the volume index', async () => {
    const cols = await prisma.$queryRaw<Array<{ column_name: string; is_nullable: string }>>`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'g4d_seo_keyword_targets' AND column_name IN ('volume', 'competition')`;
    expect(cols.map((c) => [c.column_name, c.is_nullable]).sort()).toEqual([['competition', 'YES'], ['volume', 'YES']]);
    const idx = await prisma.$queryRaw<Array<{ indexname: string }>>`SELECT indexname FROM pg_indexes WHERE indexname = 'g4d_seo_keyword_targets_volume_idx'`; expect(idx).toHaveLength(1);
    const row = (volume: number | null, competition: string | null, p: string) => prisma.v3SeoKeywordTarget.create({ data: { keyword: `v3t ${tag}`, path: p, pageType: 'city', volume, competition } });
    await expect(row(-1, null, `/${citySlug}/v1`)).rejects.toThrow(); await expect(row(10, 'EXTREME', `/${citySlug}/v2`)).rejects.toThrow();
    const ok = await row(1300, 'LOW', `/${citySlug}/v3`); expect(ok.volume).toBe(1300); await prisma.v3SeoKeywordTarget.delete({ where: { id: ok.id } });
  });

  // ─── roles over HTTP ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  it('roles: SALES (MARKETING) reads and builds links but cannot write; OPERATIONS has no access; ADMIN and SUPER_ADMIN write; no token is 401', async () => {
    expect((await get(`${base}/keyword-targets`)).status).toBe(401);
    for (const [name, t] of [['mkt', mkt], ['adm', adm], ['sup', sup]] as const) expect([name, (await get(`${base}/keyword-targets`, t)).status]).toEqual([name, 200]);
    expect((await get(`${base}/keyword-targets`, ops)).status).toBe(403); expect((await get(`${base}/keyword-plan`, ops)).status).toBe(403); expect((await get(`${base}/utm-report`, ops)).status).toBe(403);
    const body = { keyword: `v3t ${tag} role`, path: `/${citySlug}` };
    expect((await send('post', `${base}/keyword-targets`, mkt, body)).status).toBe(403); expect((await send('post', `${base}/keyword-targets`, ops, body)).status).toBe(403);
    expect((await send('post', `${base}/keyword-targets/import`, mkt, { csv: 'keyword,path\n' })).status).toBe(403);
    expect((await send('post', `${base}/links`, mkt, { path: `/${citySlug}`, source: 'a', medium: 'b', campaign })).status).toBe(200);
    expect((await send('post', `${base}/links`, ops, { path: `/${citySlug}`, source: 'a', medium: 'b', campaign })).status).toBe(403);
    const made = await send('post', `${base}/keyword-targets`, adm, body); expect(made.status).toBe(201); targetIds.push(made.body.data.id);
    expect(await prisma.v3AuditLog.count({ where: { action: 'seo.keyword_target.create', entityId: made.body.data.id } })).toBe(1);
  });

  // ─── keyword targets: create, duplicate, edit, CSV ───────────────────────────────────────────────────────────────────────────────────────────
  const cityCatPath = () => `/${citySlug}/${pluralSlug.replace(/\d/g, '')}`;
  it('a target is created PLANNED, a duplicate is 409 SEO_DUPLICATE, a bad path or text is 400 SEO_INVALID with the reason', async () => {
    const r = await send('post', `${base}/keyword-targets`, sup, { keyword: `v3t ${tag} plumbers`, path: cityCatPath() }); expect(r.status).toBe(201); expect(r.body.data).toMatchObject({ status: 'PLANNED', priority: 2, source: 'STAFF', pageType: 'cityCategory' }); targetIds.push(r.body.data.id);
    const dup = await send('post', `${base}/keyword-targets`, sup, { keyword: `V3T ${tag} Plumbers`, path: `${cityCatPath()}/` }); expect(dup.status).toBe(409); expect(dup.body.code).toBe('SEO_DUPLICATE');
    for (const bad of [{ path: `/${citySlug}/page/2` }, { path: 'https://evil.example/' }, { status: 'LIVE' }, { titleOverride: 'Best plumbers in town' }, { titleOverride: 'Plumbers from Rs 499' }, { priority: 9 }]) {
      const x = await send('post', `${base}/keyword-targets`, sup, { keyword: `v3t ${tag} bad`, path: `/${citySlug}`, ...bad }); expect([400]).toContain(x.status);
    }
  });

  it('the CSV round trip: a dry run writes nothing, one bad row blocks the apply, the apply is idempotent, and the export imports back unchanged', async () => {
    const p = `/${citySlug}/${locSlug.replace(/\d/g, '')}`;   // a path that parses; the page need not exist for a target
    const csv = `keyword,path,status,priority,title,notes\nv3t ${tag} csv one,/${citySlug},PLANNED,2,,first\nv3t ${tag} csv two,${p},PLANNED,3,,second\n`;
    const dry = await send('post', `${base}/keyword-targets/import`, sup, { csv }); expect(dry.status).toBe(200); expect(dry.body.data).toMatchObject({ applied: false, problems: [] }); expect(dry.body.data.create).toHaveLength(2);
    expect(await prisma.v3SeoKeywordTarget.count({ where: { keyword: { startsWith: `v3t ${tag} csv` } } })).toBe(0);
    const blocked = await send('post', `${base}/keyword-targets/import`, sup, { csv: `${csv}x,/a/b/c/d\n`, apply: true }); expect(blocked.body.data.applied).toBe(false); expect(blocked.body.data.problems).toHaveLength(1);
    expect(await prisma.v3SeoKeywordTarget.count({ where: { keyword: { startsWith: `v3t ${tag} csv` } } })).toBe(0);
    const applied = await send('post', `${base}/keyword-targets/import`, sup, { csv, apply: true }); expect(applied.body.data).toMatchObject({ applied: true }); expect(await prisma.v3SeoKeywordTarget.count({ where: { keyword: { startsWith: `v3t ${tag} csv` } } })).toBe(2);
    const again = await send('post', `${base}/keyword-targets/import`, sup, { csv, apply: true }); expect(again.body.data).toMatchObject({ applied: false, unchanged: 2 });
    const ex = await get(`${base}/keyword-targets/export.csv`, mkt); expect(ex.status).toBe(200); expect(ex.headers['content-type']).toMatch(/text\/csv/); expect(ex.headers['content-disposition']).toMatch(/attachment/);
    const back = await send('post', `${base}/keyword-targets/import`, sup, { csv: ex.text }); expect(back.body.data.problems).toEqual([]); expect(back.body.data.create).toEqual([]); expect(back.body.data.update).toEqual([]);
  });

  it('the Keyword Planner import over HTTP: a dry run writes nothing, apply stores the volume on the target, a range is skipped, a stranger is unmatched, SALES cannot import', async () => {
    const kw = `v3t ${tag} plumbers`; const csv = `Keyword Stats
Keyword,Avg. monthly searches,Competition
${kw},"1,300",Medium
v3t ${tag} range,1K - 10K,Low
v3t ${tag} stranger,50,Low
`;
    expect((await send('post', `${base}/keyword-targets/import-volumes`, mkt, { csv })).status).toBe(403);
    const dry = await send('post', `${base}/keyword-targets/import-volumes`, sup, { csv }); expect(dry.status).toBe(200);
    expect(dry.body.data).toMatchObject({ applied: false, updated: 1, skippedCount: 1, unmatchedCount: 1 }); expect((await prisma.v3SeoKeywordTarget.findFirstOrThrow({ where: { keyword: kw } })).volume).toBeNull();
    const done = await send('post', `${base}/keyword-targets/import-volumes`, sup, { csv, apply: true }); expect(done.body.data).toMatchObject({ applied: true, updated: 1 });
    expect(await prisma.v3SeoKeywordTarget.findFirstOrThrow({ where: { keyword: kw } })).toMatchObject({ volume: 1300, competition: 'MEDIUM' });
    expect((await send('post', `${base}/keyword-targets/import-volumes`, sup, { csv, apply: true })).body.data).toMatchObject({ applied: false, updated: 0, unchanged: 1 });
    const sorted = await get(`${base}/keyword-targets?sort=volume`, mkt); expect(sorted.status).toBe(200); expect(sorted.body.data.items[0].volume).toBe(1300);
  });

  it('the research list: counts for SALES, a Planner upload file, the modifiers setting (ADMIN may change it, a ranking word is allowed there), and the page text never gains a modifier', async () => {
    const counts = await get(`${base}/keyword-plan/research`, mkt); expect(counts.status).toBe(200); expect(counts.body.data.total).toBeGreaterThan(0); expect(counts.body.data.counts.place).toBeGreaterThan(0);
    const up = await get(`${base}/keyword-plan/planner.csv`, mkt); expect(up.status).toBe(200); expect(up.text.split(String.fromCharCode(10))[0]).toBe('Keyword'); expect(up.text).toContain(`${pluralSlug.replace(/\d/g, '')} in `);
    expect((await get(`${base}/keyword-plan/research`, ops)).status).toBe(403);
    expect((await send('put', `${base}/modifiers`, mkt, { modifiers: ['best'] })).status).toBe(403);
    expect((await send('put', `${base}/modifiers`, adm, { modifiers: ['best', 'near me', 'in {locality}'] })).status).toBe(200);
    expect((await send('put', `${base}/modifiers`, adm, { modifiers: ['{city} plumbers'] })).status).toBe(400);
    const page = await get(`/v3/directory/pages/resolve?path=${encodeURIComponent(cityCatPath())}`); expect(page.body.data.meta.title).not.toMatch(/best|near me/i);
  });

  // ─── override reaches the page model and the click-out ───────────────────────────────────────────────────────────────────────────────────────
  it('an ACTIVE target gives the page its own title and puts kw= on the cards; PAUSED takes it away again', async () => {
    const path = cityCatPath(); const targetId = targetIds[1];
    const before = await get(`/v3/directory/pages/resolve?path=${encodeURIComponent(path)}`); expect(before.status).toBe(200);
    expect(before.body.data.meta.title).toMatch(/ \| Get4Domain$/); expect(before.body.data.cards).toHaveLength(3); expect(before.body.data.cards[0].visitUrl).not.toMatch(/kw=/);
    const act = await send('put', `${base}/keyword-targets/${targetId}`, sup, { status: 'ACTIVE', priority: 1, titleOverride: `V3T Own Title ${tag}` }); expect(act.status).toBe(200);
    const after = await get(`/v3/directory/pages/resolve?path=${encodeURIComponent(path)}`);
    expect(after.body.data.meta.title).toBe(`V3T Own Title ${tag} | Get4Domain`); expect(after.body.data.meta.title.length).toBeLessThanOrEqual(60);
    for (const c of after.body.data.cards) expect(c.visitUrl).toContain(`kw=${targetId}`);
    expect((await send('put', `${base}/keyword-targets/${targetId}`, sup, { titleOverride: 'Best plumbers' })).status).toBe(400);
    expect((await send('put', `${base}/keyword-targets/${targetId}`, sup, { status: 'PAUSED' })).status).toBe(200);
    expect((await get(`/v3/directory/pages/resolve?path=${encodeURIComponent(path)}`)).body.data.meta.title).not.toContain('Own Title');
    expect((await send('put', `${base}/keyword-targets/${targetId}`, sup, { status: 'ACTIVE' })).status).toBe(200);   // leave it ACTIVE for the click-out test
  });

  it('the click-out redirects 302 to the business subdomain only, never indexable, and counts the click under the keyword target', async () => {
    const kw = targetIds[1];
    const r = await get(`/v3/go/${clickBiz}?src=cityCategory&kw=${kw}`).redirects(0); expect(r.status).toBe(302);
    expect(r.headers.location).toMatch(new RegExp(`^https://v3t${tag}0\\.`)); expect(r.headers['x-robots-tag']).toBe('noindex, nofollow'); expect(r.headers['cache-control']).toBe('no-store');
    const row = await prisma.v3SeoClickDaily.findFirstOrThrow({ where: { categoryKey: catId, keywordKey: kw, pageType: 'cityCategory' } }); expect(row.count).toBe(1);
    expect((await get('/v3/go/does-not-exist').redirects(0)).status).toBe(404);
  });

  it('the daily click aggregate is exact under 30 parallel clicks (one atomic statement) and holds no visitor data', async () => {
    const before = (await prisma.v3SeoClickDaily.findFirst({ where: { categoryKey: catId, pageType: 'localityCategory', keywordKey: '' } }))?.count ?? 0;
    const rs = await Promise.all(Array.from({ length: 30 }, (_v, i) => get(`/v3/go/${clickBiz}?src=localityCategory`).set('X-Forwarded-For', `198.51.100.${i}`).redirects(0)));
    expect(rs.map((r) => r.status).filter((s) => s !== 302)).toEqual([]);
    const row = await prisma.v3SeoClickDaily.findFirstOrThrow({ where: { categoryKey: catId, pageType: 'localityCategory', keywordKey: '' } });
    expect(row.count - before).toBe(30); expect(JSON.stringify(row)).not.toMatch(/198\.51\.100|v3t/);
  });

  // ─── UTM capture ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  it('the page-visit beacon: a campaign visit is counted exactly under 25 parallel calls; a visit without campaign information and a bad path are ignored; only tokens are stored', async () => {
    const path = cityCatPath();
    const rs = await Promise.all(Array.from({ length: 25 }, () => request(app.getHttpServer()).post('/v3/directory/page-visits').send({ path, utm_source: 'v3t', utm_medium: 'email', utm_campaign: campaign })));
    expect(rs.map((r) => r.status)).toEqual(Array(25).fill(200)); expect(rs[0].body.data).toEqual({ ok: true });
    const ignored = await Promise.all([{ path }, { path: '/dashboard/x', utm_source: 'v3t', utm_campaign: campaign }, { path, utm_campaign: 'Has Space <b>' }].map((b) => request(app.getHttpServer()).post('/v3/directory/page-visits').send(b)));
    expect(ignored.map((r) => r.status)).toEqual([200, 200, 200]);
    const rows = await prisma.v3SeoUtmDaily.findMany({ where: { campaign } }); expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ pageType: 'cityCategory', source: 'v3t', medium: 'email', keywordKey: '', count: 25 });
    expect((await request(app.getHttpServer()).post('/v3/directory/page-visits').send({ path, utm_source: 'v3t', extra: 'not allowed' })).status).toBe(400);   // the global validation pipe refuses unknown fields
    const rep = await get(`${base}/utm-report`, mkt); expect(rep.status).toBe(200); expect(rep.body.data.items.some((i: { campaign: string; count: number }) => i.campaign === campaign && i.count === 25)).toBe(true);
    expect((await get(`${base}/utm-report?from=2026-12-31&to=2026-01-01`, mkt)).status).toBe(400);
  });

  // ─── sitemap and plan read the real rows ─────────────────────────────────────────────────────────────────────────────────────────────────────
  it('the sitemap lists this suite\'s pages, and the keyword plan proposes the keywords for them', async () => {
    const idx = await get('/v3/directory/sitemaps/index.xml'); expect(idx.status).toBe(200); expect(idx.headers['content-type']).toMatch(/xml/);
    const chunk = await get('/v3/directory/sitemaps/directory-1.xml'); expect(chunk.status).toBe(200);
    const all = [chunk.text]; for (let n = 2; n <= 5 && !all.join('').includes(`/${citySlug}/`); n++) { const c = await get(`/v3/directory/sitemaps/directory-${n}.xml`); if (c.status !== 200) break; all.push(c.text); }
    expect(all.join('')).toContain(`/${citySlug}/${pluralSlug.replace(/\d/g, '')}`);
    const plan = await get(`${base}/keyword-plan`, mkt); expect(plan.status).toBe(200);
    const mine = (plan.body.data.rows as Array<{ path: string; keyword: string; status: string; source: string }>).filter((r) => r.path.startsWith(`/${citySlug}`));
    expect(mine.length).toBeGreaterThanOrEqual(2); expect(mine.every((r) => r.status === 'PLANNED' && r.source === 'PLAN')).toBe(true);
    const csv = await get(`${base}/keyword-plan/export.csv`, mkt); expect(csv.status).toBe(200); expect(csv.headers['content-type']).toMatch(/text\/csv/); expect(csv.text.split('\n')[0]).toBe('keyword,path,status,priority,title,description,h1,notes,source,volume,competition');
  });

  // ─── backlink block and badge ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  it('the backlink block has the brand link and directory links for this business\'s own pages; the badge is a sandboxed SVG; a removed business is a 404 on all three', async () => {
    const b = await get(`/v3/directory/backlink-block/${clickBiz}`); expect(b.status).toBe(200);
    expect(b.body.data.brand.text).toBe('Get4Domain'); expect(b.body.data.links.length).toBeGreaterThanOrEqual(1); expect(b.body.data.links.length).toBeLessThanOrEqual(4);
    expect(b.body.data.links.map((l: { href: string }) => l.href).join(' ')).toContain(`/${citySlug}`); expect(b.body.data.html).toMatch(/^<p class="g4d-backlinks">/);
    const badge = await get(`/v3/directory/badge/${clickBiz}.svg`); expect(badge.status).toBe(200); expect(badge.headers['content-type']).toMatch(/image\/svg\+xml/); expect(badge.headers['content-security-policy']).toContain("default-src 'none'"); expect(badge.headers['x-content-type-options']).toBe('nosniff');
    expect(badge.text).toContain('Listed on Get4Domain'); expect(badge.text).not.toContain(tag);
    const embed = await get(`/v3/directory/badge-embed/${clickBiz}`); expect(embed.status).toBe(200); expect(embed.body.data.html).toContain(`/business/v3t-${tag}-b0`);
    const gone = bizIds[2]; await prisma.v3DirectoryBusiness.update({ where: { id: gone }, data: { status: 'REMOVED', removedAt: new Date() } });
    for (const u of [`/v3/directory/backlink-block/${gone}`, `/v3/directory/badge/${gone}.svg`, `/v3/directory/badge-embed/${gone}`, '/v3/directory/badge/nope.png', '/v3/directory/badge/..%2Fx.svg']) expect([u, (await get(u)).status]).toEqual([u, 404]);
  });

  // ─── what the vendor site build reads ────────────────────────────────────────────────────────────────────────────────────────────────────────
  it('staff edits of the vendor templates and the crawler list reach what the site build reads, and the main robots.txt names the crawlers', async () => {
    const t = await send('put', `${base}/templates`, sup, { templates: { vendorHome: { title: ['{vendorName} in {city}'] } } }); expect(t.status).toBe(200);
    expect((await send('put', `${base}/templates`, sup, { templates: { vendorHome: { title: ['Best {vendorName}'] } } })).status).toBe(400);   // no ranking promise
    expect((await send('put', `${base}/crawlers`, adm, { crawlers: ['Googlebot'] })).status).toBe(403);   // the crawler list is SUPER_ADMIN only
    expect((await send('put', `${base}/crawlers`, sup, { crawlers: ['Googlebot', 'GPTBot'] })).status).toBe(200);
    const seen = await app.get(VendorSeoSettings).get(); expect(seen.vendorHome.title).toEqual(['{vendorName} in {city}']); expect(seen.crawlers).toEqual(['Googlebot', 'GPTBot']);
    const robots = await get('/v3/directory/robots.txt'); expect(robots.status).toBe(200); expect(robots.text).toContain('User-agent: GPTBot'); expect(robots.text).toMatch(/Sitemap: /);
    // afterAll puts both settings back exactly as `remember` saw them (the audit rows of these staff writes stay: the log is append-only)
  });
});
