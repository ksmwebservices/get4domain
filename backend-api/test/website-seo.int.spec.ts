// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * Slice B1 on STAGING: per-page SEO over the real database. A page's own title and description reach the live page head; locked parts and promises are refused; the staff projection holds the
 * effective text of every page and the report names what to fix; vendor B cannot touch vendor A's draft; all staff roles can read the report. Synthetic data only. NOT RUN in the build session
 * that wrote it (no .env.staging there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(180_000);

describe('per-page SEO on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let B: SeededTenant; let siteA: { vendorId: string; sub: string; host: string }; let tokenA: string; let tokenB: string; let ops: string; let mkt: string;
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };
  const byHost = (host: string, p = '/') => request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host, path: p });

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true, activity: true, website: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p5b1a', RUN_ID); B = await seedTenant(prisma, 'p5b1b', RUN_ID);
    siteA = await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: true });
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email);
    ops = await seedStaff(prisma, 'p5b1ops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p5b1mkt', RUN_ID, 'MARKETING');
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('the panel shows defaults; a page\'s own text is saved, refused when it promises or touches a locked part, and reaches the live head after publish', async () => {
    const view = await api('get', '/v3/me/site/seo', tokenA); expect(view.status).toBe(200); expect(view.body.data.pages.find((p: { pageKey: string }) => p.pageKey === 'home').isCustomTitle).toBe(false);
    const ok = await api('put', '/v3/me/site/draft/seo/about', tokenA, { seoTitle: 'V3TEST About our family firm', seoDescription: 'V3TEST Three generations of plumbers serving Chennai homes with clear explanations.' }); expect(ok.status).toBe(200);
    const promise = await api('put', '/v3/me/site/draft/seo/about', tokenA, { seoTitle: 'We guarantee the number 1 ranking' }); expect(promise.status).toBe(422); expect(promise.body.code).toBe('WORDING_NOT_ALLOWED');
    const locked = await api('put', '/v3/me/site/draft/seo/about', tokenA, { canonical: 'https://evil.example.test/' }); expect(locked.status).toBe(400); expect(locked.body.code).toBe('FIELD_LOCKED');
    expect((await api('put', '/v3/me/site/draft/seo/page:nope', tokenA, { seoTitle: 'x' })).body.code).toBe('FIELD_LOCKED');
    expect((await api('post', '/v3/me/site/draft/publish', tokenA, {})).body.data.mode).toBe('LIVE');
    const about = await byHost(siteA.host, '/about'); expect(about.status).toBe(200); expect(about.text).toContain('<title>V3TEST About our family firm</title>');
  });

  it('the staff projection holds every page; the report is readable by all staff roles and filterable; vendor B has its own rows only', async () => {
    const rows = await prisma.v3PageSeo.findMany({ where: { vendorId: A.vendorId } }); expect(rows.find((r) => r.pageKey === 'about')).toMatchObject({ customTitle: true, customDescription: true }); expect(rows.length).toBeGreaterThan(4);
    expect((await api('get', `/v3/admin/vendors/${A.vendorId}/site/seo`, mkt)).status).toBe(200);
    const rep = await api('get', `/v3/admin/seo/pages?vendorId=${A.vendorId}&issue=DEFAULT_TITLE`, ops); expect(rep.status).toBe(200); expect(rep.body.data.items.every((i: { issue: string; vendorId: string }) => i.issue === 'DEFAULT_TITLE' && i.vendorId === A.vendorId)).toBe(true);
    expect(await prisma.v3PageSeo.count({ where: { vendorId: B.vendorId } })).toBe(0);
    expect((await api('get', '/v3/me/site/draft', tokenB)).body.data.doc.seo).toEqual({});
  });
});
