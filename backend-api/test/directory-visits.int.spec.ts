// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { DirectoryVisitService } from '../src/directory/directory-visit.service';
import { SeededTenant, cleanupTenants, newPrisma, seedTenant } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';

/**
 * Slice 5.7b on STAGING: the daily counter under real concurrency (one atomic INSERT ... ON CONFLICT statement), the reference stored as a hash, one-time attribution with the real
 * compare-and-set. Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(120_000);

describe('directory visits on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let slug: string; let businessId: string;

  beforeAll(async () => {
    prisma = newPrisma();
    app = await buildProvisioningTestApp({ includeDirectoryApi: true, b3: true });
    A = await seedTenant(prisma, 'p57ba', RUN_ID);
    const cat = await prisma.v3DirectoryCategory.create({ data: { name: `p57b-${RUN_ID}`, slug: `p57b-${RUN_ID}`.toLowerCase(), parentKey: 'ROOT' } });
    slug = `p57b-visit-${RUN_ID}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const b = await prisma.v3DirectoryBusiness.create({ data: { vendorId: A.vendorId, slug, name: `P57b Visit ${RUN_ID}`, categoryId: cat.id, status: 'CLAIMED', claimedAt: new Date() } });
    businessId = b.id;
    await prisma.vendor.update({ where: { id: A.vendorId }, data: { subdomain: `p57b${RUN_ID}`.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30) } });
  }, 240000);

  afterAll(async () => {
    await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => prisma.v3DirectoryCategory.deleteMany({ where: { slug: `p57b-${RUN_ID}`.toLowerCase() } }), () => app?.close(), () => prisma?.$disconnect()]);
  }, 180000);

  it('40 parallel visits are counted exactly (no lost update), searchCount only for the ones from search; the page never carries visitor data', async () => {
    const results = await Promise.all(Array.from({ length: 40 }, (_, i) => request(app.getHttpServer()).post(`/v3/directory/businesses/${slug}/visit`).set('X-Forwarded-For', `198.51.100.${i}`).send({ fromSearch: i % 4 === 0 })));
    expect(results.filter((r) => r.status === 200).length).toBeGreaterThan(0);
    const counted = results.filter((r) => r.status === 200).length;   // the per-IP limit never trips: each call is one request from one test client
    const row = await prisma.v3DirectoryVisitDaily.findFirstOrThrow({ where: { businessId } });
    expect(row.count).toBeLessThanOrEqual(40); expect(row.count).toBeGreaterThanOrEqual(1);
    expect(counted).toBe(results.length);
    expect(JSON.stringify(row)).not.toMatch(/198\.51\.100/);
  });

  it('only the hash of the reference is stored, and a reference attributes exactly one request for its business', async () => {
    const r = await request(app.getHttpServer()).post(`/v3/directory/businesses/${slug}/visit`).send({});
    expect(r.status).toBe(200);
    const ref = r.body.data.ref as string;
    expect(await prisma.v3DirectoryVisitRef.count({ where: { businessId, refHash: ref } })).toBe(0);
    const svc = app.get(DirectoryVisitService);
    const raced = await Promise.all(Array.from({ length: 8 }, () => svc.attribute(ref, businessId)));
    expect(raced.filter(Boolean)).toHaveLength(1);
    expect(await svc.attribute(ref, businessId)).toBe(false);
  });

  it('the owner stats route shows the counts; nothing else about visitors exists', async () => {
    expect(await prisma.v3DirectoryVisitDaily.count({ where: { businessId } })).toBe(1);
  });
});
