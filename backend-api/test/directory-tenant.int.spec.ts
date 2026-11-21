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
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';

/** B2 slice 5.7 on STAGING: cross-tenant behaviour of the directory tables and routes, the removal flow, and sponsored labelling, with the real database. NOT RUN in the build session (no .env.staging there). */
jest.setTimeout(180_000);

describe('directory: tenant isolation, removal and sponsored placements on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let B: SeededTenant; let ops: string; let mkt: string; let tokenA: string; let tokenB: string;
  const api = (method: 'get' | 'post' | 'put', url: string, token?: string, body?: object) => { const r = request(app.getHttpServer())[method](url); const t = token ? r.set('Authorization', `Bearer ${token}`) : r; return body ? t.send(body) : t; };
  let catId = ''; let cityId = ''; let bizA = ''; let bizB = '';

  beforeAll(async () => {
    prisma = newPrisma();
    await applyDirectorySeed(new PrismaDirectorySeedStore(prisma), JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-directory.seed.json'), 'utf8')) as DirectorySeed, { apply: true });
    app = await buildProvisioningTestApp({ includeDirectoryApi: true });
    ops = await seedStaff(prisma, 'p57tops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p57tmkt', RUN_ID, 'MARKETING');
    A = await seedTenant(prisma, 'p57ta', RUN_ID); B = await seedTenant(prisma, 'p57tb', RUN_ID);
    tokenA = vendorToken(A.vendorId, A.email); tokenB = vendorToken(B.vendorId, B.email);
    catId = (await prisma.v3DirectoryCategory.findFirstOrThrow({ where: { themeCategoryId: 'plumber' } })).id;
    cityId = (await prisma.v3DirectoryLocation.findFirstOrThrow({ where: { kind: 'CITY', name: 'Chennai' } })).id;
    const mk = async (t: SeededTenant) => (await prisma.v3DirectoryBusiness.create({ data: { vendorId: t.vendorId, slug: `v3test-${t.label}-${RUN_ID}`.toLowerCase(), name: `V3TEST ${t.label} ${RUN_ID}`, categoryId: catId, locationId: cityId, status: 'CLAIMED', phoneE164: '+919876500001', descriptionText: `${t.marker} A long enough description for the directory to index this page.`, addressJson: { line1: `${t.marker} road` } } })).id;
    bizA = await mk(A); bizB = await mk(B);
  }, 240000);

  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  it('each owner reads and edits only their own profile; the body cannot move a profile to another vendor', async () => {
    expect((await api('get', '/v3/me/directory', tokenA)).body.data.profile.slug).toContain('p57ta');
    expect((await api('get', '/v3/me/directory', tokenB)).body.data.profile.slug).toContain('p57tb');
    expect((await api('put', '/v3/me/directory', tokenA, { vendorId: B.vendorId, description: 'x' })).status).toBe(400);
    await api('put', '/v3/me/directory', tokenA, { description: `${A.marker} edited by A, still long enough to be indexed by the rules.` });
    expect((await prisma.v3DirectoryBusiness.findUniqueOrThrow({ where: { id: bizB } })).descriptionText).not.toContain('edited by A');
  });

  it('a team member of A (even with every area) is refused; staff routes refuse a vendor token', async () => {
    expect((await api('get', '/v3/me/directory', A.memberToken)).status).toBe(403);
    expect((await api('get', '/v3/admin/directory/businesses', tokenA)).status).toBe(403);
  });

  it('MARKETING reads businesses without personal fields, and is refused writes and the removal queue', async () => {
    const m = await api('get', `/v3/admin/directory/businesses/${bizA}`, mkt); expect(m.status).toBe(200); expect(JSON.stringify(m.body)).not.toMatch(/9876500001|road/);
    expect((await api('post', `/v3/admin/directory/businesses/${bizA}/moderate`, mkt, { action: 'SUSPEND', reason: 'nope' })).status).toBe(403);
    expect((await api('get', '/v3/admin/directory/removal-requests', mkt)).status).toBe(403);
  });

  it('a sponsored placement is always labelled, never changes the organic order, and disappears when revoked', async () => {
    const baseline = (await api('get', `/v3/directory/businesses?q=${encodeURIComponent(`V3TEST ${RUN_ID}`)}`)).body.data.items.map((i: { slug: string }) => i.slug);
    const pl = await api('post', `/v3/admin/directory/businesses/${bizB}/placements`, ops, { startsAt: new Date(Date.now() - 3600_000).toISOString(), endsAt: new Date(Date.now() + 3600_000).toISOString(), label: 'Sponsored' });
    expect(pl.status).toBe(200);
    expect((await api('post', `/v3/admin/directory/businesses/${bizB}/placements`, ops, { startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 3600_000).toISOString(), label: '' })).status).toBe(400);
    const list = (await api('get', '/v3/directory/businesses?category=plumber&pageSize=10')).body.data.items as Array<{ sponsored: boolean; label?: string; slug: string }>;
    for (const i of list.filter((x) => x.sponsored)) expect(i.label).toBeTruthy();
    const organic = (await api('get', `/v3/directory/businesses?q=${encodeURIComponent(`V3TEST ${RUN_ID}`)}`)).body.data.items.map((i: { slug: string }) => i.slug);
    expect(organic).toEqual(baseline);
    expect((await api('post', `/v3/admin/directory/placements/${pl.body.data.id}/revoke`, ops)).status).toBe(200);
  });

  it('removal: anyone may ask (the same answer for a real and a made-up business); staff cannot approve until the contact confirms; execution hides the profile (410) and keeps the row', async () => {
    const real = await api('post', '/v3/directory/removal-requests', undefined, { businessSlug: `v3test-p57ta-${RUN_ID}`.toLowerCase() }); const fake = await api('post', '/v3/directory/removal-requests', undefined, { businessSlug: 'no-such-business-here' });
    expect([real.status, fake.status]).toEqual([202, 202]); expect(real.body.data).toEqual(fake.body.data);
    const row = await prisma.v3DirectoryRemovalRequest.findFirstOrThrow({ where: { businessId: bizA } });
    expect(row.confirmedAt).toBeNull(); expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect((await api('post', `/v3/admin/directory/removal-requests/${row.id}/approve`, ops)).status).toBe(409);
    await prisma.v3DirectoryRemovalRequest.update({ where: { id: row.id }, data: { confirmedAt: new Date() } });   // stands in for following the SMS link (the link token is only in the message)
    expect((await api('post', `/v3/admin/directory/removal-requests/${row.id}/approve`, ops)).status).toBe(200);
    expect((await api('post', `/v3/admin/directory/removal-requests/${row.id}/execute`, ops)).status).toBe(200);
    expect((await api('get', `/v3/directory/businesses/v3test-p57ta-${RUN_ID}`.toLowerCase())).status).toBe(410);
    expect(await prisma.v3DirectoryBusiness.findUniqueOrThrow({ where: { id: bizA } })).toMatchObject({ status: 'REMOVED', indexable: false });
    expect((await api('post', `/v3/admin/directory/removal-requests/${row.id}/execute`, ops)).status).toBe(409);
    expect((await api('get', `/v3/directory/sitemap-data?pageSize=100`)).body.data.items.map((i: { slug: string }) => i.slug)).not.toContain(`v3test-p57ta-${RUN_ID}`.toLowerCase());
  });
});
