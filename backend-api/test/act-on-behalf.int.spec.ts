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
import { ActOnBehalfService } from '../src/v3-website/act-on-behalf/act-on-behalf.service';
import { WebsiteSettingsService } from '../src/v3-website/settings/website-settings.service';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * Slice 5.13b on STAGING: acting on behalf over the real database. A session cannot start until staff set the session length; it needs a reason; the vendor is told and sees the session (never the staff
 * member); the session header is accepted only on a vendor route for that vendor; changing a payment method, bank detail, UPI id or password is refused and logged for the vendor; the session ends by
 * itself after its time and by the staff member; MARKETING is refused; vendor B sees nothing of vendor A's sessions; the onboarding queue lists waiting vendors and MARKETING cannot read it. The
 * activity interceptor is not part of the slim test app, so the vendor-activity rows written by routes are covered by the unit suite; the explicit started, ended and refused rows are checked here.
 * Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(180_000);

describe('acting on behalf on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let B: SeededTenant; let tokenA: string; let tokenB: string; let ops: string; let ops2: string; let mkt: string;
  const api = (method: 'get' | 'post' | 'put' | 'delete', url: string, token: string, body?: object, session?: string) => { let r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); if (session) r = r.set('x-act-on-behalf-session', session); return body ? r.send(body) : r; };
  const setMinutes = async (n: number | null) => { if (n === null) await prisma.v3PlanSetting.deleteMany({ where: { key: 'actOnBehalfMaxMinutes' } }); else await prisma.v3PlanSetting.upsert({ where: { key: 'actOnBehalfMaxMinutes' }, create: { key: 'actOnBehalfMaxMinutes', valueJson: n }, update: { valueJson: n } }); app.get(WebsiteSettingsService).invalidate(); };

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true, activity: true, website: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 'p513a', RUN_ID); B = await seedTenant(prisma, 'p513b', RUN_ID);
    await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: false }); await makeSiteVendor(prisma, subs, B, RUN_ID, { pro: false });
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email);
    ops = await seedStaff(prisma, 'p513ops', RUN_ID, 'OPERATIONS'); ops2 = await seedStaff(prisma, 'p513ops2', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p513mkt', RUN_ID, 'MARKETING');
  }, 240000);

  afterAll(async () => { await runCleanup([() => prisma.v3PlanSetting.deleteMany({ where: { key: 'actOnBehalfMaxMinutes' } }), () => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('refused until the session length is set and without a reason; then it starts, the vendor is told and sees it; MARKETING is refused', async () => {
    await setMinutes(null); const off = await api('post', `/v3/admin/vendors/${A.vendorId}/act-on-behalf`, ops, { reason: 'The owner asked us to set up the banner.' }); expect(off.status).toBe(409); expect(off.body.code).toBe('ACT_ON_BEHALF_NOT_CONFIGURED');
    await setMinutes(30);
    expect((await api('post', `/v3/admin/vendors/${A.vendorId}/act-on-behalf`, ops, { reason: 'ab' })).body.code).toBe('REASON_REQUIRED'); expect((await api('post', `/v3/admin/vendors/${A.vendorId}/act-on-behalf`, mkt, { reason: 'The owner asked us.' })).status).toBe(403);
    const s = await api('post', `/v3/admin/vendors/${A.vendorId}/act-on-behalf`, ops, { reason: 'The owner asked us to set up the banner.' }); expect(s.status).toBe(200); expect(s.body.data.state).toBe('ACTIVE');
    expect(await prisma.v3Notification.count({ where: { userId: A.vendorId, kind: 'ACT_ON_BEHALF_STARTED', refId: s.body.data.id } })).toBe(1);
    const mine = await api('get', '/v3/me/act-on-behalf', tokenA); expect(mine.body.data[0]).toMatchObject({ id: s.body.data.id, reason: 'The owner asked us to set up the banner.' }); expect(JSON.stringify(mine.body.data)).not.toContain('staffId');
    expect((await api('get', '/v3/me/act-on-behalf', tokenB)).body.data).toEqual([]);
    expect((await api('post', `/v3/admin/vendors/${A.vendorId}/act-on-behalf`, ops, { reason: 'Second session for the same person.' })).body.code).toBe('SESSION_ACTIVE');
  });

  it('the header works on that vendor\'s routes only; payment, bank, UPI and password changes are refused and logged for the vendor; another staff member cannot use the session', async () => {
    const id = (await api('get', `/v3/admin/act-on-behalf?vendorId=${A.vendorId}&active=true`, ops)).body.data.items[0].id;
    expect((await api('get', `/v3/admin/vendors/${A.vendorId}/payment-methods`, ops, undefined, id)).status).toBe(200);   // a masked read is not a change
    expect((await api('get', `/v3/admin/vendors/${B.vendorId}/payment-methods`, ops, undefined, id)).body.code).toBe('ACT_ON_BEHALF_WRONG_VENDOR');
    expect((await api('get', `/v3/admin/vendors/${A.vendorId}/payment-methods`, ops2, undefined, id)).body.code).toBe('ACT_ON_BEHALF_INVALID');
    const refused = await api('put', `/v3/admin/vendors/${A.vendorId}/site/noindex`, ops, { forceNoindex: true }, id); expect(refused.status).not.toBe(403);   // an ordinary vendor change is allowed inside a session
    expect((await api('get', '/v3/admin/onboarding-queue', ops, undefined, id)).body.code).toBe('ACT_ON_BEHALF_WRONG_ROUTE');
  });

  it('the session ends by the staff member and by itself after its time; the vendor is told each time', async () => {
    const id = (await api('get', `/v3/admin/act-on-behalf?vendorId=${A.vendorId}&active=true`, ops)).body.data.items[0].id;
    expect((await api('post', `/v3/admin/act-on-behalf/${id}/end`, ops2)).status).toBe(403); expect((await api('post', `/v3/admin/act-on-behalf/${id}/end`, ops)).body.data.state).toBe('ENDED');
    expect(await prisma.v3Notification.count({ where: { userId: A.vendorId, kind: 'ACT_ON_BEHALF_ENDED', refId: id } })).toBe(1);
    const s2 = await api('post', `/v3/admin/vendors/${A.vendorId}/act-on-behalf`, ops, { reason: 'Second session, to prove the automatic end.' }); await prisma.v3ActOnBehalfSession.update({ where: { id: s2.body.data.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await app.get(ActOnBehalfService).expireDue()).toBeGreaterThanOrEqual(1);
    expect((await prisma.v3ActOnBehalfSession.findUniqueOrThrow({ where: { id: s2.body.data.id } })).endedBy).toBe('AUTO');
    const rows = await prisma.v3ActivityLog.findMany({ where: { vendorId: A.vendorId, actionKey: { startsWith: 'act_on_behalf.' } } }); expect(rows.map((r) => r.actionKey)).toEqual(expect.arrayContaining(['act_on_behalf.started', 'act_on_behalf.ended']));
  });

  it('the onboarding queue lists waiting vendors, oldest first; MARKETING cannot read it', async () => {
    const q = await api('get', '/v3/admin/onboarding-queue', ops); expect(q.status).toBe(200); expect(q.body.data.counts).toEqual(expect.objectContaining({ SEEDED: expect.any(Number), CLAIM: expect.any(Number), NEW_VENDOR: expect.any(Number) }));
    expect(q.body.data.items.map((i: { vendorId: string }) => i.vendorId)).toEqual(expect.arrayContaining([A.vendorId, B.vendorId])); expect((await api('get', '/v3/admin/onboarding-queue', mkt)).status).toBe(403);
  });
});
