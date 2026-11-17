// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { runCleanup } from './support/cleanup-guard';
import { SeededTenant, cleanupTenants, newPrisma, seedTenant } from './support/fixtures';
import { buildProvisioningTestApp } from './support/provisioning-test-app';

/**
 * Wave 4 W1 on STAGING (real database, no third-party calls): with DIRECTORY_PUBLIC_BASE_URL set, the directory page model (canonical, breadcrumbs, JSON-LD urls), the sitemap index and chunks, robots.txt and the
 * backlink block use the directory host with NO /directory prefix, while the brand link ("Get4Domain") stays on the MAIN origin; with it unset, the behaviour is the old one (the /directory prefix on the main
 * origin). directoryPagesIndexable is switched on for this run only and restored. Synthetic data only, under one run id. NOT RUN in the build session that wrote it (no database there).
 */
jest.setTimeout(300_000);

const DIR_HOST = 'https://directory.v3test.invalid';

describe('the directory host on staging', () => {
  let prisma: PrismaClient; let A: SeededTenant; const bizIds: string[] = [];
  const tag = RUN_ID.toLowerCase().replace(/[^a-z0-9]/g, '');
  const stateSlug = `v3t${tag}st`; const citySlug = `v3t${tag}city`; const catSlug = `v3t${tag}cat`; const pluralSlug = `v3t${tag}cats`.replace(/\d/g, '');
  let stateId = ''; let cityId = ''; let catId = '';
  const saved = new Map<string, { existed: boolean; value: unknown }>(); let savedHost: string | undefined; let savedHostSet = false;
  const remember = async (k: string) => { if (!saved.has(k)) { const row = await prisma.v3PlanSetting.findUnique({ where: { key: k } }); saved.set(k, { existed: !!row, value: row?.valueJson ?? null }); } };
  const setSetting = async (k: string, v: unknown) => { await remember(k); await prisma.v3PlanSetting.upsert({ where: { key: k }, create: { key: k, valueJson: v as never, description: 'v3test' }, update: { valueJson: v as never } }); };
  const cityCatPath = `/${citySlug}/${pluralSlug}`;

  /** a fresh app per mode: the origin is read per request, but a fresh app also drops every cache */
  async function withApp<T>(host: string | undefined, fn: (get: (url: string) => request.Test, getText: (url: string) => request.Test) => Promise<T>): Promise<T> {
    if (host === undefined) delete process.env.DIRECTORY_PUBLIC_BASE_URL; else process.env.DIRECTORY_PUBLIC_BASE_URL = host;
    const app: INestApplication = await buildProvisioningTestApp({ includeDirectoryApi: true, includeSeoApi: true });
    try {
      const get = (url: string) => request(app.getHttpServer()).get(url).timeout({ response: 60_000, deadline: 90_000 });
      const getText = (url: string) => get(url).buffer(true).parse((res, cb) => { let d = ''; res.setEncoding('utf8'); res.on('data', (c: string) => { d += c; }); res.on('end', () => cb(null, d)); });
      return await fn(get, getText);
    } finally { await app.close(); }
  }

  beforeAll(async () => {
    prisma = newPrisma(); savedHostSet = 'DIRECTORY_PUBLIC_BASE_URL' in process.env; savedHost = process.env.DIRECTORY_PUBLIC_BASE_URL;
    await setSetting('directoryPagesIndexable', true); await setSetting('directoryThinPageMinBusinesses', 1);
    stateId = (await prisma.v3DirectoryLocation.create({ data: { parentKey: 'ROOT', kind: 'STATE', name: `V3T State ${tag}`, slug: stateSlug } })).id;
    cityId = (await prisma.v3DirectoryLocation.create({ data: { parentId: stateId, parentKey: stateId, kind: 'CITY', name: `V3T City ${tag}`, slug: citySlug } })).id;
    catId = (await prisma.v3DirectoryCategory.create({ data: { parentKey: 'ROOT', name: `V3T Cat ${tag}`, slug: catSlug } })).id;
    await prisma.v3SeoCategoryKeyword.create({ data: { categorySlug: catSlug, name: `V3T Cat ${tag}`, singular: catSlug.replace(/\d/g, ''), plural: pluralSlug, source: 'STAFF' } });
    A = await seedTenant(prisma, 'w4dh', RUN_ID);
    const b = await prisma.v3DirectoryBusiness.create({ data: { vendorId: A.vendorId, slug: `v3t-${tag}-b0`, name: `V3T Biz ${tag}`, categoryId: catId, locationId: cityId, pincode: '600099', status: 'CLAIMED', claimedAt: new Date(), descriptionText: 'A synthetic business used by the staging suite.' } });
    bizIds.push(b.id);
  }, 300000);

  afterAll(async () => {
    const del = (label: string, run: () => Promise<unknown>) => async () => { try { await run(); } catch (e) { throw new Error(`cleanup "${label}": ${e instanceof Error ? e.message : String(e)}`); } };
    await runCleanup([
      prisma ? del('businesses', () => prisma.v3DirectoryBusiness.deleteMany({ where: { id: { in: bizIds } } })) : null,
      prisma ? del('keyword row', () => prisma.v3SeoCategoryKeyword.deleteMany({ where: { categorySlug: catSlug } })) : null,
      prisma ? () => cleanupTenants(prisma, RUN_ID) : null,
      prisma && catId ? del('category', () => prisma.v3DirectoryCategory.deleteMany({ where: { id: catId } })) : null,
      prisma && cityId ? del('city', () => prisma.v3DirectoryLocation.deleteMany({ where: { id: cityId } })) : null,
      prisma && stateId ? del('state', () => prisma.v3DirectoryLocation.deleteMany({ where: { id: stateId } })) : null,
      prisma ? del('settings', async () => { for (const [k, p] of saved) { if (p.existed) await prisma.v3PlanSetting.update({ where: { key: k }, data: { valueJson: p.value as never } }); else await prisma.v3PlanSetting.deleteMany({ where: { key: k } }); } }) : null,
      async () => { if (savedHostSet) process.env.DIRECTORY_PUBLIC_BASE_URL = savedHost; else delete process.env.DIRECTORY_PUBLIC_BASE_URL; },
      prisma ? () => prisma.$disconnect() : null,
    ]);
  }, 330000);

  it('with the directory host set: the page model, its breadcrumbs and JSON-LD use the directory host with no /directory prefix', async () => {
    await withApp(DIR_HOST, async (get) => {
      const page = await get(`/v3/directory/pages/resolve?path=${encodeURIComponent(cityCatPath)}`); expect(page.status).toBe(200);
      const text = JSON.stringify(page.body.data);
      expect(text).toContain(`${DIR_HOST}${cityCatPath}`);                     // the canonical of this page
      expect(text).not.toMatch(/\/directory(?![.\w-])/);                       // no /directory prefix anywhere in the model
      expect(page.body.data.meta?.canonical ?? '').toBe(`${DIR_HOST}${cityCatPath}`);
    });
  });

  it('with the directory host set: the sitemap index, a chunk and robots.txt name the directory host, without /directory', async () => {
    await withApp(DIR_HOST, async (_get, getText) => {
      const idx = await getText('/v3/directory/sitemaps/index.xml'); expect(idx.status).toBe(200);
      expect(String(idx.body)).toContain(`${DIR_HOST}/`); expect(String(idx.body)).not.toMatch(/\/directory(?![.\w-])/);
      const chunk = await getText('/v3/directory/sitemaps/directory-1.xml'); expect(chunk.status).toBe(200);
      const xml = String(chunk.body); expect(xml).toContain(`${DIR_HOST}/`); expect(xml).not.toMatch(/\/directory(?![.\w-])/);
      const robots = await getText('/v3/directory/robots.txt'); expect(robots.status).toBe(200);
      expect(String(robots.body)).toMatch(new RegExp(`Sitemap: ${DIR_HOST.replace(/\./g, '\\.')}/`)); expect(String(robots.body)).not.toMatch(/\/directory(?![.\w-])/);
    });
  });

  it('with the directory host set: the backlink block keeps the brand link on the MAIN origin and puts the listing links on the directory host', async () => {
    await withApp(DIR_HOST, async (get) => {
      const b = await get(`/v3/directory/backlink-block/${bizIds[0]}`); expect(b.status).toBe(200);
      expect(b.body.data.brand.href).not.toContain(DIR_HOST);                  // the brand is the main site, not the directory host
      const links = (b.body.data.links as Array<{ href: string }>).map((l) => l.href); expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links.every((h) => h.startsWith(`${DIR_HOST}/`))).toBe(true); expect(links.join(' ')).not.toMatch(/\/directory(?![.\w-])/);
      const embed = await get(`/v3/directory/badge-embed/${bizIds[0]}`); expect(embed.status).toBe(200); expect(embed.body.data.html).toContain(`${DIR_HOST}/business/v3t-${tag}-b0`);
    });
  });

  it('with it UNSET the behaviour is the old one: the listing links sit under /directory on the main origin', async () => {
    await withApp(undefined, async (get, getText) => {
      const page = await get(`/v3/directory/pages/resolve?path=${encodeURIComponent(cityCatPath)}`); expect(page.status).toBe(200);
      expect(JSON.stringify(page.body.data)).toContain('/directory'); expect(JSON.stringify(page.body.data)).not.toContain(DIR_HOST);
      const robots = await getText('/v3/directory/robots.txt'); expect(String(robots.body)).not.toContain(DIR_HOST);
    });
  });

  it('with directoryPagesIndexable OFF the sitemap stays empty and robots names no sitemap, whichever host is set', async () => {
    await setSetting('directoryPagesIndexable', false);
    try {
      await withApp(DIR_HOST, async (_get, getText) => {
        const robots = await getText('/v3/directory/robots.txt'); expect(robots.status).toBe(200); expect(String(robots.body)).not.toMatch(/Sitemap: /);
      });
    } finally { await setSetting('directoryPagesIndexable', true); }
  });
});
