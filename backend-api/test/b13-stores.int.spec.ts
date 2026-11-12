// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaAccountsStore } from '../src/v3-accounts/prisma-accounts.store';
import { saleFromDocument } from '../src/v3-accounts/core/accounts-core';
import { PrismaAppointmentsStore } from '../src/v3-appointments/prisma-appointments.store';
import { PrismaJobsStore } from '../src/v3-jobs/prisma-jobs.store';
import { buildQuote } from '../src/v3-jobs/core/jobs-core';
import { PrismaCustomersStore } from '../src/v3-customers/prisma-customers.store';
import { PrismaStoreStore } from '../src/v3-store/prisma-store.store';
import { StockInsufficient } from '../src/v3-store/store.store';
import { StoreService } from '../src/v3-store/store.service';
import { SeededTenant, cleanupTenants, newPrisma, seedTenant } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';

/**
 * Batch 13 stores on STAGING (real unique indexes, real tenant scoping), synthetic data only. Slices add their own describe block here. NOT RUN in the build session that wrote it (no .env.staging
 * there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(120_000);

describe('Batch 13 stores on staging', () => {
  let prisma: PrismaClient; let A: SeededTenant; let B: SeededTenant;
  let customers: PrismaCustomersStore; let accounts: PrismaAccountsStore; let jobs: PrismaJobsStore; let appts: PrismaAppointmentsStore; let shop: PrismaStoreStore;

  beforeAll(async () => {
    prisma = newPrisma();
    const svc = prisma as unknown as PrismaService;
    customers = new PrismaCustomersStore(svc); accounts = new PrismaAccountsStore(svc); jobs = new PrismaJobsStore(svc); appts = new PrismaAppointmentsStore(svc); shop = new PrismaStoreStore(svc);
    A = await seedTenant(prisma, 'b13a', RUN_ID); B = await seedTenant(prisma, 'b13b', RUN_ID);
  }, 240000);
  afterAll(async () => { await runCleanup([() => cleanupTenants(prisma, RUN_ID), () => prisma?.$disconnect()]); }, 180000);

  describe('5.23a customers', () => {
    const f = { name: 'Meena', phone: '9876543210', phoneKey: '919876543210', email: null, emailKey: null };
    it('twenty parallel creates of one person leave one row, and another business keeps its own copy', async () => {
      const r = await Promise.all(Array.from({ length: 20 }, () => customers.create(A.vendorId, { ...f, firstSource: 'SEARCH' })));
      expect(r.filter((x) => x.created)).toHaveLength(1);
      expect(await prisma.v3Customer.count({ where: { vendorId: A.vendorId } })).toBe(1);
      expect((await customers.create(B.vendorId, { ...f, firstSource: 'MANUAL' })).created).toBe(true);
    });
    it('the same (customer, source, reference) is one source row; another business cannot read or change the customer', async () => {
      const c = (await customers.findByKeys(A.vendorId, f.phoneKey, null))!;
      const s = { source: 'SEARCH' as const, refType: 'q', refId: '1', at: new Date() };
      expect(await customers.addSource(A.vendorId, c.id, s)).toBe(true); expect(await customers.addSource(A.vendorId, c.id, s)).toBe(false);
      expect(await customers.get(B.vendorId, c.id)).toBeNull(); expect(await customers.update(B.vendorId, c.id, { name: 'x' })).toBeNull();
    });
  });

  describe('5.23b accounts', () => {
    const doc = (id: string) => saleFromDocument({ id, kind: 'TAX_INVOICE', number: `INV-${id}`, totalPaise: 11800, createdAt: new Date(), customerName: 'Meena', tax: { taxablePaise: 10000, taxPaise: 1800, cgstPaise: 900, sgstPaise: 900, igstPaise: 0, supply: 'INTRA' } });
    it('twenty parallel posts of one document leave one sale record; the same id in another business is its own record', async () => {
      const r = await Promise.all(Array.from({ length: 20 }, () => accounts.postSale(A.vendorId, doc('d1'))));
      expect(r.filter((x) => x.created)).toHaveLength(1);
      expect(await prisma.v3SaleRecord.count({ where: { vendorId: A.vendorId } })).toBe(1);
      expect((await accounts.postSale(B.vendorId, doc('d1'))).created).toBe(true);
    });
    it('expenses and items are scoped to their business, archive instead of delete, and rates come from the table', async () => {
      const e = await accounts.addExpense(A.vendorId, { spentOn: '2026-11-05', category: 'RENT', description: 'Rent', amountPaise: 1000, gstPaise: 0 });
      expect(await accounts.getExpense(B.vendorId, e.id)).toBeNull(); expect(await accounts.updateExpense(B.vendorId, e.id, { description: 'x' })).toBeNull();
      expect((await accounts.updateExpense(A.vendorId, e.id, { archivedAt: new Date() }))?.archivedAt).not.toBeNull(); expect(await prisma.v3Expense.count({ where: { vendorId: A.vendorId } })).toBe(1);
      const i = await accounts.addItem(A.vendorId, { kind: 'ITEM', name: 'Pipe', hsnSac: '7306', unit: 'pc', pricePaise: 500, taxRatePercent: null });
      expect(await accounts.getItem(B.vendorId, i.id)).toBeNull();
      expect(Array.isArray(await accounts.activeTaxRates(new Date()))).toBe(true);
    });
  });
  describe('5.24a jobs', () => {
    const j = { title: 'Fix tap', customerName: 'Ravi', customerPhone: null, address: null, notes: null, customerId: null, requestId: null, scheduledAt: null, assignedTo: null };
    it('thirty parallel jobs get thirty different numbers; another business starts at 1', async () => {
      const r = await Promise.all(Array.from({ length: 30 }, () => jobs.createJob(A.vendorId, j)));
      expect(new Set(r.map((x) => x.number)).size).toBe(30); expect(Math.max(...r.map((x) => x.number))).toBe(30);
      expect((await jobs.createJob(B.vendorId, j)).number).toBe(1);
    });
    it('a status move is one conditional statement: of ten parallel moves exactly one wins, and another business cannot move or read the job', async () => {
      const job = await jobs.createJob(A.vendorId, j);
      const r = await Promise.all(Array.from({ length: 10 }, () => jobs.moveJob(A.vendorId, job.id, 'REQUESTED', 'BOOKED', {})));
      expect(r.filter(Boolean)).toHaveLength(1);
      expect(await jobs.moveJob(B.vendorId, job.id, 'BOOKED', 'IN_PROGRESS', {})).toBeNull(); expect(await jobs.getJob(B.vendorId, job.id)).toBeNull();
    });
    it('a quote is DRAFT-editable once, expires by day, and is scoped to its business', async () => {
      const built = buildQuote([{ name: 'Visit', qty: 1, unitPaise: 100 }], []); if (!built.ok) throw new Error('fixture');
      const q = await jobs.createQuote(A.vendorId, { jobId: null, title: 'Q', customerName: 'R', customerPhone: null, validUntil: '2026-01-01', built: built.value });
      expect(await jobs.getQuote(B.vendorId, q.id)).toBeNull();
      expect(await jobs.moveQuote(A.vendorId, q.id, 'DRAFT', 'SENT', new Date())).not.toBeNull(); expect(await jobs.editDraftQuote(A.vendorId, q.id, { title: 'x' })).toBeNull();
      expect(await jobs.expireQuotes(A.vendorId, '2026-11-12', new Date())).toBe(1); expect(await jobs.expireQuotes(B.vendorId, '2026-11-12', new Date())).toBe(0);
    });
  });
  describe('5.24b appointments', () => {
    it('ten parallel confirms of one request: exactly one wins; busy shows only held times of the right provider; another business sees and moves nothing', async () => {
      const s = await appts.addService(A.vendorId, { name: 'Consult', durationMin: 30, pricePaise: null }); const p = await appts.addProvider(A.vendorId, 'Dr Rao', [{ day: 1, start: '09:00', end: '11:00' }]);
      const start = new Date('2026-11-16T03:30:00Z'); const end = new Date('2026-11-16T04:00:00Z');
      const b = await appts.createBooking(A.vendorId, { serviceId: s.id, providerId: p.id, customerId: null, customerName: 'Meena', customerPhone: null, notes: null, startsAt: start, endsAt: end, requestId: null });
      expect(await appts.busy(A.vendorId, p.id, new Date('2026-11-16T00:00:00Z'), new Date('2026-11-17T00:00:00Z'))).toHaveLength(1);
      const r = await Promise.all(Array.from({ length: 10 }, () => appts.moveBooking(A.vendorId, b.id, 'REQUESTED', 'CONFIRMED', {}, new Date())));
      expect(r.filter(Boolean)).toHaveLength(1);
      expect(await appts.getBooking(B.vendorId, b.id)).toBeNull(); expect(await appts.moveBooking(B.vendorId, b.id, 'CONFIRMED', 'CANCELLED', {}, new Date())).toBeNull();
      expect(await appts.busy(B.vendorId, p.id, new Date('2026-11-16T00:00:00Z'), new Date('2026-11-17T00:00:00Z'))).toHaveLength(0);
      await appts.moveBooking(A.vendorId, b.id, 'CONFIRMED', 'CANCELLED', { cancelReason: 'x' }, new Date());
      expect(await appts.busy(A.vendorId, p.id, new Date('2026-11-16T00:00:00Z'), new Date('2026-11-17T00:00:00Z'))).toHaveLength(0);
    });
  });

  describe('5.24c store', () => {
    const product = (sku: string) => ({ name: 'Pipe', description: null, sku, hsnSac: '7411', pricePaise: 100, taxRatePercent: null, trackStock: true });
    it('sixty parallel single-unit decreases of ten in stock (real pool): exactly ten win, stock ends at zero, never negative, ledger agrees', async () => {
      const p = await shop.addProduct(A.vendorId, product(`I-${RUN_ID}-1`));
      await shop.applyStock(A.vendorId, { productRef: p.id, delta: 10, reason: 'OPENING', key: null, note: null, at: new Date() });
      const r = await Promise.allSettled(Array.from({ length: 60 }, () => shop.applyStock(A.vendorId, { productRef: p.id, delta: -1, reason: 'ADJUSTMENT', key: null, note: null, at: new Date() })));
      expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(10);
      expect(r.filter((x) => x.status === 'rejected').every((x) => (x as PromiseRejectedResult).reason instanceof StockInsufficient)).toBe(true);
      expect((await prisma.v3StockLevel.findFirstOrThrow({ where: { vendorId: A.vendorId, productRef: p.id } })).onHand).toBe(0);
      const moves = await prisma.v3StoreStockMove.findMany({ where: { vendorId: A.vendorId, productRef: p.id } });
      expect(moves).toHaveLength(11); expect(moves.reduce((a, m) => a + m.delta, 0)).toBe(0); expect(moves.every((m) => m.balanceAfter >= 0)).toBe(true);
    });
    it('a refused decrease leaves no level row and no ledger row behind (the transaction rolls back)', async () => {
      const p = await shop.addProduct(A.vendorId, product(`I-${RUN_ID}-2`));
      await expect(shop.applyStock(A.vendorId, { productRef: p.id, delta: -1, reason: 'ADJUSTMENT', key: null, note: null, at: new Date() })).rejects.toBeInstanceOf(StockInsufficient);
      expect(await prisma.v3StockLevel.count({ where: { vendorId: A.vendorId, productRef: p.id } })).toBe(0); expect(await prisma.v3StoreStockMove.count({ where: { vendorId: A.vendorId, productRef: p.id } })).toBe(0);
    });
    it('twenty parallel changes with one key change the stock once', async () => {
      const p = await shop.addProduct(A.vendorId, product(`I-${RUN_ID}-3`));
      const r = await Promise.all(Array.from({ length: 20 }, () => shop.applyStock(A.vendorId, { productRef: p.id, delta: 5, reason: 'RECEIPT', key: `k-${RUN_ID}`, note: null, at: new Date() })));
      expect(r.filter((x) => x.applied)).toHaveLength(1); expect((await prisma.v3StockLevel.findFirstOrThrow({ where: { vendorId: A.vendorId, productRef: p.id } })).onHand).toBe(5);
    });
    it('a SKU is unique per business across products and variants; another business sees and changes nothing', async () => {
      const p = await shop.addProduct(A.vendorId, product(`I-${RUN_ID}-4`));
      await expect(shop.addProduct(A.vendorId, product(`I-${RUN_ID}-4`))).rejects.toThrow('SKU_TAKEN');
      await expect(shop.addVariant(A.vendorId, p.id, { label: 'L', sku: `I-${RUN_ID}-4`, pricePaise: null })).rejects.toThrow('SKU_TAKEN');
      expect((await shop.addProduct(B.vendorId, product(`I-${RUN_ID}-4`))).vendorId).toBe(B.vendorId);
      expect(await shop.getProduct(B.vendorId, p.id)).toBeNull(); expect(await shop.updateProduct(B.vendorId, p.id, { name: 'x' })).toBeNull(); expect(await shop.resolveRef(B.vendorId, p.id)).toBeNull();
    });
    it('the stock import is idempotent on the real ledger and its comparison matches; a second run applies nothing', async () => {
      const svc = new StoreService(shop, { activeRates: async () => [] }, { methods: async () => [] });
      await shop.addProduct(A.vendorId, product(`IMP-${RUN_ID}`));
      const rows = [{ sourceId: `o-${RUN_ID}`, sku: `IMP-${RUN_ID}`, kind: 'OPENING', qty: 10 }, { sourceId: `m-${RUN_ID}`, sku: `IMP-${RUN_ID}`, kind: 'MOVEMENT', qty: -4 }];
      const dry = await svc.importStock(A.vendorId, rows, false); expect(dry).toMatchObject({ mode: 'DRY_RUN', toApply: 2, applied: 0 });
      const first = await svc.importStock(A.vendorId, rows, true); expect(first).toMatchObject({ applied: 2, comparison: { ok: true } });
      const again = await svc.importStock(A.vendorId, rows, true); expect(again).toMatchObject({ applied: 0, alreadyApplied: 2, comparison: { ok: true } });
    });
    it('a return can only be recorded for an order of the business (a recorded fact; no refund is made)', async () => {
      expect(await shop.orderExists(A.vendorId, 'no-such-order')).toBe(false);
      const r = await shop.addReturn(A.vendorId, 'order-x', { reason: 'damaged', amountPaise: 100, note: null }); expect((await shop.listReturns(B.vendorId, 'order-x', { skip: 0, take: 10 })).total).toBe(0); expect(r.vendorId).toBe(A.vendorId);
    });
  });
});
