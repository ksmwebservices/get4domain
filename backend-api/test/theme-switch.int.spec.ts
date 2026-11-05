// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { SubscriptionsService } from '../src/plans/subscriptions/subscriptions.service';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';
import { FakeRazorpay } from './support/fake-razorpay';
import { buildProvisioningTestApp } from './support/provisioning-test-app';
import { makeSiteVendor } from './support/site-staging';

/**
 * Batch 4 slice 5.16d on STAGING, with the real database, the REAL site pipeline (settings, build, publish) and the FAKE payment provider: a preview stores nothing, the first switch is included, the second is
 * charged from the wallet and makes a NEW publication (the previous one is kept, so rollback works), the database refuses a paid switch with nothing behind it and a gift with no reason, tenants cannot see
 * each other, and staff can switch for a vendor. The suite adds its OWN approved THEME_SWITCH price and tax rows and settings and removes them at the end.
 * Synthetic data only. NOT RUN in the build session that wrote it (no .env.staging there).
 */
jest.setTimeout(300_000);

describe('theme switch on staging (fake provider, real site pipeline)', () => {
  let app: INestApplication; let prisma: PrismaClient; const fake = new FakeRazorpay();
  let A: SeededTenant; let tokenA: string; let sup: string; let ops: string; let mkt: string;
  const taxIds: string[] = []; const priceIds: string[] = []; const saved = new Map<string, { existed: boolean; value: unknown }>(); let createdService = false;
  const api = (method: 'get' | 'post' | 'put', url: string, token?: string, body?: object) => { const r = request(app.getHttpServer())[method](url); const t = token ? r.set('Authorization', `Bearer ${token}`) : r; return body ? t.send(body) : t; };
  const key = (() => { let n = 0; return () => `v3test-${RUN_ID}-thm-${++n}`; })();
  const setSetting = async (k: string, v: unknown) => { if (!saved.has(k)) { const row = await prisma.v3PlanSetting.findUnique({ where: { key: k } }); saved.set(k, { existed: !!row, value: row?.valueJson ?? null }); } await prisma.v3PlanSetting.upsert({ where: { key: k }, create: { key: k, valueJson: v as never, description: 'v3test' }, update: { valueJson: v as never } }); };
  const balance = async () => (await prisma.v3Wallet.findUniqueOrThrow({ where: { vendorId: A.vendorId } })).balancePaise;
  let themes: string[] = [];

  beforeAll(async () => {
    prisma = newPrisma();
    app = await buildProvisioningTestApp({ billing: { fake }, wallet: true, services: true, requests: true, themeSwitch: true, includeSiteApi: true });
    const subs = app.get(SubscriptionsService);
    A = await seedTenant(prisma, 't16a', RUN_ID); await makeSiteVendor(prisma, subs, A, RUN_ID, { pro: true, complete: true }); tokenA = vendorToken(A.vendorId, A.email);
    sup = await seedStaff(prisma, 't16sup', RUN_ID, 'SUPER_ADMIN'); ops = await seedStaff(prisma, 't16ops', RUN_ID, 'OPERATIONS'); mkt = await seedStaff(prisma, 't16mkt', RUN_ID, 'MARKETING');
    const eff = new Date(Date.now() - 3_600_000);
    for (const [name, rate] of [['IGST', 18], ['CGST', 9], ['SGST', 9]] as const) taxIds.push((await prisma.v3TaxRate.create({ data: { name, ratePercent: rate, appliesTo: 'ALL', active: true, validFrom: new Date(eff.getTime() + taxIds.length) } })).id);
    await setSetting('walletSellerStateCode', '33'); await setSetting('walletTopupMinPaise', 10_000); await setSetting('walletTopupMaxPaise', 1_000_000);
    let svc = await prisma.v3Service.findUnique({ where: { key: 'THEME_SWITCH' } });
    if (!svc) { svc = await prisma.v3Service.create({ data: { key: 'THEME_SWITCH', name: 'Theme switch', shortDescription: 'Change the look of your website.', includesText: 'We apply the theme you choose.', approvalText: 'No approval is needed.', doneBy: 'EITHER', deliveryKind: 'INSTANT', status: 'ACTIVE', trackScope: [] } }); createdService = true; }
    priceIds.push((await prisma.v3ServicePrice.create({ data: { serviceId: svc.id, amountPaise: 29_900, status: 'APPROVED', effectiveFrom: new Date(Date.now() - 60_000), approvedBy: 'v3test', approvedAt: new Date() } })).id);
    await api('get', '/v3/me/wallet', tokenA); await api('put', '/v3/me/wallet/billing-profile', tokenA, { stateCode: '33' });
    await api('post', `/v3/admin/wallets/${A.vendorId}/adjustments`, sup, { amountPaise: 500_000, reason: 'suite credit', idempotencyKey: key() });
    const site = await api('get', '/v3/me/site', tokenA); themes = site.body.data.allowedThemes ?? [];
    const built = await api('post', '/v3/me/site/build', tokenA); await api('post', '/v3/me/site/publish', tokenA, { publicationId: built.body.data.publication.id });   // a live site, so a switch makes a new snapshot
  }, 300000);

  afterAll(async () => {
    await runCleanup([
      () => cleanupTenants(prisma, RUN_ID), () => prisma.v3ServicePrice.deleteMany({ where: { id: { in: priceIds } } }), () => (createdService ? prisma.v3Service.deleteMany({ where: { key: 'THEME_SWITCH' } }) : Promise.resolve()),
      () => prisma.v3TaxRate.deleteMany({ where: { id: { in: taxIds } } }),
      async () => { for (const [k, p] of saved) { if (p.existed) await prisma.v3PlanSetting.update({ where: { key: k }, data: { valueJson: p.value as never } }); else await prisma.v3PlanSetting.deleteMany({ where: { key: k } }); } },
      () => app?.close(), () => prisma?.$disconnect(),
    ]);
  }, 240000);

  it('the vendor\'s Pro plan allows at least two themes to switch between (otherwise this suite cannot show a paid switch)', () => { expect(themes.length).toBeGreaterThanOrEqual(2); });

  it('a preview draws the theme with the vendor\'s own content and stores NOTHING', async () => {
    const pubs = await prisma.v3SitePublication.count({ where: { vendorId: A.vendorId } }); const sws = await prisma.v3ThemeSwitch.count({ where: { vendorId: A.vendorId } }); const bal = await balance();
    const current = (await api('get', '/v3/me/site', tokenA)).body.data.settings.themeId; const target = themes.find((t) => t !== current) ?? themes[0];
    const r = await api('post', '/v3/me/site/theme/preview', tokenA, { themeId: target }); expect(r.status).toBe(200); expect(r.body.data.html.length).toBeGreaterThan(100);
    expect(await prisma.v3SitePublication.count({ where: { vendorId: A.vendorId } })).toBe(pubs); expect(await prisma.v3ThemeSwitch.count({ where: { vendorId: A.vendorId } })).toBe(sws); expect(await balance()).toBe(bal);
  });

  it('the first switch is included and the second is charged; each makes a NEW publication and the previous snapshot is kept', async () => {
    const pubs0 = await prisma.v3SitePublication.count({ where: { vendorId: A.vendorId } });
    const a = await api('post', '/v3/me/site/theme/switch', tokenA, { themeId: themes[0], idempotencyKey: key() }); expect(a.status).toBe(200); expect(a.body.data.kind).toBe('FREE_INCLUDED');
    const before = await balance(); const b = await api('post', '/v3/me/site/theme/switch', tokenA, { themeId: themes[1], idempotencyKey: key() });
    expect(b.status).toBe(200); expect(b.body.data).toMatchObject({ kind: 'PAID', status: 'APPLIED', amountPaise: 35_282 }); expect(await balance()).toBe(before - 35_282);
    expect(await prisma.v3WalletLedger.count({ where: { vendorId: A.vendorId, kind: 'CHARGE', refType: 'theme_switch', refId: b.body.data.id } })).toBe(1);
    expect(await prisma.v3SitePublication.count({ where: { vendorId: A.vendorId } })).toBeGreaterThan(pubs0); expect((await prisma.v3SitePublication.findMany({ where: { vendorId: A.vendorId, status: 'SUPERSEDED' } })).length).toBeGreaterThanOrEqual(1);
    expect((await prisma.v3SitePublication.findFirstOrThrow({ where: { vendorId: A.vendorId, status: 'PUBLISHED' } })).themeId).toBe(themes[1]);
    expect((await api('get', `/v3/admin/wallets/${A.vendorId}/reconcile`, ops)).body.data.ok).toBe(true);
  });

  it('rolling back to the previous publication still works after a switch', async () => {
    const prev = await prisma.v3SitePublication.findFirstOrThrow({ where: { vendorId: A.vendorId, status: 'SUPERSEDED' }, orderBy: { version: 'desc' } });
    expect((await api('post', '/v3/me/site/rollback', tokenA, { toVersion: prev.version })).status).toBe(200);
  });

  it('the same key twice charges once; a double submit is one switch', async () => {
    const k = key(); const target = themes[0]; const cur = (await api('get', '/v3/me/site', tokenA)).body.data.settings.themeId; const to = target === cur ? themes[1] : target; const before = await balance();
    const rs = await Promise.all(Array.from({ length: 5 }, () => api('post', '/v3/me/site/theme/switch', tokenA, { themeId: to, idempotencyKey: k }).then((r) => r.status)));
    expect(rs.every((s) => s === 200)).toBe(true); expect(await prisma.v3ThemeSwitch.count({ where: { vendorId: A.vendorId, idempotencyKey: k } })).toBe(1); expect(await balance()).toBe(before - 35_282);
  });

  it('the DATABASE refuses a PAID switch with nothing behind it and a gift with no reason', async () => {
    await expect(prisma.$executeRaw`INSERT INTO "g4d_theme_switches" ("id","vendorId","toThemeKey","kind","performedByType","idempotencyKey","createdAt","updatedAt") VALUES (${`bad-${RUN_ID}-1`}, ${A.vendorId}, 'x', 'PAID', 'VENDOR', ${`bad-${RUN_ID}-1`}, now(), now())`).rejects.toThrow(/paid_chk|check constraint/i);
    await expect(prisma.$executeRaw`INSERT INTO "g4d_theme_switches" ("id","vendorId","toThemeKey","kind","performedByType","idempotencyKey","createdAt","updatedAt") VALUES (${`bad-${RUN_ID}-2`}, ${A.vendorId}, 'x', 'COMPLIMENTARY_STAFF', 'STAFF', ${`bad-${RUN_ID}-2`}, now(), now())`).rejects.toThrow(/gift_reason_chk|check constraint/i);
  });

  it('staff switch a vendor\'s theme as a gift with a reason (it shows as done by our team); MARKETING is refused; a vendor token is refused on the staff route', async () => {
    const cur = (await api('get', '/v3/me/site', tokenA)).body.data.settings.themeId; const to = themes.find((t) => t !== cur)!;
    const body = { themeId: to, idempotencyKey: key(), funding: 'COMPLIMENTARY', reason: 'A gift for the suite.' };
    expect((await api('post', `/v3/admin/vendors/${A.vendorId}/site/theme/switch`, mkt, body)).status).toBe(403); expect((await api('post', `/v3/admin/vendors/${A.vendorId}/site/theme/switch`, tokenA, body)).status).toBe(403);
    const before = await balance(); const r = await api('post', `/v3/admin/vendors/${A.vendorId}/site/theme/switch`, ops, body);
    expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ kind: 'COMPLIMENTARY_STAFF', by: 'OUR_TEAM' }); expect(await balance()).toBe(before);
    expect((await api('get', '/v3/me/site/theme/history', tokenA)).body.data.items.some((i: { by: string }) => i.by === 'OUR_TEAM')).toBe(true);
  });
});
