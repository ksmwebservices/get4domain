// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { applyDirectorySeed } from '../src/directory/seed/seed-applier';
import { DirectorySeed } from '../src/directory/seed/seed-file';
import { PrismaDirectorySeedStore } from '../src/directory/seed/prisma-seed-store';
import { AccountSetupGrantService } from '../src/directory/grants/account-setup-grant.service';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { cleanupTenants, newPrisma, seedStaff, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';

/**
 * B2 slice 5.7 on STAGING: the optional CREATE_DIRECTORY_PROFILE provisioning step, claim by phone OTP read from the SANDBOX message (nothing is sent), the setup grant, the public directory
 * API and the owner's profile, all with the real database. The seed (proposed places and categories) is loaded idempotently first, exactly as the owner will. Synthetic data only
 * (@v3test.invalid, V3TEST names). NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(180_000);

describe('public directory and claim by OTP on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let ops: string; let mkt: string; let previous: { existed: boolean; value: unknown } = { existed: false, value: null };
  const api = (method: 'get' | 'post' | 'put', url: string, token?: string, body?: object) => { const r = request(app.getHttpServer())[method](url); const t = token ? r.set('Authorization', `Bearer ${token}`) : r; return body ? t.send(body) : t; };
  const phone = (): string => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const job = (label: string) => ({ businessName: `V3TEST ${label} ${RUN_ID}`, track: 'handyman', category: 'plumber', ownerName: 'V3TEST Owner', phone: phone(), email: `p57${label}-${RUN_ID}@v3test.invalid`, city: 'Chennai', language: 'en' });
  const setFlag = async (v: boolean) => prisma.v3PlanSetting.upsert({ where: { key: 'provisioningDirectoryProfileEnabled' }, create: { key: 'provisioningDirectoryProfileEnabled', valueJson: v, description: 'v3test' }, update: { valueJson: v } });
  const runJob = async (label: string, idem: string) => {
    const created = await api('post', '/v3/admin/provisioning/jobs', ops, job(label)).set('Idempotency-Key', `v3test-${RUN_ID}-${idem}`);
    expect(created.status).toBe(201);
    return api('post', `/v3/admin/provisioning/jobs/${created.body.data.id}/run`, ops);
  };
  const rawClaimToken = async (vendorId: string): Promise<string> => {
    const inv = await prisma.v3Invite.findFirstOrThrow({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
    return /\/claim\/([A-Za-z0-9_-]{43})/.exec(inv.sandboxBody ?? '')![1];
  };

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    await applyDirectorySeed(new PrismaDirectorySeedStore(prisma), JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-directory.seed.json'), 'utf8')) as DirectorySeed, { apply: true });
    ops = await seedStaff(prisma, 'p57ops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p57mkt', RUN_ID, 'MARKETING');
    app = await buildProvisioningTestApp({ includeDirectoryApi: true });
    const before = await prisma.v3PlanSetting.findUnique({ where: { key: 'provisioningDirectoryProfileEnabled' } });
    previous = { existed: !!before, value: before?.valueJson ?? null };
  }, 240000);

  afterAll(async () => {
    await runCleanup([
      async () => { if (previous.existed) await prisma.v3PlanSetting.update({ where: { key: 'provisioningDirectoryProfileEnabled' }, data: { valueJson: previous.value as never } }); else await prisma.v3PlanSetting.deleteMany({ where: { key: 'provisioningDirectoryProfileEnabled' } }); },
      () => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect(),
    ]);
  }, 180000);

  it('with the setting OFF (the default) a job has the five slice 5.3 steps and creates no directory business', async () => {
    await setFlag(false);
    const ran = await runJob('off', 'off'); expect(ran.body.data.status).toBe('SUCCEEDED');
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { email: `p57off-${RUN_ID}@v3test.invalid` } });
    expect(await prisma.v3DirectoryBusiness.count({ where: { vendorId: vendor.id } })).toBe(0);
    expect((await prisma.v3ProvisioningStep.findMany({ where: { job: { vendorId: vendor.id } } })).map((s) => s.stepKey)).not.toContain('CREATE_DIRECTORY_PROFILE');
  });

  let vendorId = ''; let slug = ''; let claimToken = '';
  it('with the setting ON the job runs the extra step: an UNCLAIMED business, linked to the vendor, in the seeded Chennai and plumber, not indexable, with private details hidden publicly', async () => {
    await setFlag(true);
    const ran = await runJob('on', 'on'); expect(ran.body.data.status).toBe('SUCCEEDED');
    expect(ran.body.data.steps.map((s: { stepKey: string }) => s.stepKey)).toContain('CREATE_DIRECTORY_PROFILE');
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { email: `p57on-${RUN_ID}@v3test.invalid` } }); vendorId = vendor.id;
    const b = await prisma.v3DirectoryBusiness.findUniqueOrThrow({ where: { vendorId }, include: { category: true, location: true } });
    slug = b.slug;
    expect(b).toMatchObject({ status: 'UNCLAIMED', source: 'PROVISIONING', indexable: false }); expect(b.category.themeCategoryId).toBe('plumber'); expect(b.location?.name).toBe('Chennai');
    const pub = await api('get', `/v3/directory/businesses/${slug}`); expect(pub.status).toBe(200); expect(pub.body.data).toMatchObject({ claimed: false, phone: null, hours: {} });
    expect(JSON.stringify(pub.body)).not.toMatch(/p57on|vendorId|"id"/);
    expect((await api('get', '/v3/directory/businesses?category=plumber&location=tamil-nadu/chennai/chennai')).body.data.items.map((i: { slug: string }) => i.slug)).toContain(slug);
    expect((await api('get', '/v3/directory/sitemap-data?pageSize=100')).body.data.items.map((i: { slug: string }) => i.slug)).not.toContain(slug);
    claimToken = await rawClaimToken(vendorId);
  });

  it('claim by OTP: a wrong code is the uniform 400; the right code claims exactly once, marks the business CLAIMED, returns a single-use setup grant; replay fails', async () => {
    const asked = await api('post', `/v3/claim/${claimToken}/otp/request`); expect(asked.status).toBe(200);
    const unknown = await api('post', `/v3/claim/${'U'.repeat(43)}/otp/request`); expect(unknown.body.data).toEqual(asked.body.data);   // uniform
    const ch = await prisma.v3OtpChallenge.findFirstOrThrow({ where: { subjectType: 'CLAIM' }, orderBy: { createdAt: 'desc' } });
    expect(ch.sandboxBody).toMatch(/\d{6}/); expect(ch.codeHash).toMatch(/^[0-9a-f]{64}$/);
    const code = /(\d{6})/.exec(ch.sandboxBody!)![1];
    const wrong = await api('post', `/v3/claim/${claimToken}/otp/verify`, undefined, { code: code === '000000' ? '111111' : '000000' }); expect(wrong.status).toBe(400); expect(wrong.body.code).toBe('OTP_INVALID');
    const ok = await api('post', `/v3/claim/${claimToken}/otp/verify`, undefined, { code }); expect(ok.status).toBe(200); expect(ok.body.data).toMatchObject({ claimed: true, vendorId });
    expect(await prisma.v3ClaimToken.count({ where: { vendorId, status: 'USED' } })).toBe(1);
    expect(await prisma.v3DirectoryBusiness.findUniqueOrThrow({ where: { vendorId } })).toMatchObject({ status: 'CLAIMED' });
    const replay = await api('post', `/v3/claim/${claimToken}/otp/verify`, undefined, { code }); expect(replay.status).toBe(400);
    const grants = app.get(AccountSetupGrantService);
    expect(await grants.consume(ok.body.data.setupToken)).toEqual({ vendorId });
    await expect(grants.consume(ok.body.data.setupToken)).rejects.toMatchObject({ status: 404 });
  });

  it('after the claim the owner edits the profile; with enough text it becomes indexable and appears in the sitemap data; contact details are public now; MARKETING sees no personal fields', async () => {
    const token = vendorToken(vendorId, `p57on-${RUN_ID}@v3test.invalid`);
    const put = await api('put', '/v3/me/directory', token, { description: 'Fast and tidy plumbing work across Chennai, with clear prices and tidy finishing.', phone: phone(), address: { line1: '12 Test Road', city: 'Chennai' } });
    expect(put.status).toBe(200); expect(put.body.data.profile).toMatchObject({ status: 'CLAIMED', indexable: true });
    const pub = await api('get', `/v3/directory/businesses/${slug}`); expect(pub.body.data.claimed).toBe(true); expect(pub.body.data.phone).toMatch(/^\+91\d{10}$/);
    expect((await api('get', '/v3/directory/sitemap-data?pageSize=100')).body.data.items.map((i: { slug: string }) => i.slug)).toContain(slug);
    const b = await prisma.v3DirectoryBusiness.findUniqueOrThrow({ where: { vendorId } });
    const m = await api('get', `/v3/admin/directory/businesses/${b.id}`, mkt); expect(m.status).toBe(200); expect(m.body.data).not.toHaveProperty('phone');
    expect((await api('get', `/v3/admin/directory/businesses/${b.id}`, ops)).body.data).toHaveProperty('phone');
  });

  it('full text search finds the business by a word of its name; page size is capped; ETag gives a 304', async () => {
    const found = await api('get', `/v3/directory/businesses?q=${encodeURIComponent(`V3TEST on ${RUN_ID}`)}`); expect(found.status).toBe(200);
    expect(found.body.data.items.map((i: { slug: string }) => i.slug)).toContain(slug);
    expect((await api('get', '/v3/directory/businesses?pageSize=1000')).body.data.pageSize).toBeLessThanOrEqual(50);
    const a = await api('get', '/v3/directory/categories'); const again = await request(app.getHttpServer()).get('/v3/directory/categories').set('If-None-Match', a.headers.etag); expect(again.status).toBe(304);
  });
});
