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
 * Slice 5.5c on STAGING (amendment 06): Free edits go to review over the real database. A Free submission never goes live before approval; one submission waits at a time; staff approve or reject
 * (a reason is required); a rejection keeps the old content; the vendor sees the decision and the reason; vendor B cannot see vendor A's submission; MARKETING is refused; a Pro edit goes live at
 * once with no submission row. Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(180_000);

describe('review of Free edits on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let F: SeededTenant; let G: SeededTenant; let P: SeededTenant; let siteF: { vendorId: string; sub: string; host: string };
  let tokenF: string; let tokenG: string; let tokenP: string; let ops: string; let mkt: string;
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };
  const byHost = (host: string) => request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host, path: '/' });
  const edit = (token: string, value: string) => api('put', '/v3/me/site/draft/field', token, { key: 'hero.title', value });

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true, activity: true, website: true });
    const subs = app.get(SubscriptionsService);
    F = await seedTenant(prisma, 'p55rf', RUN_ID); G = await seedTenant(prisma, 'p55rg', RUN_ID); P = await seedTenant(prisma, 'p55rp', RUN_ID);
    siteF = await makeSiteVendor(prisma, subs, F, RUN_ID, { pro: false }); await makeSiteVendor(prisma, subs, G, RUN_ID, { pro: false }); await makeSiteVendor(prisma, subs, P, RUN_ID, { pro: true });
    tokenF = vendorToken(F.vendorId, F.email); tokenG = vendorToken(G.vendorId, G.email); tokenP = vendorToken(P.vendorId, P.email);
    ops = await seedStaff(prisma, 'p55rops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p55rmkt', RUN_ID, 'MARKETING');
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('a Free edit is a submission: not live, staff are told, one at a time; B cannot see it; MARKETING is refused', async () => {
    expect((await edit(tokenF, 'V3TEST Free headline')).status).toBe(200);
    const s = await api('post', '/v3/me/site/draft/publish', tokenF, {}); expect(s.status).toBe(200); expect(s.body.data.mode).toBe('SUBMITTED'); const id = s.body.data.submission.id;
    expect((await byHost(siteF.host)).status).toBe(404);
    expect(await prisma.v3Notification.count({ where: { kind: 'CONTENT_SUBMITTED', refId: id } })).toBe(2);
    await edit(tokenF, 'V3TEST Another'); const again = await api('post', '/v3/me/site/draft/publish', tokenF, {}); expect(again.status).toBe(409); expect(again.body.code).toBe('SUBMISSION_PENDING');
    expect((await api('get', `/v3/me/site/submissions/${id}`, tokenG)).status).toBe(404); expect((await api('get', '/v3/me/site/submissions', tokenG)).body.data).toEqual([]);
    expect((await api('get', '/v3/admin/content-reviews', mkt)).status).toBe(403); expect((await api('post', `/v3/admin/content-reviews/${id}/approve`, mkt)).status).toBe(403);
    const list = await api('get', '/v3/admin/content-reviews?status=SUBMITTED', ops); expect(list.body.data.items.some((i: { id: string }) => i.id === id)).toBe(true);
  });

  it('approve puts it live and tells the vendor; a later rejection keeps the approved content and records the reason; a decided submission cannot be decided again', async () => {
    const first = (await api('get', '/v3/me/site/submissions', tokenF)).body.data[0];
    const ok = await api('post', `/v3/admin/content-reviews/${first.id}/approve`, ops); expect(ok.status).toBe(200); expect(ok.body.data.status).toBe('APPROVED');
    expect((await byHost(siteF.host)).text).toContain('V3TEST Free headline');
    expect(await prisma.v3Notification.count({ where: { userId: F.vendorId, kind: 'CONTENT_APPROVED', refId: first.id } })).toBe(1);
    expect((await api('post', `/v3/admin/content-reviews/${first.id}/approve`, ops)).status).toBe(409);
    await edit(tokenF, 'V3TEST Rejected text'); const second = (await api('post', '/v3/me/site/draft/publish', tokenF, {})).body.data.submission.id;
    expect((await api('post', `/v3/admin/content-reviews/${second}/reject`, ops, { reason: '' })).status).toBe(422);
    const rej = await api('post', `/v3/admin/content-reviews/${second}/reject`, ops, { reason: 'The headline names another business.' }); expect(rej.status).toBe(200); expect(rej.body.data.status).toBe('REJECTED');
    const page = (await byHost(siteF.host)).text; expect(page).toContain('V3TEST Free headline'); expect(page).not.toContain('V3TEST Rejected text');
    expect((await api('get', `/v3/me/site/submissions/${second}`, tokenF)).body.data.reason).toBe('The headline names another business.');
    expect(await prisma.v3Notification.count({ where: { userId: F.vendorId, kind: 'CONTENT_REJECTED', refId: second } })).toBe(1);
    const rows = await prisma.v3ActivityLog.findMany({ where: { vendorId: F.vendorId, actionKey: { startsWith: 'content_submission.' } } }); expect(rows.map((r) => r.actionKey)).toEqual(expect.arrayContaining(['content_submission.submitted', 'content_submission.approved', 'content_submission.rejected']));
  });

  it('a Pro edit goes live at once and leaves no submission row', async () => {
    await edit(tokenP, 'V3TEST Pro headline'); const r = await api('post', '/v3/me/site/draft/publish', tokenP, {}); expect(r.status).toBe(200); expect(r.body.data.mode).toBe('LIVE');
    expect(await prisma.v3ContentSubmission.count({ where: { vendorId: P.vendorId } })).toBe(0);
  });
});
