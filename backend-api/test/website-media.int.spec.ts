// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import request from 'supertest';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { WebsiteSettingsService } from '../src/v3-website/settings/website-settings.service';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * Slice 5.5b on STAGING: pictures and the Banner Library over the real database with the FAKE storage (MEDIA_STORAGE_MODE=fake). Uploads are refused until the caps exist; a real image is
 * re-encoded and sized; an SVG, a renamed file and an oversized file are refused; vendor B cannot list or remove vendor A's picture; a banner of another category is refused; staff set up a Free
 * site on the vendor's behalf and the activity log names the staff member; MARKETING is refused. Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there).
 */
process.env.MEDIA_STORAGE_MODE = 'fake';
jest.setTimeout(180_000);

describe('media and the Banner Library on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let B: SeededTenant; let tokenA: string; let tokenB: string; let ops: string; let mkt: string;
  const png = (extra = 0) => sharp({ create: { width: 64 + extra, height: 32, channels: 3, background: '#336699' } }).png().toBuffer();
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string) => request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`);
  const setSetting = async (key: string, valueJson: unknown) => { await prisma.v3PlanSetting.upsert({ where: { key }, create: { key, valueJson: valueJson as never }, update: { valueJson: valueJson as never } }); app.get(WebsiteSettingsService).invalidate(); };

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true, activity: true, website: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p55ma', RUN_ID); B = await seedTenant(prisma, 'p55mb', RUN_ID);
    await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: false }); await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: false });
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email);
    ops = await seedStaff(prisma, 'p55mops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p55mmkt', RUN_ID, 'MARKETING');
  }, 240000);

  afterAll(async () => {
    await runCleanup([() => prisma.v3BannerImage.deleteMany({ where: { altText: { startsWith: 'V3TEST' } } }), () => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]);
  }, 180000);

  it('uploads are refused until the caps are set; then a real picture is stored under the vendor, an SVG and a renamed file are not', async () => {
    for (const k of ['mediaMaxBytes', 'mediaAllowedTypes', 'mediaMaxPixels']) await prisma.v3PlanSetting.deleteMany({ where: { key: k } });
    app.get(WebsiteSettingsService).invalidate();
    const no = await api('post', '/v3/me/site/media', tokenA).field('alt', 'V3TEST tap').attach('file', await png(), { filename: 'a.png', contentType: 'image/png' });
    expect(no.status).toBe(409); expect(no.body.code).toBe('MEDIA_NOT_CONFIGURED');
    await setSetting('mediaMaxBytes', 200_000); await setSetting('mediaAllowedTypes', ['image/png', 'image/jpeg']); await setSetting('mediaMaxPixels', 4_000_000);
    const ok = await api('post', '/v3/me/site/media', tokenA).field('alt', 'V3TEST tap').attach('file', await png(), { filename: 'a.png', contentType: 'image/png' });
    expect(ok.status).toBe(200); expect(ok.body.data).toMatchObject({ width: 64, height: 32, altText: 'V3TEST tap' });
    expect(await prisma.v3SitePicture.count({ where: { vendorId: A.vendorId } })).toBe(1);
    const noAlt = await api('post', '/v3/me/site/media', tokenA).attach('file', await png(1), { filename: 'b.png', contentType: 'image/png' });
    expect(noAlt.status).toBe(422); expect(noAlt.body.code).toBe('ALT_REQUIRED');
    const svg = await api('post', '/v3/me/site/media', tokenA).field('alt', 'V3TEST svg').attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), { filename: 's.svg', contentType: 'image/svg+xml' });
    expect(svg.status).toBe(422); expect(svg.body.code).toBe('MEDIA_TYPE_NOT_ALLOWED');
    const renamed = await api('post', '/v3/me/site/media', tokenA).field('alt', 'V3TEST renamed').attach('file', await png(2), { filename: 'r.jpg', contentType: 'image/jpeg' });
    expect(renamed.status).toBe(422); expect(renamed.body.code).toBe('MEDIA_TYPE_MISMATCH');
    await setSetting('mediaMaxBytes', 100);
    const big = await api('post', '/v3/me/site/media', tokenA).field('alt', 'V3TEST big').attach('file', await png(3), { filename: 'big.png', contentType: 'image/png' });
    expect(big.status).toBe(413);
  });

  it('vendor B cannot list or remove vendor A\'s picture', async () => {
    const mine = await api('get', '/v3/me/site/media', tokenA); const id = mine.body.data[0].id;
    expect((await api('get', '/v3/me/site/media', tokenB)).body.data).toEqual([]);
    expect((await api('delete', `/v3/me/site/media/${id}`, tokenB)).status).toBe(404);
    expect((await api('get', '/v3/me/site/media', tokenA)).body.data).toHaveLength(1);
  });

  it('banners: the vendor sees its own category; staff set one up on the vendor\'s behalf, it goes live, the activity names the staff member; MARKETING is refused', async () => {
    const mk = (categoryId: string, n: string) => prisma.v3BannerImage.create({ data: { categoryId, storagePath: `banner-library/${categoryId}/${n}.jpg`, url: `https://media.example.test/banner-library/${categoryId}/${n}.jpg`, contentType: 'image/jpeg', bytes: 10, width: 1600, height: 600, altText: `V3TEST ${n}`, sourceUrl: `https://src.example.test/${n}`, author: 'V3TEST', licenceName: 'CC0', obtainedOn: '2026-10-01', sha256: `${RUN_ID}${n}` } });
    const plumber = await mk('plumber', 'p1'); const dentist = await mk('dentist', 'd1');
    const list = await api('get', '/v3/me/site/banners', tokenA);
    const ids = list.body.data.map((b: { id: string }) => b.id); expect(ids).toContain(plumber.id); expect(ids).not.toContain(dentist.id);
    expect((await api('post', '/v3/me/site/banner', tokenA).send({ bannerId: dentist.id })).status).toBe(404);
    expect((await api('get', '/v3/admin/banner-library', mkt)).status).toBe(200);
    expect((await api('post', `/v3/admin/vendors/${A.vendorId}/site/banner`, mkt).send({ bannerId: plumber.id })).status).toBe(403);
    const staff = await api('post', `/v3/admin/vendors/${A.vendorId}/site/banner`, ops).send({ bannerId: plumber.id });
    expect(staff.status).toBe(200); expect(staff.body.data.published).toBe(true);
    const rows = await prisma.v3ActivityLog.findMany({ where: { vendorId: A.vendorId, actorType: 'STAFF' } });
    expect(rows.some((r) => r.actionKey.includes('site_banner'))).toBe(true);
    const lib = await api('get', '/v3/admin/banner-library?categoryId=plumber', ops);
    expect(lib.body.data.find((b: { id: string }) => b.id === plumber.id)).toMatchObject({ author: 'V3TEST', licenceName: 'CC0', sourceUrl: expect.stringContaining('https://') });
  });
});
