// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaInboxStore } from '../src/v3-mail/prisma-inbox.store';
import { PrismaStorageAccessStore } from '../src/v3-storage/prisma-storage.store';
import { SeededTenant, cleanupTenants, newPrisma, seedTenant } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';

/**
 * Block 4b stores on STAGING (real unique indexes, real triggers, real tenant scoping), synthetic data only. Each slice adds its describe block. NOT RUN in the build session that wrote it (no
 * .env.staging there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(120_000);

describe('Block 4b stores on staging', () => {
  let prisma: PrismaClient; let A: SeededTenant; let B: SeededTenant; let svc: PrismaService;
  beforeAll(async () => { prisma = newPrisma(); svc = prisma as unknown as PrismaService; A = await seedTenant(prisma, 'b4ba', RUN_ID); B = await seedTenant(prisma, 'b4bb', RUN_ID); }, 240000);
  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => prisma?.$disconnect()]); }, 180000);

  describe('4b.1 private storage access log', () => {
    it('is append-only while the vendor exists (update and delete are refused by the trigger), and a vendor lists only its own rows', async () => {
      const store = new PrismaStorageAccessStore(svc); const at = new Date();
      await store.record({ vendorId: A.vendorId, bucket: 'PRIVATE', objectKey: `private/${A.vendorId}/identity/x`, action: 'PUT', actorType: 'STAFF', actorId: 's', purpose: 'test' }, at);
      const mine = await store.list(A.vendorId, 0, 10); expect(mine.total).toBe(1); expect((await store.list(B.vendorId, 0, 10)).total).toBe(0);
      const id = mine.items[0].id;
      await expect(prisma.v3StorageAccess.update({ where: { id }, data: { purpose: 'changed' } })).rejects.toThrow();
      await expect(prisma.v3StorageAccess.delete({ where: { id } })).rejects.toThrow();
    });
    it('refuses an action outside the list (CHECK)', async () => {
      await expect(prisma.v3StorageAccess.create({ data: { vendorId: A.vendorId, objectKey: 'k', action: 'PEEK', actorType: 'STAFF' } })).rejects.toThrow();
    });
  });

  describe('4b.2 enquiry inbox', () => {
    const d = (over: Record<string, unknown> = {}) => ({ toAddress: 'a@x.get4domain.com', fromAddress: 'c@example.com', fromName: null, subject: 's', bodyText: 'b', messageIdHdr: '<m1@x>', sizeBytes: 10, spamScore: null, spamVerdict: 'CLEAN', state: 'NEW', forwardStatus: 'PENDING', ...over });
    it('the same message id for one business is one row; the other business keeps its own copy; each reads only its own', async () => {
      const store = new PrismaInboxStore(svc); const at = new Date();
      const rows = await Promise.all(Array.from({ length: 10 }, () => store.insertIfNew(A.vendorId, d(), at)));
      expect(rows.filter((r) => r.created)).toHaveLength(1); expect(await prisma.v3InboxMessage.count({ where: { vendorId: A.vendorId } })).toBe(1);
      expect((await store.insertIfNew(B.vendorId, d(), at)).created).toBe(true);
      const id = rows[0].row.id; expect(await store.get(B.vendorId, id)).toBeNull(); expect(await store.setState(B.vendorId, id, 'ARCHIVED', at)).toBeNull(); expect((await store.list(B.vendorId, {}, 0, 10)).total).toBe(1);
    });
    it('a message without an id is never treated as a duplicate; HELD cannot be changed through setState; CHECK constraints hold', async () => {
      const store = new PrismaInboxStore(svc); const at = new Date();
      expect((await store.insertIfNew(A.vendorId, d({ messageIdHdr: null }), at)).created).toBe(true); expect((await store.insertIfNew(A.vendorId, d({ messageIdHdr: null }), at)).created).toBe(true);
      const held = await store.insertIfNew(A.vendorId, d({ messageIdHdr: '<h@x>', state: 'HELD' }), at); expect(await store.setState(A.vendorId, held.row.id, 'READ', at)).toBeNull(); expect(await store.countHeld(A.vendorId)).toBe(1);
      await expect(prisma.v3InboxMessage.create({ data: { vendorId: A.vendorId, toAddress: 'a', fromAddress: 'b', subject: 's', bodyText: 'b', sizeBytes: 1, state: 'WEIRD' } })).rejects.toThrow();
    });
  });
});
