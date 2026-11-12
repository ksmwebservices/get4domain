// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaAccountsStore } from '../src/v3-accounts/prisma-accounts.store';
import { saleFromDocument } from '../src/v3-accounts/core/accounts-core';
import { PrismaJobsStore } from '../src/v3-jobs/prisma-jobs.store';
import { buildQuote } from '../src/v3-jobs/core/jobs-core';
import { PrismaCustomersStore } from '../src/v3-customers/prisma-customers.store';
import { SeededTenant, cleanupTenants, newPrisma, seedTenant } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';

/**
 * Batch 13 stores on STAGING (real unique indexes, real tenant scoping), synthetic data only. Slices add their own describe block here. NOT RUN in the build session that wrote it (no .env.staging
 * there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(120_000);

describe('Batch 13 stores on staging', () => {
  let prisma: PrismaClient; let A: SeededTenant; let B: SeededTenant;
  let customers: PrismaCustomersStore; let accounts: PrismaAccountsStore; let jobs: PrismaJobsStore;

  beforeAll(async () => {
    prisma = newPrisma();
    const svc = prisma as unknown as PrismaService;
    customers = new PrismaCustomersStore(svc); accounts = new PrismaAccountsStore(svc); jobs = new PrismaJobsStore(svc);
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
});
