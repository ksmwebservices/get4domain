// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaInboxStore } from '../src/v3-mail/prisma-inbox.store';
import { PrismaStorageAccessStore } from '../src/v3-storage/prisma-storage.store';
import { PrismaSupportStore } from '../src/v3-support/prisma-support.store';
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

  describe('4b.4 support tickets', () => {
    const t = (vendorId: string | null, over: Record<string, unknown> = {}) => ({ vendorId, requesterType: 'VENDOR', requesterName: null, requesterEmail: null, subject: 'Question', category: 'GENERAL', body: 'first', attachmentPictureId: null, ...over });
    it('a business reads and replies only on its own tickets; staff queries see all; the status move is one transaction', async () => {
      const store = new PrismaSupportStore(svc); const at = new Date();
      const a = await store.createTicket(t(A.vendorId), at); const b = await store.createTicket(t(B.vendorId), at);
      expect(await store.getForVendor(B.vendorId, a.ticket.id)).toBeNull(); expect((await store.listForVendor(A.vendorId, 0, 10)).total).toBe(1);
      expect(await store.addMessage({ ticketId: a.ticket.id, vendorId: B.vendorId }, { authorType: 'VENDOR', authorId: B.vendorId, body: 'x', attachmentPictureId: null }, (c) => c, at)).toBeNull();
      const r = await store.addMessage({ ticketId: a.ticket.id, vendorId: A.vendorId }, { authorType: 'VENDOR', authorId: A.vendorId, body: 'more', attachmentPictureId: null }, () => 'RESOLVED', at);
      expect(r?.ticket.status).toBe('RESOLVED'); expect(r?.ticket.resolvedAt).not.toBeNull(); expect((await store.getAny(a.ticket.id))?.messages).toHaveLength(2);
      expect((await store.listAll({ vendorId: B.vendorId }, 0, 10)).items.map((x) => x.id)).toEqual([b.ticket.id]);
    });
    it('compare-and-set on status: only one of two staff writers wins', async () => {
      const store = new PrismaSupportStore(svc); const a = await store.createTicket(t(A.vendorId), new Date());
      const results = await Promise.all([store.setStatus(a.ticket.id, 'IN_PROGRESS', 'OPEN', new Date()), store.setStatus(a.ticket.id, 'RESOLVED', 'OPEN', new Date())]);
      expect(results.filter((x) => x !== null)).toHaveLength(1);
    });
    it('messages are append-only (trigger): update and delete are refused while the ticket exists', async () => {
      const store = new PrismaSupportStore(svc); const a = await store.createTicket(t(A.vendorId), new Date());
      await expect(prisma.v3TicketMessage.update({ where: { id: a.message.id }, data: { body: 'changed' } })).rejects.toThrow();
      await expect(prisma.v3TicketMessage.delete({ where: { id: a.message.id } })).rejects.toThrow();
    });
    it('the CHECK constraints hold: a vendor ticket needs a vendor, a customer ticket needs an email, and the status is from the list', async () => {
      await expect(prisma.v3Ticket.create({ data: { requesterType: 'VENDOR', subject: 's' } })).rejects.toThrow();
      await expect(prisma.v3Ticket.create({ data: { requesterType: 'CUSTOMER', subject: 's' } })).rejects.toThrow();
      await expect(prisma.v3Ticket.create({ data: { vendorId: A.vendorId, requesterType: 'VENDOR', subject: 's', status: 'DONE' } })).rejects.toThrow();
      expect((await prisma.v3Ticket.create({ data: { requesterType: 'CUSTOMER', requesterEmail: 'c@example.com', subject: 's' } })).vendorId).toBeNull();
    });
    it('CLEANUP DEPENDS ON THIS: deleting a vendor removes its tickets and their (append-only) messages by cascade', async () => {
      // a bare vendor (the same shape seedTenant creates, tagged with the run id so the final cleanup would find it) with nothing but a ticket on it
      const C = await prisma.vendor.create({ data: { name: 'V3TEST b4bc', email: `b4bc-${RUN_ID}@v3test.invalid`, password: 'not-a-real-hash', businessName: `V3TEST b4bc ${RUN_ID}` } });
      const store = new PrismaSupportStore(svc); const c = await store.createTicket(t(C.id), new Date());
      await prisma.vendor.delete({ where: { id: C.id } });
      expect(await prisma.v3Ticket.count({ where: { id: c.ticket.id } })).toBe(0); expect(await prisma.v3TicketMessage.count({ where: { ticketId: c.ticket.id } })).toBe(0);
    });
  });
});
