// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaVendorGapsStore } from '../src/v3-vendor-gaps/prisma-vendor-gaps.store';
import { PrismaNextStepFacts } from '../src/v3-packs/next-steps.service';
import { cleanupTenants, newPrisma, seedBareVendor } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';

/**
 * Wave 2 Part B on STAFF-ONLY staging: the move request and promotion draft tables, the widened enquiry state check, the team store over the shared team table and the next steps facts read from real tables.
 * Synthetic data only (V3TEST vendors, removed with their vendors). NOT RUN in the session that wrote it; the owner runs `npx.cmd jest --ci --runInBand test/vendor-gaps.int.spec.ts --selectProjects int`.
 */
jest.setTimeout(180_000);

describe('vendor gap routes on staging', () => {
  let prisma: PrismaClient; let store: PrismaVendorGapsStore; let A: { vendorId: string }; let B: { vendorId: string };
  const by = { type: 'VENDOR', id: 'v' };

  beforeAll(async () => {
    prisma = newPrisma(); store = new PrismaVendorGapsStore(prisma as unknown as PrismaService);
    A = await seedBareVendor(prisma, 'vga', RUN_ID); B = await seedBareVendor(prisma, 'vgb', RUN_ID);
  }, 240_000);
  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID).then(() => undefined), () => prisma?.$disconnect()]); }, 240_000);

  it('row level security is ON for both new tables and neither carries a policy', async () => {
    const rows = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('g4d_migration_requests', 'g4d_promo_drafts')`;
    expect(rows.map((r) => r.relname).sort()).toEqual(['g4d_migration_requests', 'g4d_promo_drafts']); expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    expect(await prisma.$queryRaw`SELECT tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('g4d_migration_requests', 'g4d_promo_drafts')`).toEqual([]);
  });

  it('B3: one open move request per business (the database key decides), a second business is independent, and the closed-state check holds', async () => {
    const first = await store.openMigrationRequest(A.vendorId, 'https://old.example.com', by); expect(first).not.toBeNull();
    expect(await store.openMigrationRequest(A.vendorId, 'https://other.example.com', by)).toBeNull();   // P2002 on openVendorId
    expect(await store.openMigrationRequest(B.vendorId, 'https://b.example.com', by)).not.toBeNull();
    expect((await store.listMigrationRequests(A.vendorId)).map((r) => r.siteUrl)).toEqual(['https://old.example.com']);
    await expect(prisma.v3MigrationRequest.update({ where: { id: first!.id }, data: { status: 'DONE' } })).rejects.toBeDefined();   // DONE needs openVendorId NULL
    await prisma.v3MigrationRequest.update({ where: { id: first!.id }, data: { status: 'DONE', openVendorId: null } });
    expect(await store.openMigrationRequest(A.vendorId, 'https://new.example.com', by)).not.toBeNull();   // closed, so a new one may open
  });

  it('B8: drafts are listed per kind and per business, archive hides without deleting, a bad kind or status is refused by the database', async () => {
    const d = await store.createPromoDraft(A.vendorId, 'SOCIAL', { channel: 'INSTAGRAM', title: 'New stock', body: 'Fresh arrivals.' }, by);
    await store.createPromoDraft(A.vendorId, 'PROMOTION', { channel: 'OFFER', title: 'Offer', body: 'Details.' }, by);
    expect((await store.listPromoDrafts(A.vendorId, 'SOCIAL', false, 0, 10)).total).toBe(1); expect((await store.listPromoDrafts(B.vendorId, 'SOCIAL', false, 0, 10)).total).toBe(0);
    expect(await store.archivePromoDraft(B.vendorId, 'SOCIAL', d.id)).toBeNull(); expect((await store.archivePromoDraft(A.vendorId, 'SOCIAL', d.id))!.status).toBe('ARCHIVED');
    expect((await store.listPromoDrafts(A.vendorId, 'SOCIAL', false, 0, 10)).total).toBe(0); expect((await store.listPromoDrafts(A.vendorId, 'SOCIAL', true, 0, 10)).total).toBe(1); expect(await prisma.v3PromoDraft.count({ where: { id: d.id } })).toBe(1);
    await expect(prisma.v3PromoDraft.create({ data: { vendorId: A.vendorId, kind: 'TWEET', channel: 'X', title: 't', body: 'b', createdByType: 'VENDOR' } })).rejects.toBeDefined();
    await expect(prisma.v3PromoDraft.create({ data: { vendorId: A.vendorId, kind: 'SOCIAL', channel: 'X', title: 't', body: 'b', status: 'SENT', createdByType: 'VENDOR' } })).rejects.toBeDefined();
  });

  it('B7: the enquiry state check accepts HANDLED, still accepts the old states and refuses an unknown one', async () => {
    const msg = (state: string) => prisma.v3InboxMessage.create({ data: { vendorId: A.vendorId, toAddress: `vg-${RUN_ID}@x.invalid`, fromAddress: 'c@example.com', subject: 's', bodyText: 'b', messageIdHdr: `<${state}-${RUN_ID}@x>`, state, sizeBytes: 10 } });
    for (const s of ['NEW', 'READ', 'ARCHIVED', 'HELD', 'HANDLED']) await expect(msg(s)).resolves.toBeDefined();
    await expect(msg('BOGUS')).rejects.toBeDefined();
  });

  it('B9: the team store works on the shared team table; deactivate stops sign-in (the status the JWT strategy checks) and keeps the row', async () => {
    const m = await store.createTeamInvite(A.vendorId, { name: 'V3TEST Ravi', email: `ravi-${RUN_ID}@v3test.invalid`, phone: null, role: 'Counter staff', department: 'Sales', areas: ['telecrm', 'communication'] });
    expect(m).toMatchObject({ status: 'invited', department: 'Sales', areas: ['telecrm', 'communication'] });
    expect(await store.createTeamInvite(A.vendorId, { name: 'V3TEST Dup', email: `ravi-${RUN_ID}@v3test.invalid`, phone: null, role: 'x', department: null, areas: [] })).toBeNull();
    expect((await store.listTeam(B.vendorId)).length).toBe(0); expect(await store.updateTeamMember(B.vendorId, m!.id, { role: 'stolen' })).toBeNull();
    expect((await store.updateTeamMember(A.vendorId, m!.id, { role: 'Senior', areas: ['telecrm'] }))).toMatchObject({ role: 'Senior', areas: ['telecrm'] });
    expect((await store.setTeamStatus(A.vendorId, m!.id, 'deactivated'))!.status).toBe('deactivated');
    expect((await prisma.teamMember.findUnique({ where: { id: m!.id } }))!.status).not.toBe('active');   // the login path needs 'active'
    expect((await store.setTeamStatus(A.vendorId, m!.id, 'active'))!.status).toBe('invited');   // never signed in, so back to invited, not active
  });

  it('B5: the next steps facts are read from the real tables for a business with nothing yet', async () => {
    const f = await new PrismaNextStepFacts(prisma as unknown as PrismaService).facts(A.vendorId, new Date());
    expect(f).toEqual({ sitePublished: false, draftStarted: false, missingDetails: [], unpaidPlanOrder: false, unconnectedDomain: null });
  });
});
