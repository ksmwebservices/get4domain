// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { forTenant } from '../src/common/tenant/for-tenant';
import { generateToken, hashToken } from '../src/provisioning/claims/token';
import { SeededTenant, cleanupTenants, newPrisma, seedStaff, seedTenant } from './support/fixtures';
import { buildProvisioningTestApp } from './support/provisioning-test-app';

/**
 * S53.8 on STAGING: vendor A cannot see vendor B's invites, claim tokens or provisioning jobs through the tenant client, nor reach any staff route, and
 * the public status route never reveals more than the public business name. Synthetic data only, removed at the end.
 * NOT RUN in the build session that wrote it (no .env.staging there).
 */
describe('provisioning tenant isolation on staging', () => {
  let app: INestApplication; let prisma: PrismaClient; let A: SeededTenant; let B: SeededTenant; let ops: string; let mkt: string;
  const MARK_B = `BMARK-${RUN_ID}`;
  let rawB: string;

  beforeAll(async () => {
    prisma = newPrisma();
    A = await seedTenant(prisma, 'p53ta', RUN_ID);
    B = await seedTenant(prisma, 'p53tb', RUN_ID);
    ops = await seedStaff(prisma, 'p53tops', RUN_ID, 'OPERATIONS');
    mkt = await seedStaff(prisma, 'p53tmkt', RUN_ID, 'MARKETING');
    rawB = generateToken();
    const tb = await prisma.v3ClaimToken.create({ data: { vendorId: B.vendorId, tokenHash: hashToken(rawB), expiresAt: new Date(Date.now() + 86_400_000), activeKey: `${B.vendorId}:CLAIM` } });
    await prisma.v3Invite.create({ data: { vendorId: B.vendorId, toAddress: `owner-${MARK_B}@v3test.invalid`, claimTokenId: tb.id, adapterMode: 'SANDBOX', subject: MARK_B, bodyPreview: MARK_B, sandboxBody: `${MARK_B} ${rawB}` } });
    const ta = await prisma.v3ClaimToken.create({ data: { vendorId: A.vendorId, tokenHash: hashToken(generateToken()), expiresAt: new Date(Date.now() + 86_400_000), activeKey: `${A.vendorId}:CLAIM` } });
    await prisma.v3Invite.create({ data: { vendorId: A.vendorId, toAddress: `owner-a-${RUN_ID}@v3test.invalid`, claimTokenId: ta.id, adapterMode: 'SANDBOX', subject: 'A subject', bodyPreview: 'A preview' } });
    await prisma.v3ProvisioningJob.create({ data: { idempotencyKey: `v3test-${RUN_ID}-tenant-b`, vendorId: B.vendorId, input: { note: MARK_B } } });
    app = await buildProvisioningTestApp();
  }, 180000);

  afterAll(async () => {
    try { await cleanupTenants(prisma, RUN_ID); } finally { await app?.close(); await prisma?.$disconnect(); }
  }, 120000);

  it('the tenant client for A sees only A\'s invites, claim tokens and jobs', async () => {
    const db = forTenant(prisma, A.vendorId);
    const invites = await db.v3Invite.findMany();
    expect(invites.length).toBeGreaterThan(0);
    expect(invites.every((i) => i.vendorId === A.vendorId)).toBe(true);
    expect((await db.v3ClaimToken.findMany()).every((t) => t.vendorId === A.vendorId)).toBe(true);
    expect(JSON.stringify([await db.v3Invite.findMany(), await db.v3ProvisioningJob.findMany()])).not.toContain(MARK_B);
  });

  it('asking for B\'s rows through A\'s tenant client is refused or returns nothing, and cannot write into B', async () => {
    const db = forTenant(prisma, A.vendorId);
    await expect(db.v3Invite.findMany({ where: { vendorId: B.vendorId } })).rejects.toThrow();
    await expect(db.v3ClaimToken.create({ data: { vendorId: B.vendorId, tokenHash: hashToken(generateToken()), expiresAt: new Date() } })).rejects.toThrow();
    const bInvite = await prisma.v3Invite.findFirstOrThrow({ where: { vendorId: B.vendorId } });
    expect(await db.v3Invite.findUnique({ where: { id: bInvite.id } })).toBeNull();
    await expect(db.v3Invite.update({ where: { id: bInvite.id }, data: { subject: 'hacked' } })).rejects.toThrow();
    expect((await prisma.v3Invite.findUniqueOrThrow({ where: { id: bInvite.id } })).subject).toBe(MARK_B);
  });

  it('a vendor token (A\'s owner or a team member) is refused on every staff route; MARKETING staff too', async () => {
    const routes: Array<['get' | 'post', string]> = [
      ['get', '/v3/admin/invites'], ['get', '/v3/admin/provisioning/jobs'], ['post', `/v3/admin/vendors/${B.vendorId}/claim-link/reissue`], ['post', `/v3/admin/vendors/${B.vendorId}/claim-link/revoke`],
    ];
    for (const token of [A.token, A.memberToken, mkt]) for (const [m, url] of routes) {
      expect((await request(app.getHttpServer())[m](url).set('Authorization', `Bearer ${token}`)).status).toBe(403);
    }
    expect((await request(app.getHttpServer()).get('/v3/admin/invites')).status).toBe(401);
    expect(await prisma.v3ClaimToken.count({ where: { vendorId: B.vendorId, status: 'ACTIVE' } })).toBe(1);   // nothing was revoked
  });

  it('staff see invites with masked addresses; B\'s claim link never appears outside the sandbox body', async () => {
    const r = await request(app.getHttpServer()).get(`/v3/admin/invites?vendorId=${B.vendorId}`).set('Authorization', `Bearer ${ops}`);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain(`owner-${MARK_B}@v3test.invalid`);
    expect(r.body.data.items[0].toAddress).toMatch(/^o\*\*\*@v\*\*\*/);
    expect(r.body.data.items[0].bodyPreview).toBe(MARK_B);
  });

  it('the public status route reveals the public business name only: no vendor id, email, phone or token fields', async () => {
    const r = await request(app.getHttpServer()).get(`/v3/claim/${rawB}/status`);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body.data).sort()).toEqual(['businessName', 'expiresAt', 'valid']);
    expect(JSON.stringify(r.body)).not.toMatch(new RegExp(`${B.vendorId}|${B.email}|tokenHash|vendorId`));
  });
});
