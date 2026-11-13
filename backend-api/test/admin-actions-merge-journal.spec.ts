import { PrismaAdminActionsStore } from '../src/v3-admin-actions/prisma-admin-actions.store';
import { PrismaService } from '../src/prisma/prisma.service';

// A tiny in-memory stand-in for the transaction client: just enough of v3Customer / v3CustomerSource / v3ListingMerge for applyMerge.
type Cust = { id: string; vendorId: string };
const KEEP = 'vendor-keep'; const MERGED = 'vendor-merged';

function fakePrisma(customers: Cust[]) {
  const created: Array<Record<string, unknown>> = [];
  const matches = (c: Cust, where: { id?: { in: string[] }; vendorId?: string }) => (!where.id || where.id.in.includes(c.id)) && (!where.vendorId || c.vendorId === where.vendorId);
  const tx = {
    v3Customer: {
      findMany: async ({ where }: { where: { id?: { in: string[] }; vendorId?: string } }) => customers.filter((c) => matches(c, where)).map((c) => ({ id: c.id })),
      updateMany: async ({ where, data }: { where: { id?: { in: string[] }; vendorId?: string }; data: { vendorId: string } }) => { const hit = customers.filter((c) => matches(c, where)); hit.forEach((c) => { c.vendorId = data.vendorId; }); return { count: hit.length }; },
    },
    v3CustomerSource: { updateMany: async () => ({ count: 0 }) },
    v3ListingMerge: { create: async ({ data }: { data: Record<string, unknown> }) => { created.push(data); return { id: 'merge-1', status: 'APPLIED', reversedAt: null, reversedBy: null, reverseReason: null, createdAt: new Date(), conflictsJson: [], ...data }; } },
  };
  const prisma = { $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } as unknown as PrismaService;
  return { prisma, created };
}

describe('PrismaAdminActionsStore.applyMerge journal', () => {
  const args = (customerIds: string[]) => ({ keepVendorId: KEEP, mergedVendorId: MERGED, reason: 'r', actorId: 's', customerIds, conflicts: [], reversibleUntil: new Date() });

  it('records only the contacts that actually moved: an id already on the kept business is not in moved.customerIds', async () => {
    const customers: Cust[] = [{ id: 'on-keep', vendorId: KEEP }, { id: 'm1', vendorId: MERGED }, { id: 'm2', vendorId: MERGED }];
    const { prisma, created } = fakePrisma(customers);
    const row = await new PrismaAdminActionsStore(prisma).applyMerge(args(['m1', 'm2', 'on-keep']));
    expect(row.moved.customerIds).toEqual(['m1', 'm2']);
    expect((created[0].movedJson as { customerIds: string[] }).customerIds).toEqual(['m1', 'm2']);
    expect(customers.find((c) => c.id === 'on-keep')!.vendorId).toBe(KEEP);
    expect(customers.filter((c) => c.id !== 'on-keep').every((c) => c.vendorId === KEEP)).toBe(true);
  });

  it('an empty or foreign id list moves and records nothing', async () => {
    const { prisma } = fakePrisma([{ id: 'x', vendorId: 'someone-else' }]);
    expect((await new PrismaAdminActionsStore(prisma).applyMerge(args(['x', 'ghost']))).moved.customerIds).toEqual([]);
  });
});
