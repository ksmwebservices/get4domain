// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { StepError } from '../src/provisioning/provisioning.errors';
import { SiteProvisioner } from '../src/provisioning/site/site-provisioner';
import { cleanupTenants, newPrisma, seedStaff } from './support/fixtures';
import { logJobTimings, timed } from './support/job-timing';
import { buildProvisioningTestApp } from './support/provisioning-test-app';

// each test runs a five-step job against a remote database: 30 s was always too tight
jest.setTimeout(120_000);

/**
 * S53.8 on STAGING, the whole flow with the real database, the real providers and the sandbox invite adapter (nothing is sent):
 * a job runs end to end; a step that fails once is retried without duplicating anything; expired, used and revoked tokens answer the uniform 404.
 * Synthetic data only (@v3test.invalid, V3TEST names, job keys v3test-<run>-...), removed at the end.
 * NOT RUN in the build session that wrote it (no .env.staging there).
 */
describe('provisioning flow on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let ops: string; let mkt: string;
  let failSiteOnce = false; let siteCalls = 0;
  let seq = 0;
  const phone = (): string => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const biz = (label: string) => ({
    businessName: `V3TEST ${label} ${RUN_ID}`, track: 'handyman', category: 'plumber', ownerName: 'V3TEST Owner', phone: phone(), email: `p53${label}-${RUN_ID}@v3test.invalid`, city: 'Chennai', language: 'en',
  });
  const key = (): string => `v3test-${RUN_ID}-flow-${++seq}`;
  const create = (body: object, k = key()) => request(app.getHttpServer()).post('/v3/admin/provisioning/jobs').set('Authorization', `Bearer ${ops}`).set('Idempotency-Key', k).send(body);
  const run = async (id: string): Promise<request.Response> => {
    const t0 = Date.now();
    const r = await request(app.getHttpServer()).post(`/v3/admin/provisioning/jobs/${id}/run`).set('Authorization', `Bearer ${ops}`);
    await logJobTimings(prisma, id, Date.now() - t0);
    return r;
  };
  const status = (token: string) => request(app.getHttpServer()).get(`/v3/claim/${token}/status`);
  const tokenFromInvite = async (vendorId: string): Promise<string> => {
    const inv = await prisma.v3Invite.findFirstOrThrow({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
    return /\/claim\/([A-Za-z0-9_-]{43})/.exec(inv.sandboxBody ?? '')![1];
  };

  beforeAll(async () => {
    prisma = newPrisma();
    const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
    await applySeed(new PrismaSeedStore(prisma), expandSeed(seed), { apply: true });
    ops = await seedStaff(prisma, 'p53ops', RUN_ID, 'OPERATIONS');
    mkt = await seedStaff(prisma, 'p53mkt', RUN_ID, 'MARKETING');
    app = await timed('nest test app boot', () => buildProvisioningTestApp({
      siteProvisioner: (real): SiteProvisioner => ({
        createDraftSite: async (i) => { siteCalls++; if (failSiteOnce) { failSiteOnce = false; throw new StepError('ADAPTER_TIMEOUT', true); } return real.createDraftSite(i); },
      }),
    }));
  }, 180000);

  afterAll(async () => {
    try { await cleanupTenants(prisma, RUN_ID); } finally { await app?.close(); await prisma?.$disconnect(); }
  }, 120000);

  it('MARKETING is refused; OPERATIONS creates a job', async () => {
    const denied = await request(app.getHttpServer()).post('/v3/admin/provisioning/jobs').set('Authorization', `Bearer ${mkt}`).set('Idempotency-Key', key()).send(biz('deny'));
    expect(denied.status).toBe(403);
    expect(await prisma.vendor.count({ where: { email: { contains: `p53deny-${RUN_ID}` } } })).toBe(0);
  });

  it('a job runs end to end: vendor, Free plan, DRAFT site, claim link, sandbox invite; the claim link then works exactly once', async () => {
    const input = biz('happy');
    const created = await create(input);
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    const ran = await run(id);
    expect(ran.status).toBe(200);
    expect(ran.body.data.status).toBe('SUCCEEDED');
    expect(ran.body.data.steps.map((s: { status: string }) => s.status)).toEqual(['DONE', 'DONE', 'DONE', 'DONE', 'DONE']);

    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { email: input.email } });
    expect(vendor).toMatchObject({ status: 'PENDING', source: 'STAFF', businessName: input.businessName });
    expect(vendor.registeredByStaffId).not.toBeNull();
    expect(ran.body.data.vendorId).toBe(vendor.id);
    expect(vendor.password.startsWith('$2')).toBe(true);   // an unusable random bcrypt hash, never a known password

    const sub = await prisma.v3PlanSubscription.findFirstOrThrow({ where: { vendorId: vendor.id }, include: { plan: true } });
    expect(sub.plan.key).toBe('handyman_free');
    expect(sub.source).toBe('STAFF');

    const site = await prisma.vendorCMS.findUniqueOrThrow({ where: { vendorId: vendor.id } });
    expect(site.siteStatus).toBe('DRAFT');

    const tokens = await prisma.v3ClaimToken.findMany({ where: { vendorId: vendor.id } });
    expect(tokens).toHaveLength(1);
    const raw = await tokenFromInvite(vendor.id);
    expect(tokens[0].tokenHash).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(tokens[0].status).toBe('ACTIVE');

    const invites = await prisma.v3Invite.findMany({ where: { vendorId: vendor.id } });
    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({ adapterMode: 'SANDBOX', status: 'SENT', toAddress: input.email });
    expect(invites[0].bodyPreview).not.toContain(raw);

    // the raw token is in no other table: job, steps, audit
    const job = await prisma.v3ProvisioningJob.findUniqueOrThrow({ where: { id }, include: { steps: true } });
    const audit = await prisma.v3AuditLog.findMany({ where: { entityId: { in: [id, vendor.id, tokens[0].id] } } });
    expect(JSON.stringify([job, audit])).not.toContain(raw);

    const ok = await status(raw);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ valid: true, businessName: input.businessName });
  });

  it('a step that fails once is retried by the next run without duplicating the vendor, plan, site, link or invite', async () => {
    const input = biz('retry');
    failSiteOnce = true; const before = siteCalls;
    const id = (await create(input)).body.data.id as string;
    const first = await run(id);
    expect(first.body.data.status).toBe('WAITING');
    expect(first.body.data.lastErrorCode).toBe('ADAPTER_TIMEOUT');
    expect(first.body.data.steps.map((s: { status: string }) => s.status)).toEqual(['DONE', 'DONE', 'FAILED', 'PENDING', 'PENDING']);
    const second = await run(id);   // "run" makes a waiting job due at once
    expect(second.body.data.status).toBe('SUCCEEDED');
    expect(siteCalls - before).toBe(2);

    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { email: input.email } });
    expect(await prisma.vendor.count({ where: { email: input.email } })).toBe(1);
    expect(await prisma.v3PlanSubscription.count({ where: { vendorId: vendor.id } })).toBe(1);
    expect(await prisma.vendorCMS.count({ where: { vendorId: vendor.id } })).toBe(1);
    expect(await prisma.v3ClaimToken.count({ where: { vendorId: vendor.id, status: 'ACTIVE' } })).toBe(1);
    expect(await prisma.v3Invite.count({ where: { vendorId: vendor.id, status: 'SENT' } })).toBe(1);
  });

  it('the same Idempotency-Key returns the same job and runs nothing twice', async () => {
    const k = key(); const input = biz('idem');
    const a = await create(input, k); const b = await create(input, k);
    expect(a.status).toBe(201); expect(b.status).toBe(200); expect(b.body.data.id).toBe(a.body.data.id);
    await run(a.body.data.id);
    expect(await prisma.v3ProvisioningJob.count({ where: { idempotencyKey: k } })).toBe(1);
    expect(await prisma.vendor.count({ where: { email: input.email } })).toBe(1);
  });

  it('a duplicate business (same email) fails permanently with DUPLICATE_BUSINESS, naming the existing vendor to staff only', async () => {
    const input = biz('dupe');
    await run((await create(input)).body.data.id);
    const again = { ...input, phone: phone() };   // same email, different phone
    const id = (await create(again)).body.data.id as string;
    const r = await run(id);
    expect(r.body.data.status).toBe('FAILED');
    expect(r.body.data.lastErrorCode).toBe('DUPLICATE_BUSINESS');
    const existing = await prisma.vendor.findUniqueOrThrow({ where: { email: input.email } });
    expect(r.body.data.steps[0].outputRef).toMatchObject({ existingVendorId: existing.id });
    expect(await prisma.vendor.count({ where: { email: input.email } })).toBe(1);
  });

  it('unknown, expired, used and revoked tokens all give the SAME 404 body', async () => {
    const input = biz('tok');
    await run((await create(input)).body.data.id);
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { email: input.email } });
    const live = await tokenFromInvite(vendor.id);
    const strip = (r: request.Response) => JSON.stringify({ ...r.body, timestamp: undefined });
    const unknown = await status('A'.repeat(43));
    expect(unknown.status).toBe(404);

    // expired: move the expiry into the past
    await prisma.v3ClaimToken.updateMany({ where: { vendorId: vendor.id, status: 'ACTIVE' }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await status(live);
    expect(expired.status).toBe(404); expect(strip(expired)).toBe(strip(unknown));

    // reissue (staff) -> a new link works; then it is used up, and a used token is the same 404
    const re = await request(app.getHttpServer()).post(`/v3/admin/vendors/${vendor.id}/claim-link/reissue`).set('Authorization', `Bearer ${ops}`);
    expect(re.status).toBe(200);
    const fresh = await tokenFromInvite(vendor.id);
    expect(fresh).not.toBe(live);
    expect((await status(fresh)).status).toBe(200);
    const row = await prisma.v3ClaimToken.findFirstOrThrow({ where: { vendorId: vendor.id, status: 'ACTIVE' } });
    const used = await prisma.v3ClaimToken.updateMany({ where: { id: row.id, status: 'ACTIVE' }, data: { status: 'USED', usedAt: new Date(), activeKey: null } });
    expect(used.count).toBe(1);
    const usedRes = await status(fresh);
    expect(usedRes.status).toBe(404); expect(strip(usedRes)).toBe(strip(unknown));

    // revoked
    const input2 = biz('rev');
    await run((await create(input2)).body.data.id);
    const v2 = await prisma.vendor.findUniqueOrThrow({ where: { email: input2.email } });
    const t2 = await tokenFromInvite(v2.id);
    await request(app.getHttpServer()).post(`/v3/admin/vendors/${v2.id}/claim-link/revoke`).set('Authorization', `Bearer ${ops}`);
    const revoked = await status(t2);
    expect(revoked.status).toBe(404); expect(strip(revoked)).toBe(strip(unknown));
    expect((await prisma.v3Invite.findFirstOrThrow({ where: { vendorId: v2.id } })).sandboxBody).toBeNull();   // the revoked link is no longer kept in the sandbox body
  });
});
