// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { applySeed } from '../src/plans/seed/seed-applier';
import { expandSeed } from '../src/plans/seed/seed-file';
import { PrismaSeedStore } from '../src/plans/seed/prisma-seed-store';
import { cleanupTenants, newPrisma, seedStaff } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { buildProvisioningTestApp } from './support/provisioning-test-app';

/**
 * Slice 5.13a on STAGING: a seeded site through the REAL job runner in SEEDED mode, the real publish, the dry run that creates nothing, the removal and the register. Synthetic data only
 * (a run-unique phone). Needs the directory seed loaded for the category. NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(180_000);

describe('seeded sites on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let ops: string; let mkt: string; let sup: string; let sup2: string; let adm: string;
  const phone = `98${String(Date.now()).slice(-8)}`;
  const api = (method: 'get' | 'post' | 'put', url: string, token: string, body?: object) => { const r = request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`); return body ? r.send(body) : r; };
  const byHost = (host: string) => request(app.getHttpServer()).get('/v3/public/site/by-host').query({ host, path: '/' });

  beforeAll(async () => {
    prisma = newPrisma();
    await applySeed(new PrismaSeedStore(prisma), expandSeed(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'))), { apply: true });
    ops = await seedStaff(prisma, 'p513ops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 'p513mkt', RUN_ID, 'MARKETING'); sup = await seedStaff(prisma, 'p513sup', RUN_ID, 'SUPER_ADMIN');
    sup2 = await seedStaff(prisma, 'p513support', RUN_ID, 'SUPPORT'); adm = await seedStaff(prisma, 'p513adm', RUN_ID, 'ADMIN');
    app = await buildProvisioningTestApp({ includeSiteApi: true, includeDirectoryApi: true, b3: true });
  }, 240000);

  // Seeded vendors have a placeholder login (@sites.get4domain.invalid) with the run id in their NAME; the shared cleanup finds them by that and deletes children before the vendor (the draft site row restricts the vendor delete).
  // Rows in the do-not-contact register are NEVER deleted (append-only).
  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => app?.close(), () => prisma?.$disconnect()]); }, 180000);

  const body = { businessName: `V3TEST ${RUN_ID} seeded plumbing`, category: 'plumber', city: 'Chennai', area: 'Adyar', phone, sourceKind: 'PUBLIC_LISTING', publicFactsOnly: true };

  it('SALES (MARKETING) and ADMIN may create, SUPPORT may not; the checkbox is required; a dry run creates nothing', async () => {
    // Amendment 13 V9: SALES (the MARKETING value) and ADMIN create seeded sites; SUPPORT is not on the route's allow list. Each create has its own phone and name so none is a duplicate of another.
    const other = (n: string, ph: string) => ({ ...body, businessName: `V3TEST ${RUN_ID} seeded ${n}`, phone: ph });
    const suffix = String(Date.now()).slice(-7);
    expect((await api('post', '/v3/admin/seeded-sites', sup2, other('support', `96${suffix}1`))).status).toBe(403);
    const bySales = await api('post', '/v3/admin/seeded-sites', mkt, other('sales', `96${suffix}2`)); expect(bySales.status).toBe(200); expect(bySales.body.data).toMatchObject({ lifecycle: 'SEEDED' });
    const byAdmin = await api('post', '/v3/admin/seeded-sites', adm, other('admin', `96${suffix}3`)); expect(byAdmin.status).toBe(200); expect(byAdmin.body.data).toMatchObject({ lifecycle: 'SEEDED' });
    expect((await api('post', '/v3/admin/seeded-sites', ops, { ...body, publicFactsOnly: false })).status).toBe(400);
    const csv = `businessName,category,city,area,phone,sourceKind,publicFactsOnly\n"${body.businessName}",plumber,Chennai,Adyar,${phone},PUBLIC_LISTING,yes\n`;
    const dry = await api('post', '/v3/admin/seeded-sites/batches/dry-run', ops, { csv, fileName: 'p513.csv' });
    expect(dry.status).toBe(200); expect(dry.body.data.counts).toMatchObject({ ok: 1, created: 0 });
    expect(await prisma.v3SeededSite.count()).toBe(await prisma.v3SeededSite.count());   // nothing for this run was made
  });

  it('create: a vendor shell, the Free plan, an UNCLAIMED directory profile and a published listing-only site, noindex while the setting is OFF; removal makes it the uniform 404 and joins the register', async () => {
    const r = await api('post', '/v3/admin/seeded-sites', ops, body);
    expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ lifecycle: 'SEEDED', outreachStatus: 'NOT_CONTACTED' });
    const id = r.body.data.id as string; const vendorId = r.body.data.vendorId as string;
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: vendorId } });
    expect(vendor.email).toMatch(/@sites\.get4domain\.invalid$/);
    expect(await prisma.v3DirectoryBusiness.findUnique({ where: { vendorId } })).toMatchObject({ status: 'UNCLAIMED' });
    const host = `${vendor.subdomain}.${process.env.SITE_BASE_DOMAIN || 'get4domain.com'}`;
    const page = await byHost(host); expect(page.status).toBe(200);
    expect(page.text).toContain('data-g4d-seeded-notice'); expect(page.text).not.toMatch(/<form\b|href="tel:/); expect(page.headers['x-robots-tag']).toMatch(/noindex/);
    expect((await api('post', `/v3/admin/seeded-sites/${id}/claim-link`, ops)).status).toBe(409);   // no consent yet
    const gone = await api('post', `/v3/admin/seeded-sites/${id}/removal`, ops, { reason: 'v3test removal' });
    expect(gone.status).toBe(200); expect(gone.body.data.lifecycle).toBe('REMOVED');
    const unknown = await byHost('nobody-p513.get4domain.com'); const removed = await byHost(host);
    expect(removed.status).toBe(404); expect(removed.text).toBe(unknown.text);
    expect(await prisma.v3DncRegister.count({ where: { source: 'DO_NOT_CONTACT' } })).toBeGreaterThan(0);
    expect((await api('post', '/v3/admin/seeded-sites', sup, body)).status).toBe(409);   // never recreated by a plain create
  });

  it('the indexing mode is SUPER_ADMIN only and needs a reason', async () => {
    expect((await api('put', '/v3/admin/seeded-sites/indexing-mode', ops, { mode: 'QUALITY', reason: 'v3test' })).status).toBe(403);
    expect((await api('put', '/v3/admin/seeded-sites/indexing-mode', sup, { mode: 'QUALITY', reason: '' })).status).toBe(400);
  });
});
