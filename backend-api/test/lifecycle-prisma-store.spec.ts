import { AuditService } from '../src/plans/admin/audit.service';
import { PrismaLifecycleStore } from '../src/vendor-lifecycle/prisma-lifecycle.store';

/** Slice 5.1d: the Prisma store against a recording fake client: what a removal writes, in one transaction, and what it never does. */
function fakePrisma(opts: { existingRemoval?: boolean } = {}) {
  const calls: string[] = [];
  const tx = {
    v3SiteRemoval: { findUnique: async () => (opts.existingRemoval ? { vendorId: 'v1' } : null), create: async (a: { data: Record<string, unknown> }) => { calls.push(`removal.create ${a.data.kind}`); return {}; } },
    v3AccountDeletionRequest: { updateMany: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => { calls.push(`deletion.update ${String(a.data.status)} pendingVendorId=${String(a.data.pendingVendorId)}`); return { count: 1 }; } },
    v3DncRegister: { upsert: async (a: { create: Record<string, unknown> }) => { calls.push(`register.upsert ${String(a.create.source)}`); return {}; } },
    v3DirectoryBusiness: { updateMany: async (a: { data: Record<string, unknown> }) => { calls.push(`directory.update ${String(a.data.status)} indexable=${String(a.data.indexable)}`); return { count: 1 }; } },
    v3AuditLog: { create: async (a: { data: Record<string, unknown> }) => { calls.push(`audit ${String(a.data.action)}`); return {}; } },
    vendor: { update: async () => { calls.push('vendor.update'); return {}; } },
  };
  let inTx = 0; let maxInTx = 0;
  const prisma = { $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => { inTx++; maxInTx = Math.max(maxInTx, inTx); try { return await fn(tx); } finally { inTx--; } }, v3DirectoryBusiness: tx.v3DirectoryBusiness };
  return { prisma, calls, maxInTx: () => maxInTx };
}
const args = { vendorId: 'v1', kind: 'VENDOR_REQUEST' as const, reason: 'owner asked', phoneHash: 'hash1', requestedBy: 'u1', deletionRequestId: 'd1', executedBy: 's1', audit: { actor: { type: 'STAFF' as const, id: 's1', ip: null }, action: 'lifecycle.execute_deletion', entityType: 'x', entityId: 'd1' } };

describe('PrismaLifecycleStore.executeRemoval', () => {
  it('writes the removal row, the register row, marks the directory business REMOVED and noindex, closes the request and audits, all in one transaction; deletes nothing', async () => {
    const f = fakePrisma(); const store = new PrismaLifecycleStore(f.prisma as never, new AuditService({} as never));
    expect(await store.executeRemoval(args)).toEqual({ alreadyRemoved: false });
    expect(f.calls).toEqual(['deletion.update EXECUTED pendingVendorId=null', 'removal.create VENDOR_REQUEST', 'register.upsert REMOVAL', 'directory.update REMOVED indexable=false', 'audit lifecycle.execute_deletion']);
    expect(f.calls.join()).not.toMatch(/delete/i);
  });
  it('is idempotent: an already removed business changes nothing more (but a pending request is still closed)', async () => {
    const f = fakePrisma({ existingRemoval: true }); const store = new PrismaLifecycleStore(f.prisma as never, new AuditService({} as never));
    expect(await store.executeRemoval(args)).toEqual({ alreadyRemoved: true });
    expect(f.calls).toEqual(['deletion.update EXECUTED pendingVendorId=null']);
  });
  it('no phone, no register row', async () => {
    const f = fakePrisma(); const store = new PrismaLifecycleStore(f.prisma as never, new AuditService({} as never));
    await store.executeRemoval({ ...args, phoneHash: null, kind: 'STAFF_EMPTY_LISTING', deletionRequestId: undefined });
    expect(f.calls).toEqual(['removal.create STAFF_EMPTY_LISTING', 'directory.update REMOVED indexable=false', 'audit lifecycle.execute_deletion']);
  });
  it('queues per vendor BEFORE the transaction: parallel removals of one vendor never overlap inside a transaction', async () => {
    const f = fakePrisma(); const store = new PrismaLifecycleStore(f.prisma as never, new AuditService({} as never));
    await Promise.all(Array.from({ length: 10 }, () => store.executeRemoval(args)));
    expect(f.maxInTx()).toBe(1);
  });
});
