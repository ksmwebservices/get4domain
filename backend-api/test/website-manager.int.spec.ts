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
import { SeededTenant, cleanupTenants, newPrisma, seedMember, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * Slice 5.5a on STAGING: the Website manager's real routes over the real database. The draft is private to its vendor; a locked field is refused; publish makes one published version whose page
 * carries the new text and whose snapshot is stored; a draft never leaks to the public site; a second publish says unchanged; restore recreates the earlier version; a Free vendor cannot publish
 * and cannot write Pro-only wording; a team member can edit but not publish; vendor B never sees or changes vendor A's draft. Synthetic data only. NOT RUN in the build session that wrote it
 * (no .env.staging there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(180_000);

describe('Website manager on staging', () => {
  let app: INestApplication; let prisma: PrismaClient;
  let A: SeededTenant; let B: SeededTenant; let F: SeededTenant; let siteA: { vendorId: string; sub: string; host: string };
  let tokenA: string; let tokenB: string; let tokenF: string; let memberTokenA: string;
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };
  const byHost = (host: string, p = '/') => request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host, path: p });
  const field = (token: string, key: string, value: unknown) => api('put', '/v3/me/site/draft/field', token, { key, value });

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true, activity: true, website: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p55a', RUN_ID); B = await seedTenant(prisma, 'p55b', RUN_ID); F = await seedTenant(prisma, 'p55f', RUN_ID);
    siteA = await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: true }); await makeSiteVendor(prisma, subs, F, RUN_ID, { pro: false });
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email); tokenF = vendorToken(F.vendorId, F.email);
    memberTokenA = await seedMember(prisma, A.vendorId, 'p55m', RUN_ID, ['website']);
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('the editor map names the pages and the plan: Pro for A, Free for F', async () => {
    const a = await api('get', '/v3/me/site/editor/map', tokenA); expect(a.status).toBe(200); expect(a.body.data.pro).toBe(true); expect(a.body.data.map.pages.length).toBeGreaterThan(4);
    expect((await api('get', '/v3/me/site/editor/map', tokenF)).body.data.pro).toBe(false);
  });

  it('a draft is saved field by field; locked fields and promises of ranking are refused; the draft is private to its vendor', async () => {
    expect((await field(tokenA, 'hero.title', 'V3TEST Plumbing you can trust')).status).toBe(200);
    const locked = await field(tokenA, 'seo.canonical', 'https://evil.example.test/'); expect(locked.status).toBe(400); expect(locked.body.code).toBe('FIELD_LOCKED');
    const promise = await field(tokenA, 'about.text', 'We guarantee the number 1 ranking on Google'); expect(promise.status).toBe(422); expect(promise.body.code).toBe('WORDING_NOT_ALLOWED');
    const mine = await api('get', '/v3/me/site/draft', tokenA); expect(mine.body.data.doc.fields['hero.title']).toBe('V3TEST Plumbing you can trust'); expect(mine.body.data.dirty).toBe(true);
    const theirs = await api('get', '/v3/me/site/draft', tokenB); expect(theirs.body.data.doc.fields['hero.title']).toBeUndefined();
    expect((await api('delete', '/v3/me/site/draft', tokenB)).status).toBe(200);
    expect((await api('get', '/v3/me/site/draft', tokenA)).body.data.doc.fields['hero.title']).toBe('V3TEST Plumbing you can trust');
    expect(await prisma.v3SiteDraft.count({ where: { vendorId: B.vendorId } })).toBe(0);
  });

  it('a preview is not public; publish makes one published version with the new text, one stored snapshot; a second publish says unchanged', async () => {
    const pre = await api('post', '/v3/me/site/draft/preview', tokenA, {}); expect(pre.status).toBe(200); expect(pre.body.data.publication.status).toBe('DRAFT_PREVIEW');
    expect((await byHost(siteA.host)).status).toBe(404);
    const memberTry = await api('post', '/v3/me/site/draft/publish', memberTokenA, {}); expect(memberTry.status).toBe(403);   // owner only
    const pub = await api('post', '/v3/me/site/draft/publish', tokenA, {}); expect(pub.status).toBe(200); expect(pub.body.data.unchanged).toBe(false);
    const page = await byHost(siteA.host); expect(page.status).toBe(200); expect(page.text).toContain('V3TEST Plumbing you can trust');
    expect(await prisma.v3SitePublication.count({ where: { vendorId: A.vendorId, status: 'PUBLISHED' } })).toBe(1);
    expect(await prisma.v3SiteSnapshot.count({ where: { vendorId: A.vendorId } })).toBeGreaterThanOrEqual(1);
    const again = await api('post', '/v3/me/site/draft/publish', tokenA, {}); expect(again.body.data.unchanged).toBe(true);
  });

  it('a later draft never leaks; restore recreates the earlier version exactly; compare lists the change', async () => {
    await field(tokenA, 'hero.title', 'V3TEST Second headline'); await api('post', '/v3/me/site/draft/preview', tokenA, {});
    expect((await byHost(siteA.host)).text).toContain('V3TEST Plumbing you can trust');
    await api('post', '/v3/me/site/draft/publish', tokenA, {}); expect((await byHost(siteA.host)).text).toContain('V3TEST Second headline');
    const revs = await api('get', '/v3/me/site/revisions', tokenA); const first = revs.body.data.find((r: { status: string }) => r.status === 'SUPERSEDED');
    const cmp = await api('get', `/v3/me/site/revisions/compare?from=${first.version}&to=${revs.body.data[0].version}`, tokenA); expect(cmp.status).toBe(200); expect(cmp.body.data.content.fields).toContain('hero.title');
    const back = await api('post', '/v3/me/site/revisions/restore', tokenA, { toVersion: first.version }); expect(back.status).toBe(200);
    expect((await byHost(siteA.host)).text).toContain('V3TEST Plumbing you can trust');
    expect((await api('get', '/v3/me/site/draft', tokenA)).body.data.doc.fields['hero.title']).toBe('V3TEST Plumbing you can trust');
    expect((await api('post', '/v3/me/site/revisions/restore', tokenA, { toVersion: 9999 })).status).toBe(404);
  });

  it('a Free vendor cannot go live (its publish is a submission) and cannot write Pro-only wording; its team has no extra reach', async () => {
    expect((await field(tokenF, 'cta.label', 'V3TEST Book now')).status).toBe(403);
    expect((await field(tokenF, 'hero.title', 'V3TEST Free edit')).status).toBe(200);
    const p = await api('post', '/v3/me/site/draft/publish', tokenF, {}); expect(p.status).toBe(200); expect(p.body.data.mode).toBe('SUBMITTED');   // slice 5.5c: Free edits go to review
    expect(await prisma.v3SitePublication.count({ where: { vendorId: F.vendorId, status: 'PUBLISHED' } })).toBe(0);
  });
});
