// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { BillingFixture, setUpBilling, tearDownBilling } from './support/billing-staging';
import { runCleanup } from './support/cleanup-guard';
import { SeededTenant, cleanupTenants, newPrisma, seedTenant } from './support/fixtures';
import { bootWave3, Wave3Env } from './support/wave3-staging';

/**
 * Wave 3 Part G on STAGING (real database): the public address check says free, invalid, reserved or unavailable by the same rules registering uses, never leaks who owns a name, and the platform hosts and the
 * nine Version 2 client names are always reserved. Registration itself and the trial site are covered by the unit suite (the slim app has no auth module). Synthetic data only. NOT RUN in the build session that wrote it.
 */
jest.setTimeout(180_000);

describe('subdomain availability on staging', () => {
  let env: Wave3Env; let prisma: PrismaClient; let fx: BillingFixture; let A: SeededTenant; let taken: string;
  beforeAll(async () => {
    prisma = newPrisma(); fx = await setUpBilling(prisma); env = await bootWave3(prisma);
    A = await seedTenant(prisma, 'w3ta', RUN_ID); taken = `v3test-${RUN_ID.toLowerCase()}-taken`;
    await prisma.vendor.update({ where: { id: A.vendorId }, data: { subdomain: taken } });
  }, 240000);
  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => tearDownBilling(prisma, fx), () => env?.app.close(), () => prisma?.$disconnect()]); }, 180000);
  const check = (name: string) => env.api('get', `/v3/public/subdomain-availability?name=${encodeURIComponent(name)}`);

  it('needs no login, is never cached, and answers free, invalid and unavailable without naming an owner', async () => {
    const free = await check(`v3test-${RUN_ID.toLowerCase()}-free`); expect(free.status).toBe(200); expect(free.headers['cache-control']).toBe('no-store');
    expect(free.body.data).toMatchObject({ available: true, reason: 'AVAILABLE' });
    expect((await check('ab')).body.data).toMatchObject({ available: false, reason: 'INVALID', name: null });
    expect((await check('Bad_Name')).body.data.reason).toBe('INVALID');
    expect((await check(taken)).body.data).toMatchObject({ available: false, reason: 'UNAVAILABLE', name: null });
    expect(JSON.stringify((await check(taken)).body)).not.toContain(A.vendorId); expect(JSON.stringify((await check(taken)).body)).not.toContain(A.email);
  });

  it('keeps the platform hosts and the nine Version 2 client names reserved, with look-alikes', async () => {
    for (const n of ['www', 'app', 'admin', 'api', 'gapi', 'directory', 'media', 'partner', 'mail', 'send', 'allwintours', 'deebiphotography', 'indianambulance', 'ksmquantum', 'stepnrock', 'jscomputersmobiles', 'unicatherapy', 'mrtravels', 's2travels', 'adm1n', 'mr-travels']) {
      expect([n, (await check(n)).body.data.reason]).toEqual([n, 'RESERVED']);
    }
  });
});
