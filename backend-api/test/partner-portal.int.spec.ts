// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { BillingFixture, setUpBilling, tearDownBilling } from './support/billing-staging';
import { runCleanup } from './support/cleanup-guard';
import { SeededTenant, cleanupTenants, newPrisma, seedPartnerLogin, seedStaff, seedTenant, vendorToken } from './support/fixtures';
import { bootWave3, Wave3Env } from './support/wave3-staging';

/**
 * Wave 3 Parts A and I on STAGING (real database): a referral partner signs in as an admin-team row with the REFERRAL_PARTNER role and may use /v3/partner/* and the two token routes only; every other route
 * refuses it; no vendor, team member or staff member may use the partner routes; a partner sees only its own data and no contact detail. Synthetic data only. NOT RUN in the build session that wrote it.
 */
jest.setTimeout(240_000);

describe('the partner portal on staging', () => {
  let env: Wave3Env; let prisma: PrismaClient; let fx: BillingFixture; let V: SeededTenant; let vToken: string; let sup: string; let sales: string; let tele: string;
  let p1: { partnerId: string; token: string }; let p2: { partnerId: string; token: string };
  beforeAll(async () => {
    prisma = newPrisma(); fx = await setUpBilling(prisma); env = await bootWave3(prisma);
    V = await seedTenant(prisma, 'w3pv', RUN_ID); vToken = vendorToken(V.vendorId, V.email);
    sup = await seedStaff(prisma, 'w3psup', RUN_ID, 'SUPER_ADMIN'); sales = await seedStaff(prisma, 'w3pfe', RUN_ID, 'FIELD_EXECUTIVE'); tele = await seedStaff(prisma, 'w3ptc', RUN_ID, 'TELECALLER');
    p1 = await seedPartnerLogin(prisma, 'w3pa', RUN_ID); p2 = await seedPartnerLogin(prisma, 'w3pb', RUN_ID);
    await prisma.referralAttribution.create({ data: { vendorId: V.vendorId, partnerId: p1.partnerId, source: 'ON_BEHALF' } });
  }, 300000);
  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => tearDownBilling(prisma, fx), () => env?.app.close(), () => prisma?.$disconnect()]); }, 180000);

  it('a partner reads who it is, its code, its commission and payouts', async () => {
    const me = await env.api('get', '/v3/partner/me', p1.token); expect(me.status).toBe(200); expect(me.body.data).toMatchObject({ id: p1.partnerId, status: 'ACTIVE' }); expect(Object.keys(me.body.data).sort()).toEqual(['id', 'name', 'status', 'type']);
    for (const r of ['link', 'commission', 'payouts']) expect([r, (await env.api('get', `/v3/partner/${r}`, p1.token)).status]).toEqual([r, 200]);
  });

  it('a partner sees only the businesses it referred, by business name and state, with no contact detail or id', async () => {
    const mine = await env.api('get', '/v3/partner/vendors', p1.token); expect(mine.body.data.total).toBe(1);
    expect(mine.body.data.items[0].businessName).toBe(`V3TEST w3pv ${RUN_ID}`); expect(JSON.stringify(mine.body)).not.toMatch(new RegExp(`${V.email}|${V.vendorId}|9000000001|"email"|"phone"`));
    expect((await env.api('get', '/v3/partner/vendors', p2.token)).body.data.total).toBe(0);
  });

  it('every route outside /v3/partner/* is refused to a partner, including routes with no role check', async () => {
    for (const [m, u] of [['get', '/v3/me/billing/orders'], ['get', '/v3/me/wallet'], ['get', '/v3/admin/partners'], ['get', '/v3/admin/commission/ledger'], ['post', '/v3/admin/commission/payouts'], ['get', '/v3/public/pricing'], ['get', '/vendors']] as const) {
      const r = await env.api(m, u, p1.token, m === 'post' ? {} : undefined); expect([m, u, r.status]).toEqual([m, u, 403]);
    }
    const adminList = await env.api('get', '/v3/admin/partners', p1.token); expect(adminList.body.code).toBe('PARTNER_SCOPE_REFUSED');
  });

  it('a vendor, SALES and its labels, and staff cannot use the partner routes; SALES and its labels cannot read partners either', async () => {
    for (const t of [vToken, sales, tele, sup]) expect([(await env.api('get', '/v3/partner/me', t)).status, (await env.api('get', '/v3/partner/vendors', t)).status]).toEqual([403, 403]);
    expect((await env.api('get', '/v3/partner/me')).status).toBe(401);
    for (const t of [sales, tele]) expect((await env.api('get', '/v3/admin/partners', t)).status).toBe(403);
    expect((await env.api('get', '/v3/admin/partners', sup)).status).toBe(200);
  });

  it('a disabled partner or a removed login can no longer use the portal', async () => {
    await prisma.referralPartner.update({ where: { id: p2.partnerId }, data: { status: 'DISABLED' } });
    expect((await env.api('get', '/v3/partner/me', p2.token)).status).toBe(404);
    const login = await prisma.adminTeamMember.findFirstOrThrow({ where: { email: { contains: `login-w3pa-${RUN_ID}` } } });
    await prisma.adminTeamMember.update({ where: { id: login.id }, data: { status: 'removed' } });
    expect((await env.api('get', '/v3/partner/me', p1.token)).status).toBe(401);
  });
});
