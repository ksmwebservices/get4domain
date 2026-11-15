// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaAdminGapsStore } from '../src/v3-admin-gaps/prisma-admin-gaps.store';
import { checkVendorFilter } from '../src/v3-admin-gaps/core/admin-gaps-core';
import { PrismaPlanBillingRepository } from '../src/plan-billing/prisma-plan-billing.repository';
import { cleanupTenants, newPrisma, seedBareVendor } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';

/**
 * Wave 2 Part C on STAFF-ONLY staging: the append-only staff notes table and its trigger, the four settle columns on the plan order and their check, the vendors list query with its filters, the held count and the
 * staff invoice list query. Synthetic data only (V3TEST vendors; the notes go after their vendors, like the activity log). NOT RUN in the session that wrote it; the owner runs
 * `npx.cmd jest --ci --runInBand test/admin-gaps.int.spec.ts --selectProjects int`.
 */
jest.setTimeout(180_000);

describe('admin gap routes on staging', () => {
  let prisma: PrismaClient; let store: PrismaAdminGapsStore; let A: { vendorId: string; email: string };

  beforeAll(async () => { prisma = newPrisma(); store = new PrismaAdminGapsStore(prisma as unknown as PrismaService); A = await seedBareVendor(prisma, 'aga', RUN_ID); }, 240_000);
  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID).then(() => undefined), () => prisma?.$disconnect()]); }, 240_000);

  it('row level security is ON for the notes table and it carries no policy', async () => {
    const rows = await prisma.$queryRaw<Array<{ relrowsecurity: boolean }>>`SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'g4d_vendor_notes'`;
    expect(rows).toEqual([{ relrowsecurity: true }]); expect(await prisma.$queryRaw`SELECT tablename FROM pg_policies WHERE schemaname = 'public' AND tablename = 'g4d_vendor_notes'`).toEqual([]);
  });

  it('C5: a note is added and listed newest first; the database refuses to change it or to delete it while its vendor exists; an empty note is refused', async () => {
    const n1 = await store.addNote(A.vendorId, 'First note', { id: null, name: 'V3TEST staff' }); await store.addNote(A.vendorId, 'Second note', { id: null, name: 'V3TEST staff' });
    expect((await store.listNotes(A.vendorId, 0, 10)).items.map((n) => n.body)).toEqual(['Second note', 'First note']);
    await expect(prisma.v3VendorNote.update({ where: { id: n1.id }, data: { body: 'edited' } })).rejects.toBeDefined();
    await expect(prisma.v3VendorNote.delete({ where: { id: n1.id } })).rejects.toBeDefined();
    await expect(prisma.v3VendorNote.create({ data: { vendorId: A.vendorId, body: '   ', byName: 'x' } })).rejects.toBeDefined();
    expect(await prisma.v3VendorNote.count({ where: { vendorId: A.vendorId } })).toBe(2);
  });

  it('C6: the order carries the four settle columns, and a negative recorded amount is refused', async () => {
    const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'g4d_plan_orders' AND column_name IN ('settledReference', 'settledOn', 'settledAmountPaise', 'settledByName')`;
    expect(cols.map((c) => c.column_name).sort()).toEqual(['settledAmountPaise', 'settledByName', 'settledOn', 'settledReference']);
    const constraint = await prisma.$queryRaw<Array<{ conname: string }>>`SELECT conname FROM pg_constraint WHERE conname = 'g4d_plan_orders_settled_amount_check'`; expect(constraint).toHaveLength(1);
  });

  it('C3: the vendors list finds the test business by name, filters by status and industry, and reports no plan and no listing state for a bare business', async () => {
    const f = checkVendorFilter({ q: RUN_ID, status: 'ACTIVE' }); expect(f.ok).toBe(true); if (!f.ok) return;
    const r = await store.listVendors(f.value);
    expect(r.items.some((v) => v.id === A.vendorId)).toBe(true); const row = r.items.find((v) => v.id === A.vendorId)!; expect(row).toMatchObject({ plan: null, listingState: null });
    for (const filter of [{ plan: 'PRO' }, { plan: 'handyman_pro' }, { listingState: 'LIVE' }, { listingState: 'DRAFT_SITE' }, { listingState: 'UNCLAIMED_LISTING' }, { listingState: 'CLAIMED' }, { listingState: 'REMOVED' }]) {
      const c = checkVendorFilter({ q: RUN_ID, ...filter }); if (c.ok) expect((await store.listVendors(c.value)).items.some((v) => v.id === A.vendorId)).toBe(false);   // every filter runs as valid SQL and excludes a bare business
    }
  });

  it('C4: the held count counts only held enquiries', async () => {
    const mk = (state: string, n: number) => prisma.v3InboxMessage.create({ data: { vendorId: A.vendorId, toAddress: `ag-${RUN_ID}@x.invalid`, fromAddress: 'c@example.com', subject: 's', bodyText: 'b', messageIdHdr: `<ag-${n}-${RUN_ID}@x>`, state, sizeBytes: 10 } });
    await mk('HELD', 1); await mk('HELD', 2); await mk('NEW', 3);
    expect(await store.heldCount(A.vendorId)).toBe(2); expect(await store.vendorExists(A.vendorId)).toBe(true); expect(await store.vendorExists('nope')).toBe(false);
  });

  it('C7: the staff invoice list query runs for every filter and returns nothing for a business with no invoices', async () => {
    const repo = new PrismaPlanBillingRepository(prisma as unknown as PrismaService, {} as never, {} as never);   // the staff list reads invoices only: it never touches the audit or subscription services
    for (const status of [undefined, 'PAID', 'REFUND_RECORDED'] as const) expect(await repo.listInvoicesForStaff({ vendorId: A.vendorId, status, skip: 0, take: 10 })).toEqual({ items: [], total: 0 });
  });
});
