// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaInboxStore } from '../src/v3-mail/prisma-inbox.store';
import { PrismaStorageAccessStore } from '../src/v3-storage/prisma-storage.store';
import { PrismaPaymentsStore } from '../src/v3-payments/prisma-payments.store';
import { PrismaAdminActionsStore } from '../src/v3-admin-actions/prisma-admin-actions.store';
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

  describe('4b.6 held enquiries', () => {
    it('releaseHeld turns only the HELD rows of that business into NEW; the other business keeps its own held rows', async () => {
      const store = new PrismaInboxStore(svc); const at = new Date(); const row = (id: string) => ({ toAddress: 'a@x.get4domain.com', fromAddress: 'c@example.com', fromName: null, subject: 's', bodyText: 'b', messageIdHdr: id, sizeBytes: 10, spamScore: null, spamVerdict: 'CLEAN', state: 'HELD', forwardStatus: 'SKIPPED_PLAN_ENDED' });
      await store.insertIfNew(A.vendorId, row('<held-a1@x>'), at); await store.insertIfNew(A.vendorId, row('<held-a2@x>'), at); await store.insertIfNew(B.vendorId, row('<held-b1@x>'), at);
      const beforeA = await store.countHeld(A.vendorId); expect(beforeA).toBeGreaterThanOrEqual(2); expect(await store.countHeld(B.vendorId)).toBeGreaterThanOrEqual(1);
      expect(await store.releaseHeld(A.vendorId, at)).toBe(beforeA); expect(await store.countHeld(A.vendorId)).toBe(0); expect(await store.countHeld(B.vendorId)).toBeGreaterThanOrEqual(1);
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

  describe('4b.5 payments recorded by the business', () => {
    const req = (vendorId: string, code: string) => ({ vendorId, code, amountPaise: 75_000, note: null, customerName: 'Meena', customerPhone: null, source: 'MANUAL' as const, requestId: null, orderId: null, methodId: null, expiresAt: new Date(), createdBy: null });
    it('a request with no UPI method settles as cash; the payment says CASH_MANUAL, vendor-recorded; the key finds it for this business only; a second settle changes nothing', async () => {
      const store = new PrismaPaymentsStore(svc); const r = await store.create(req(A.vendorId, `B4B5-${RUN_ID}-cash-0001`)); expect(r.methodId).toBeNull();
      const a = await store.confirmPaid(r.id, A.vendorId, { utr: null, idempotencyKey: `rec-${RUN_ID}-0001`, now: new Date(), method: 'CASH', provider: 'CASH_MANUAL' });
      expect(a?.payment).toMatchObject({ method: 'CASH', provider: 'CASH_MANUAL', vendorRecorded: true, alreadyPaid: undefined }); expect(a?.alreadyPaid).toBe(false);
      expect((await store.confirmPaid(r.id, A.vendorId, { utr: null, idempotencyKey: `rec-${RUN_ID}-0001`, now: new Date(), method: 'CASH', provider: 'CASH_MANUAL' }))?.alreadyPaid).toBe(true);
      expect((await store.paymentByKey(A.vendorId, `rec-${RUN_ID}-0001`))?.paymentRequestId).toBe(r.id); expect(await store.paymentByKey(B.vendorId, `rec-${RUN_ID}-0001`)).toBeNull();
      expect(await store.confirmPaid(r.id, B.vendorId, { utr: null, idempotencyKey: null, now: new Date() })).toBeNull();
    });
    it('the method CHECK holds, and the same key cannot make two payments for one business', async () => {
      const store = new PrismaPaymentsStore(svc); const r = await store.create(req(A.vendorId, `B4B5-${RUN_ID}-chk-0002`));
      await expect(store.confirmPaid(r.id, A.vendorId, { utr: null, idempotencyKey: null, now: new Date(), method: 'CHEQUE', provider: 'X' })).rejects.toThrow();
      const r2 = await store.create(req(A.vendorId, `B4B5-${RUN_ID}-dup-0003`));
      await expect(store.confirmPaid(r2.id, A.vendorId, { utr: null, idempotencyKey: `rec-${RUN_ID}-0001`, now: new Date(), method: 'CASH', provider: 'CASH_MANUAL' })).rejects.toThrow();
    });
  });

  describe('4b.9 staff actions and visit counts', () => {
    it('a rename writes the history row and the new name together; each business reads only its own history', async () => {
      const store = new PrismaAdminActionsStore(svc); const before = (await store.vendor(A.vendorId))!.businessName;
      await store.rename(A.vendorId, before, `${before} renamed`, 'integration test', 'staff-1', new Date());
      expect((await store.vendor(A.vendorId))!.businessName).toBe(`${before} renamed`); expect((await store.nameHistory(A.vendorId, 0, 10)).items[0]).toMatchObject({ oldName: before, newName: `${before} renamed` }); expect((await store.nameHistory(B.vendorId, 0, 10)).total).toBe(0);
    });
    it('a pending plan change is claimed by one applier only, and cannot be cancelled once claimed; the status CHECK holds', async () => {
      const store = new PrismaAdminActionsStore(svc); const c = await store.createPlanChange({ vendorId: A.vendorId, planKey: 'x_plan', termMonths: null, effectiveAt: new Date(Date.now() - 1000), reason: 'integration test', requestedBy: 's', status: 'PENDING', appliedAt: null });
      expect((await store.duePlanChanges(new Date(), 50)).some((x) => x.id === c.id)).toBe(true);
      const claims = await Promise.all([store.claimPlanChange(c.id), store.claimPlanChange(c.id), store.claimPlanChange(c.id)]); expect(claims.filter(Boolean)).toHaveLength(1);
      expect(await store.cancelPlanChange(c.id)).toBe(false); await store.finishPlanChange(c.id, 'APPLIED', new Date(), null); expect((await store.getPlanChange(c.id))!.status).toBe('APPLIED');
      await expect(prisma.v3ScheduledPlanChange.create({ data: { vendorId: A.vendorId, planKey: 'x', effectiveAt: new Date(), reason: 'r', status: 'WEIRD' } })).rejects.toThrow();
    });
    it('a merge moves the contacts and their sources to the kept business in one unit; a unique clash moves nothing; undo sends back only what is still there', async () => {
      const store = new PrismaAdminActionsStore(svc); const mk = (vendorId: string, phoneKey: string) => prisma.v3Customer.create({ data: { vendorId, name: 'Merge Test', phone: phoneKey, phoneKey, firstSource: 'MANUAL' } as never });
      const keepCust = await mk(A.vendorId, '919000000091'); const m1 = await mk(B.vendorId, '919000000092'); const m2 = await mk(B.vendorId, '919000000093');
      await prisma.v3CustomerSource.create({ data: { vendorId: B.vendorId, customerId: m1.id, source: 'MANUAL', refType: 't', refId: '1' } as never });
      await expect(store.applyMerge({ keepVendorId: A.vendorId, mergedVendorId: B.vendorId, reason: 'integration test', actorId: 's', customerIds: [m1.id, m2.id, keepCust.id], conflicts: [], reversibleUntil: new Date(Date.now() + 86_400_000) })).resolves.toBeDefined();
      // keepCust (already A's) is not a mover: its vendor must be unchanged by the filter on the merged business
      expect((await prisma.v3Customer.findUnique({ where: { id: m1.id } }))!.vendorId).toBe(A.vendorId); expect((await prisma.v3CustomerSource.findFirst({ where: { customerId: m1.id } }))!.vendorId).toBe(A.vendorId);
      const dup = await mk(B.vendorId, '919000000091');   // the same phone as keepCust: moving it must clash on the kept business
      await expect(store.applyMerge({ keepVendorId: A.vendorId, mergedVendorId: B.vendorId, reason: 'integration test', actorId: 's', customerIds: [dup.id], conflicts: [], reversibleUntil: new Date(Date.now() + 86_400_000) })).rejects.toThrow();
      expect((await prisma.v3Customer.findUnique({ where: { id: dup.id } }))!.vendorId).toBe(B.vendorId); expect(await prisma.v3ListingMerge.count({ where: { keepVendorId: A.vendorId, mergedVendorId: B.vendorId } })).toBe(1);
      const merge = (await store.listMerges(A.vendorId, 0, 10)).items[0]; await prisma.v3Customer.update({ where: { id: m2.id }, data: { vendorId: B.vendorId } });   // m2 left the kept business meanwhile
      const r = await store.reverseMerge(merge.id, 's', 'integration test', new Date()); expect(r).toEqual({ restored: 1, left: 2 }); expect((await prisma.v3Customer.findUnique({ where: { id: m1.id } }))!.vendorId).toBe(B.vendorId);
      expect(await store.reverseMerge(merge.id, 's', 'again', new Date())).toBeNull();
    });
    it('visit counts add up per host and day, and each business reads only its own; the count CHECK holds', async () => {
      const store = new PrismaAdminActionsStore(svc); const host = `b4b9-${RUN_ID}.example.test`;
      await Promise.all([store.addVisits(A.vendorId, [{ host, day: '2026-11-14', count: 3 }]), store.addVisits(A.vendorId, [{ host, day: '2026-11-14', count: 4 }])]);
      expect(await store.visitsOf(A.vendorId, '2026-11-01', '2026-11-30')).toEqual([{ host, day: '2026-11-14', count: 7 }]); expect(await store.visitsOf(B.vendorId, '2026-11-01', '2026-11-30')).toEqual([]);
      await expect(prisma.v3HostVisitDaily.create({ data: { vendorId: A.vendorId, host: `neg-${RUN_ID}.example.test`, day: '2026-11-14', count: -1 } })).rejects.toThrow();
    });
  });

  describe('4b.11 mail lanes and mailbox prices', () => {
    it('the database refuses promotion on lane 1 or 2, sending on lanes 2 and 3, and an ACTIVE price nobody confirmed', async () => {
      const k = `TMP_${RUN_ID}`;
      await expect(prisma.v3MailLane.create({ data: { key: 'SYSTEM', label: 'x', description: 'x', allowsPromotion: true } })).rejects.toThrow();
      await expect(prisma.v3MailLane.create({ data: { key: 'VENDOR_OFFICIAL', label: 'x', description: 'x', sendingEnabled: true } })).rejects.toThrow();
      await expect(prisma.v3MailLane.create({ data: { key: 'PROMOTIONS', label: 'x', description: 'x', sendingEnabled: true } })).rejects.toThrow();
      await expect(prisma.v3MailboxPrice.create({ data: { key: k, kind: 'EXTRA', scope: 'ANY', label: 'x', pricePaise: 100, status: 'ACTIVE' } })).rejects.toThrow();
      await expect(prisma.v3MailboxPrice.create({ data: { key: `${k}b`, kind: 'EXTRA', scope: 'ANY', label: 'x', pricePaise: -1 } })).rejects.toThrow();
      const p = await prisma.v3MailboxPrice.create({ data: { key: `${k}c`, kind: 'EXTRA', scope: 'ANY', label: 'x', pricePaise: 100 } }); expect(p.status).toBe('PENDING');
      await prisma.v3MailboxPrice.delete({ where: { id: p.id } });
    });
  });

  describe('4b.12 policy kinds', () => {
    it('the eight new kinds exist on the enum, so a placeholder draft can be stored for each (nothing is published)', async () => {
      const kinds = ['TERMS_OF_SERVICE', 'REFUND_WALLET', 'DOMAIN_TERMS', 'ENQUIRY_CONSENT', 'IDENTITY_NOTICE', 'MESSAGING', 'TESTIMONIAL', 'DIRECTORY'] as const;
      const made = await prisma.$transaction(kinds.map((kind, i) => prisma.v3TermsDocument.create({ data: { kind, version: 9000 + i, title: `b4b12-${RUN_ID}`, bodyMarkdown: 'To be supplied by counsel' } })));
      expect(made.every((d) => d.status === 'DRAFT')).toBe(true); await prisma.v3TermsDocument.deleteMany({ where: { id: { in: made.map((d) => d.id) } } });
    });
  });
});
