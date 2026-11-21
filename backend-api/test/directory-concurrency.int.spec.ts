// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AccountSetupGrantService } from '../src/directory/grants/account-setup-grant.service';
import { ClaimsService } from '../src/provisioning/claims/claims.service';
import { generateToken, hashToken } from '../src/provisioning/claims/token';
import { applyDirectorySeed } from '../src/directory/seed/seed-applier';
import { DirectorySeed } from '../src/directory/seed/seed-file';
import { PrismaDirectorySeedStore } from '../src/directory/seed/prisma-seed-store';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';

/**
 * B2 slice 5.7 on STAGING: with the real compare-and-set updates and unique rules, racing requests claim exactly once, cannot count past the attempt limit, consume a setup grant once,
 * and get distinct business slugs. Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(180_000);

describe('directory concurrency on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let ops: string; let catId = ''; let cityId = '';
  const post = (url: string, body: object = {}, token?: string) => { const r = request(app.getHttpServer()).post(url); return (token ? r.set('Authorization', `Bearer ${token}`) : r).send(body); };

  const claimable = async (label: string) => {
    const t = await seedTenant(prisma, label, RUN_ID);
    await prisma.v3DirectoryBusiness.create({ data: { vendorId: t.vendorId, slug: `v3test-${label}-${RUN_ID}`.toLowerCase(), name: `V3TEST ${label} ${RUN_ID}`, categoryId: catId, locationId: cityId, status: 'UNCLAIMED', phoneE164: '+919876500002' } });
    const raw = generateToken();
    await prisma.v3ClaimToken.create({ data: { vendorId: t.vendorId, tokenHash: hashToken(raw), status: 'ACTIVE', activeKey: t.vendorId, expiresAt: new Date(Date.now() + 86_400_000) } });
    return { t, raw };
  };
  const codeFor = async (raw: string): Promise<string> => {
    expect((await post(`/v3/claim/${raw}/otp/request`)).status).toBe(200);
    const tok = await prisma.v3ClaimToken.findFirstOrThrow({ where: { tokenHash: hashToken(raw) } });
    const ch = await prisma.v3OtpChallenge.findFirstOrThrow({ where: { subjectType: 'CLAIM', subjectId: tok.id, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    return /(\d{6})/.exec(ch.sandboxBody!)![1];
  };

  beforeAll(async () => {
    prisma = newPrisma();
    await applyDirectorySeed(new PrismaDirectorySeedStore(prisma), JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-directory.seed.json'), 'utf8')) as DirectorySeed, { apply: true });
    app = await buildProvisioningTestApp({ includeDirectoryApi: true });
    ops = await seedStaff(prisma, 'p57cops', RUN_ID, 'OPERATIONS');
    A = await seedTenant(prisma, 'p57ca', RUN_ID);
    catId = (await prisma.v3DirectoryCategory.findFirstOrThrow({ where: { themeCategoryId: 'plumber' } })).id;
    cityId = (await prisma.v3DirectoryLocation.findFirstOrThrow({ where: { kind: 'CITY', name: 'Chennai' } })).id;
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('five parallel verifications with the RIGHT code: exactly one succeeds; the link is used once; one setup grant exists', async () => {
    const { t, raw } = await claimable('p57cc1'); const code = await codeFor(raw);
    const rs = await Promise.all(Array.from({ length: 5 }, () => post(`/v3/claim/${raw}/otp/verify`, { code })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1); expect(rs.filter((r) => r.status === 400)).toHaveLength(4);
    expect(await prisma.v3ClaimToken.count({ where: { vendorId: t.vendorId, status: 'USED' } })).toBe(1);
    expect(await prisma.v3AccountSetupGrant.count({ where: { vendorId: t.vendorId } })).toBe(1);
    expect((await prisma.v3DirectoryBusiness.findUniqueOrThrow({ where: { vendorId: t.vendorId } })).status).toBe('CLAIMED');
  });

  it('twelve parallel WRONG codes cannot push the attempt counter past the limit, and the right code then fails once locked', async () => {
    const { raw } = await claimable('p57cc2'); const code = await codeFor(raw); const wrong = code === '123456' ? '654321' : '123456';
    const rs = await Promise.all(Array.from({ length: 12 }, () => post(`/v3/claim/${raw}/otp/verify`, { code: wrong })));
    expect(rs.every((r) => r.status === 400)).toBe(true);
    const tok = await prisma.v3ClaimToken.findFirstOrThrow({ where: { tokenHash: hashToken(raw) } });
    const ch = await prisma.v3OtpChallenge.findFirstOrThrow({ where: { subjectType: 'CLAIM', subjectId: tok.id }, orderBy: { createdAt: 'desc' } });
    expect(ch.attempts).toBeLessThanOrEqual(5);
    for (let i = ch.attempts; i < 6; i++) await post(`/v3/claim/${raw}/otp/verify`, { code: wrong });   // finish locking if the race left it short
    expect((await post(`/v3/claim/${raw}/otp/verify`, { code })).status).toBe(400);
    expect(await app.get(ClaimsService).peek(raw)).not.toBeNull();   // the link was never used
  });

  it('the setup grant is consumed exactly once under a race', async () => {
    const grants = app.get(AccountSetupGrantService); const { token } = await grants.issue(A.vendorId, 30);
    const rs = await Promise.allSettled([grants.consume(token), grants.consume(token), grants.consume(token), grants.consume(token)]);
    expect(rs.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('two staff creating a business with the same name and city at once get different slugs (-2), never an error', async () => {
    const body = { name: `V3TEST same ${RUN_ID}`, categoryId: catId, locationId: cityId, phone: '9876500003', description: 'A long enough description for the directory to index this page.' };
    const rs = await Promise.all([post('/v3/admin/directory/businesses', body, ops), post('/v3/admin/directory/businesses', body, ops)]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]);
    const slugs = rs.filter((r) => r.status === 200).map((r) => r.body.data.slug as string);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
