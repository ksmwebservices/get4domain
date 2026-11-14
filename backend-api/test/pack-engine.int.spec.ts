// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaPlansRepository } from '../src/plans/entitlements/plans.repository';
import { PrismaPackReferenceStore, PrismaPackVendorStore } from '../src/v3-packs/prisma-pack-engine.store';
import { buildSeed, loadPackEngine } from '../src/v3-packs/seed/pack-seed';
import { readSeedSources } from '../src/v3-packs/seed/seed-files';
import { SeededTenant, cleanupTenants, newPrisma, seedTenant } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';

/**
 * The pack engine tables on STAGING (Amendment 13 Part A and Part B, B14): row level security on every table, the unique keys and foreign keys, tenant isolation of the vendor tables through the real Prisma
 * stores, the pause rows and the entitlement loader that reads them, downgrade keeps data, and the loader dry run against the real tables. Synthetic data only: every reference row this file creates carries the run
 * id and is removed at the end (the vendor rows go with their vendors). NOT RUN in the build session that wrote it (no .env.staging there); the owner runs `npm.cmd run test:int`.
 */
jest.setTimeout(180_000);

const ENGINE_TABLES = [
  'g4d_packs', 'g4d_pack_tabs', 'g4d_capabilities', 'g4d_tier_capabilities', 'g4d_pack_categories', 'g4d_pack_addons',
  'g4d_vendor_packs', 'g4d_vendor_capabilities', 'g4d_vendor_pack_addons', 'g4d_plan_pauses',
];

describe('pack engine tables on staging', () => {
  let prisma: PrismaClient; let svc: PrismaService; let A: SeededTenant; let B: SeededTenant;
  const id = RUN_ID.toLowerCase();
  const K = { pack: `vt-pack-${id}`, pack2: `vt-pack2-${id}`, cap: `VT_CAP_${id.toUpperCase()}`, cap2: `VT_CAP2_${id.toUpperCase()}`, addon: `VT_ADDON_${id.toUpperCase()}`, cat: `vt-cat-${id}`, tab: `vt-tab-${id}` };
  let refs: PrismaPackReferenceStore; let vendors: PrismaPackVendorStore;

  beforeAll(async () => {
    prisma = newPrisma(); svc = prisma as unknown as PrismaService; refs = new PrismaPackReferenceStore(svc); vendors = new PrismaPackVendorStore(svc);
    A = await seedTenant(prisma, 'pea', RUN_ID); B = await seedTenant(prisma, 'peb', RUN_ID);
    await prisma.v3Pack.createMany({ data: [{ key: K.pack, name: `V3TEST ${id}` }, { key: K.pack2, name: `V3TEST 2 ${id}` }] });
    await prisma.v3Capability.createMany({ data: [{ key: K.cap, name: `V3TEST cap ${id}`, sortOrder: 9000 }, { key: K.cap2, name: `V3TEST cap2 ${id}`, sortOrder: 9001 }] });
    await prisma.v3PackAddon.create({ data: { key: K.addon, name: `V3TEST addon ${id}`, grantsCapabilities: [K.cap] } });
  }, 240_000);

  afterAll(async () => {
    await runCleanup([
      () => cleanupTenants(prisma, RUN_ID),   // the vendor tables go with their vendors (ON DELETE CASCADE)
      () => prisma.v3PackTab.deleteMany({ where: { ownerKey: { in: [K.pack, K.pack2, K.cap, K.addon] } } }).then(() => undefined),
      () => prisma.v3PackCategory.deleteMany({ where: { categoryKey: K.cat } }).then(() => undefined),
      () => prisma.v3TierCapability.deleteMany({ where: { capabilityKey: { in: [K.cap, K.cap2] } } }).then(() => undefined),
      () => prisma.v3PackAddon.deleteMany({ where: { key: K.addon } }).then(() => undefined),
      () => prisma.v3Capability.deleteMany({ where: { key: { in: [K.cap, K.cap2] } } }).then(() => undefined),
      () => prisma.v3Pack.deleteMany({ where: { key: { in: [K.pack, K.pack2] } } }).then(() => undefined),
      () => prisma?.$disconnect(),
    ]);
  }, 240_000);

  describe('row level security', () => {
    it('is ON for every engine table, and no table carries a policy (the backend role bypasses it; nothing else may read)', async () => {
      const rows = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY(${ENGINE_TABLES})`;
      expect(rows.map((r) => r.relname).sort()).toEqual([...ENGINE_TABLES].sort());
      expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
      const policies = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY(${ENGINE_TABLES})`;
      expect(policies).toEqual([]);
    });
  });

  describe('reference tables: unique keys, foreign keys, staff edits', () => {
    it('a pack key, a capability key, an add-on key and a category key are each unique', async () => {
      await expect(prisma.v3Pack.create({ data: { key: K.pack, name: 'dup' } })).rejects.toThrow();
      await expect(prisma.v3Capability.create({ data: { key: K.cap, name: 'dup', sortOrder: 1 } })).rejects.toThrow();
      await expect(prisma.v3PackAddon.create({ data: { key: K.addon, name: 'dup' } })).rejects.toThrow();
      await prisma.v3PackCategory.create({ data: { categoryKey: K.cat, name: 'V3TEST category', family: 'test', packKey: K.pack, minTier: 'HANDYMAN' } });
      await expect(prisma.v3PackCategory.create({ data: { categoryKey: K.cat, name: 'dup', family: 'test', packKey: K.pack, minTier: 'HANDYMAN' } })).rejects.toThrow();
    });
    it('a tab is unique per scope, owner and key; the loader\'s createTabs skips a duplicate and an upsert changes the one row', async () => {
      const row = { scope: 'PACK' as const, ownerKey: K.pack, key: K.tab, label: 'Orders', route: '/orders', minTier: null, capabilityKey: null, freeTrial: false, sortOrder: 5 };
      await refs.createTabs([row]); await refs.createTabs([row]);
      expect(await prisma.v3PackTab.count({ where: { ownerKey: K.pack, key: K.tab } })).toBe(1);
      await expect(prisma.v3PackTab.create({ data: row })).rejects.toThrow();
      const changed = await refs.upsertTab({ ...row, label: 'Orders and jobs', active: false }, 'staff-test');
      expect([changed.label, changed.active]).toEqual(['Orders and jobs', false]);
      expect(await prisma.v3PackTab.count({ where: { ownerKey: K.pack, key: K.tab } })).toBe(1);
    });
    it('the tier matrix has one cell per tier and capability, only for a capability that exists, and a staff edit changes the cell and says STAFF', async () => {
      await refs.createMatrix([{ tier: 'HANDYMAN', capabilityKey: K.cap, allowed: false, basis: 'ASSUMED_FOR_OWNER_REVIEW' }]);
      await refs.createMatrix([{ tier: 'HANDYMAN', capabilityKey: K.cap, allowed: true, basis: 'ASSUMED_FOR_OWNER_REVIEW' }]).catch(() => undefined);   // a second insert never overwrites
      expect((await prisma.v3TierCapability.findFirst({ where: { tier: 'HANDYMAN', capabilityKey: K.cap } }))!.allowed).toBe(false);
      await expect(prisma.v3TierCapability.create({ data: { tier: 'HANDYMAN', capabilityKey: K.cap, allowed: true, basis: 'STAFF' } })).rejects.toThrow();
      await expect(prisma.v3TierCapability.create({ data: { tier: 'HANDYMAN', capabilityKey: `no-such-${id}`, allowed: true, basis: 'STAFF' } })).rejects.toThrow();   // foreign key
      const cell = await refs.setMatrixCell('HANDYMAN', K.cap, true, 'staff-test');
      expect([cell!.allowed, cell!.basis]).toEqual([true, 'STAFF']);
      expect(await refs.setMatrixCell('HANDYMAN', `no-such-${id}`, true, 'staff-test')).toBeNull();
    });
    it('a category needs a pack that exists; a staff edit of the category and of the pack is stored; a pack with categories cannot be deleted (RESTRICT)', async () => {
      await expect(prisma.v3PackCategory.create({ data: { categoryKey: `${K.cat}-x`, name: 'x', family: 'test', packKey: `no-such-${id}`, minTier: 'HANDYMAN' } })).rejects.toThrow();
      const cat = await refs.updateCategory(K.cat, { packKey: K.pack2, minTier: 'PROFESSIONAL', starterServices: ['One', 'Two'], ownerNotes: 'checked' }, 'staff-test');
      expect([cat!.packKey, cat!.minTier, cat!.starterServices]).toEqual([K.pack2, 'PROFESSIONAL', ['One', 'Two']]);
      const pack = await refs.updatePack(K.pack, { name: `V3TEST renamed ${id}`, reviewStatus: 'OWNER_REVIEWED' }, 'staff-test');
      expect([pack!.name, pack!.reviewStatus]).toEqual([`V3TEST renamed ${id}`, 'OWNER_REVIEWED']);
      await expect(prisma.v3Pack.delete({ where: { key: K.pack2 } })).rejects.toThrow();
    });
    it('an add-on pack holds no price column at all', async () => {
      const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'g4d_pack_addons'`;
      // No column may hold a price figure. The ONLY price-like column is the marker `priceStatus` (text, default 'PENDING'): it says "not set yet" and holds no number. The old check stripped a trailing "Status" from the name, which turned `priceStatus` into `price` and flagged the marker itself.
      const names = cols.map((c) => c.column_name);
      expect(names.filter((c) => /price|amount|paise|rupee|cost|fee/i.test(c) && c !== 'priceStatus')).toEqual([]);
      const marker = await prisma.$queryRaw<Array<{ data_type: string; column_default: string | null }>>`SELECT data_type, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'g4d_pack_addons' AND column_name = 'priceStatus'`;
      expect(marker).toHaveLength(1); expect(marker[0].data_type).toBe('text'); expect(marker[0].column_default).toContain('PENDING');
      expect(await prisma.v3PackAddon.count({ where: { NOT: { priceStatus: 'PENDING' } } })).toBe(0);   // every add-on is still PENDING
    });
  });

  describe('vendor tables: one pack, capabilities, add-ons, and the isolation of two vendors', () => {
    it('a vendor has exactly one primary pack; another vendor\'s pack is invisible; a pack that does not exist is refused', async () => {
      await vendors.setVendorPack(A.vendorId, { packKey: K.pack, categoryKey: K.cat, starterPicks: ['One'], setByType: 'VENDOR', setById: A.vendorId });
      await vendors.setVendorPack(A.vendorId, { packKey: K.pack, categoryKey: K.cat, starterPicks: ['One', 'Two'], setByType: 'VENDOR', setById: A.vendorId });   // an upsert, never a second row
      expect(await prisma.v3VendorPack.count({ where: { vendorId: A.vendorId } })).toBe(1);
      expect((await vendors.getVendorPack(A.vendorId))!.starterPicks).toEqual(['One', 'Two']);
      expect(await vendors.getVendorPack(B.vendorId)).toBeNull();
      await expect(vendors.setVendorPack(B.vendorId, { packKey: `no-such-${id}`, categoryKey: K.cat, starterPicks: [], setByType: 'VENDOR', setById: null })).rejects.toThrow();
      expect(await vendors.getVendorPack(B.vendorId)).toBeNull();
    });
    it('capabilities are per vendor; switching one off keeps the row (data is kept); the other vendor never sees it', async () => {
      await vendors.setVendorCapability(A.vendorId, K.cap, true, 'VENDOR');
      expect((await vendors.listVendorCapabilities(B.vendorId)).filter((c) => c.capabilityKey === K.cap)).toEqual([]);
      await vendors.setVendorCapability(A.vendorId, K.cap, false, 'VENDOR');
      const mine = await vendors.listVendorCapabilities(A.vendorId);
      expect(mine.find((c) => c.capabilityKey === K.cap)).toMatchObject({ enabled: false });   // the row is still there
      expect(await prisma.v3VendorCapability.count({ where: { vendorId: A.vendorId, capabilityKey: K.cap } })).toBe(1);
      await expect(prisma.v3VendorCapability.create({ data: { vendorId: A.vendorId, capabilityKey: K.cap, enabled: true, source: 'x' } })).rejects.toThrow();
      await expect(vendors.setVendorCapability(A.vendorId, `no-such-${id}`, true, 'VENDOR')).rejects.toThrow();   // foreign key
    });
    it('add-on packs are per vendor; ending one keeps the row; the other vendor\'s list is unchanged', async () => {
      await vendors.setVendorAddon(A.vendorId, K.addon, 'ACTIVE', { type: 'STAFF', id: 's' });
      expect((await vendors.listVendorAddons(B.vendorId)).filter((a) => a.addonKey === K.addon)).toEqual([]);
      await vendors.setVendorAddon(A.vendorId, K.addon, 'ENDED', { type: 'STAFF', id: 's' });
      expect((await vendors.listVendorAddons(A.vendorId)).find((a) => a.addonKey === K.addon)).toMatchObject({ status: 'ENDED' });
      expect(await prisma.v3VendorPackAddon.count({ where: { vendorId: A.vendorId, addonKey: K.addon } })).toBe(1);
      await expect(vendors.setVendorAddon(A.vendorId, `no-such-${id}`, 'ACTIVE', { type: 'STAFF', id: 's' })).rejects.toThrow();
    });
    it('a vendor row is removed with its vendor and with nothing else (cascade), and a reference row stays', async () => {
      const C = await seedTenant(prisma, 'pec', RUN_ID);
      await vendors.setVendorPack(C.vendorId, { packKey: K.pack, categoryKey: K.cat, starterPicks: [], setByType: 'VENDOR', setById: null });
      await vendors.setVendorCapability(C.vendorId, K.cap2, true, 'VENDOR'); await vendors.setVendorAddon(C.vendorId, K.addon, 'ACTIVE', { type: 'STAFF', id: 's' }); await vendors.openPause(C.vendorId, 'test', { type: 'STAFF', id: 's' });
      await prisma.vendor.delete({ where: { id: C.vendorId } }).catch(() => undefined);   // the cleanup would do the same; a vendor with other synthetic rows may refuse, and then the next lines are skipped
      const gone = await prisma.vendor.findUnique({ where: { id: C.vendorId } });
      if (gone === null) {
        expect(await prisma.v3VendorPack.count({ where: { vendorId: C.vendorId } })).toBe(0); expect(await prisma.v3VendorCapability.count({ where: { vendorId: C.vendorId } })).toBe(0);
        expect(await prisma.v3VendorPackAddon.count({ where: { vendorId: C.vendorId } })).toBe(0); expect(await prisma.v3PlanPause.count({ where: { vendorId: C.vendorId } })).toBe(0);
        expect(await prisma.v3Pack.count({ where: { key: K.pack } })).toBe(1);
      }
    });
  });

  describe('the paused plan state', () => {
    it('one open pause per vendor (a second is refused, and the other vendor is not affected); resuming closes it by compare-and-set and keeps the row as history; a new pause can follow', async () => {
      expect(await vendors.openPause(A.vendorId, 'owner asked', { type: 'STAFF', id: 's1' })).not.toBeNull();
      expect(await vendors.openPause(A.vendorId, 'again', { type: 'STAFF', id: 's2' })).toBeNull();
      expect(await vendors.getOpenPause(B.vendorId)).toBeNull();
      expect(await vendors.closePause(B.vendorId, { type: 'STAFF', id: 's1' })).toBe(false);   // B has none: A's is untouched
      expect(await vendors.getOpenPause(A.vendorId)).not.toBeNull();
      const results = await Promise.all([vendors.closePause(A.vendorId, { type: 'STAFF', id: 's1' }), vendors.closePause(A.vendorId, { type: 'STAFF', id: 's2' })]);
      expect(results.filter(Boolean)).toHaveLength(1);   // exactly one closer wins
      expect(await vendors.getOpenPause(A.vendorId)).toBeNull();
      expect(await prisma.v3PlanPause.count({ where: { vendorId: A.vendorId } })).toBe(1);   // history kept
      expect(await vendors.openPause(A.vendorId, 'second time', { type: 'STAFF', id: 's1' })).not.toBeNull();
      expect(await prisma.v3PlanPause.count({ where: { vendorId: A.vendorId } })).toBe(2);
      await vendors.closePause(A.vendorId, { type: 'STAFF', id: 's1' });
    });
    it('the entitlement loader reads the open pause of this vendor only', async () => {
      const repo = new PrismaPlansRepository(svc);
      expect((await repo.loadVendorState(A.vendorId)).paused).toBe(false);
      await vendors.openPause(A.vendorId, 'for the loader', { type: 'STAFF', id: 's1' });
      expect((await repo.loadVendorState(A.vendorId)).paused).toBe(true); expect((await repo.loadVendorState(B.vendorId)).paused).toBe(false);
      await vendors.closePause(A.vendorId, { type: 'STAFF', id: 's1' });
      expect((await repo.loadVendorState(A.vendorId)).paused).toBe(false);
    });
  });

  describe('the loaders against the real tables', () => {
    it('a dry run reads the sheets and the tables, reports no problem and writes nothing', async () => {
      const before = await Promise.all([prisma.v3Pack.count(), prisma.v3PackTab.count(), prisma.v3PackCategory.count(), prisma.v3TierCapability.count(), prisma.v3Capability.count(), prisma.v3PackAddon.count()]);
      const r = await loadPackEngine(refs, buildSeed(readSeedSources()), { apply: false });
      expect(r.applied).toBe(false); expect(r.problems).toEqual([]);
      const after = await Promise.all([prisma.v3Pack.count(), prisma.v3PackTab.count(), prisma.v3PackCategory.count(), prisma.v3TierCapability.count(), prisma.v3Capability.count(), prisma.v3PackAddon.count()]);
      expect(after).toEqual(before);
    });
  });

  describe('the staff role values', () => {
    it('the database enum holds the three old values and the two new ones', async () => {
      const rows = await prisma.$queryRaw<Array<{ enumlabel: string }>>`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'AdminRole'`;
      expect(rows.map((r) => r.enumlabel).sort()).toEqual(['ADMIN', 'MARKETING', 'OPERATIONS', 'SUPER_ADMIN', 'SUPPORT']);
    });
    it('the claim channel enum holds SMS and EMAIL', async () => {
      const rows = await prisma.$queryRaw<Array<{ enumlabel: string }>>`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'V3OtpChannel'`;
      expect(rows.map((r) => r.enumlabel).sort()).toEqual(['EMAIL', 'SMS']);
    });
  });
});
