// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { ELIGIBILITY_SEED, isEligible } from '../src/v3-packs/core/addon-eligibility-core';
import { PrismaPackReferenceStore } from '../src/v3-packs/prisma-pack-engine.store';
import { FIRM_DEFAULTS, FirmProfile } from '../src/v3-firm/core/firm-core';
import { FirmService } from '../src/v3-firm/firm.service';
import { PrismaFirmStore } from '../src/v3-firm/prisma-firm.store';
import { newPrisma } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';

/**
 * Wave 2 Parts H2 and H3 on STAFF-ONLY staging: the two new tables (row level security, the database checks that repeat the owner's rules and the tax number layouts, the foreign keys), the migration's seed rows,
 * and the real Prisma stores behind the eligibility edit and the firm profile. Both tables are shared platform rows, so the test REMEMBERS what it finds first and PUTS IT BACK in afterAll (the firm row, and every
 * eligibility pairing it touches); it makes no row of its own that would need a run id. NOT RUN in the session that wrote it; the owner runs
 * `npx.cmd jest --ci --runInBand test/wave2-h.int.spec.ts --selectProjects int` after applying the migrations 20261219170000 and 20261219180000.
 */
jest.setTimeout(180_000);
const GSTIN = '33ABCDE1234F1Z5'; const PAN = 'ABCDE1234F';

describe('add-on eligibility and the firm profile on staging', () => {
  let prisma: PrismaClient; let refs: PrismaPackReferenceStore; let firm: FirmService;
  let firmBefore: FirmProfile | null = null; const touched = new Map<string, { addonKey: string; packKey: string; existed: boolean; active: boolean }>();
  const key = (a: string, p: string): string => `${a}|${p}`;
  /** every change to a pairing goes through here, so afterAll can undo it even after a failed assertion */
  const setPair = async (addonKey: string, packKey: string, active: boolean): Promise<void> => {
    if (!touched.has(key(addonKey, packKey))) { const r = (await refs.listEligibility()).find((e) => e.addonKey === addonKey && e.packKey === packKey); touched.set(key(addonKey, packKey), { addonKey, packKey, existed: !!r, active: r?.active ?? false }); }
    await refs.setEligibility(addonKey, packKey, active, null);
  };

  beforeAll(async () => {
    prisma = newPrisma(); const svc = prisma as unknown as PrismaService; refs = new PrismaPackReferenceStore(svc);
    const store = new PrismaFirmStore(svc); firmBefore = await store.get(); firm = new FirmService(store);
  }, 240_000);
  afterAll(async () => {
    await runCleanup([
      async () => { for (const t of touched.values()) { if (t.existed) await refs.setEligibility(t.addonKey, t.packKey, t.active, null); else await prisma.v3AddonEligibility.deleteMany({ where: { addonKey: t.addonKey, packKey: t.packKey } }); } },
      async () => { if (firmBefore) await prisma.v3FirmProfile.update({ where: { id: 'platform' }, data: { ...firmBefore } }); },
      () => prisma?.$disconnect(),
    ]);
  }, 240_000);

  it('row level security is ON for both tables and neither carries a policy', async () => {
    const names = ['g4d_addon_eligibility', 'g4d_firm_profile'];
    const rows = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY(${names})`;
    expect(rows.map((r) => r.relname).sort()).toEqual([...names].sort()); expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    expect(await prisma.$queryRaw`SELECT tablename FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY(${names})`).toEqual([]);
  });

  it('the migration seeded the pairings (every one whose add-on pack and pack exist), and the owner rules hold in the data', async () => {
    const rows = await refs.listEligibility(); const have = new Set(rows.map((r) => key(r.addonKey, r.packKey)));
    const packs = new Set((await refs.listPacks()).map((p) => p.key)); const addons = new Set((await refs.listAddons()).map((a) => a.key));
    for (const s of ELIGIBILITY_SEED.filter((e) => packs.has(e.packKey) && addons.has(e.addonKey))) expect([key(s.addonKey, s.packKey), have.has(key(s.addonKey, s.packKey))]).toEqual([key(s.addonKey, s.packKey), true]);
    expect(rows.filter((r) => r.packKey === 'PHARMACY' && (r.addonKey === 'SHOP' || r.addonKey === 'ONLINE_ORDERING_DELIVERY'))).toEqual([]);
    expect(rows.filter((r) => r.addonKey === 'PHARMACY_COUNTER' && r.packKey !== 'PHARMACY')).toEqual([]);
    expect(isEligible(rows, 'PHARMACY_COUNTER', 'PHARMACY')).toBe(packs.has('PHARMACY'));   // true once the pack loader has run on this database
  });

  it('the database repeats the owner rules: a SHOP or ONLINE_ORDERING_DELIVERY row for PHARMACY, and a PHARMACY_COUNTER row for any other pack, cannot be written at all', async () => {
    for (const [a, p] of [['SHOP', 'PHARMACY'], ['ONLINE_ORDERING_DELIVERY', 'PHARMACY'], ['PHARMACY_COUNTER', 'LAB']]) {
      await expect(prisma.$executeRaw`INSERT INTO "g4d_addon_eligibility" ("id", "addonKey", "packKey", "updatedAt") VALUES (${`vtest-${RUN_ID}-${a}-${p}`}, ${a}, ${p}, CURRENT_TIMESTAMP)`).rejects.toThrow(/23514|owner_rules_check|check constraint/);
    }
  });

  it('a pairing needs a real add-on pack and a real pack (foreign keys), and a pairing is unique', async () => {
    await expect(prisma.$executeRaw`INSERT INTO "g4d_addon_eligibility" ("id", "addonKey", "packKey", "updatedAt") VALUES (${`vtest-${RUN_ID}-fk1`}, 'NO_SUCH_ADDON', 'LAB', CURRENT_TIMESTAMP)`).rejects.toThrow(/23503|addonKey_fkey|foreign key/);
    await expect(prisma.$executeRaw`INSERT INTO "g4d_addon_eligibility" ("id", "addonKey", "packKey", "updatedAt") VALUES (${`vtest-${RUN_ID}-fk2`}, 'HOME_SAMPLE_COLLECTION', 'NO_SUCH_PACK', CURRENT_TIMESTAMP)`).rejects.toThrow(/23503|packKey_fkey|foreign key/);
    await setPair('HOME_SAMPLE_COLLECTION', 'LAB', true);
    await expect(prisma.$executeRaw`INSERT INTO "g4d_addon_eligibility" ("id", "addonKey", "packKey", "updatedAt") VALUES (${`vtest-${RUN_ID}-dup`}, 'HOME_SAMPLE_COLLECTION', 'LAB', CURRENT_TIMESTAMP)`).rejects.toThrow(/23505|already exists|addonKey_packKey_key|Unique constraint/);
  });

  it('the real store turns a pairing off and on, creates a missing one once, and never duplicates it', async () => {
    await setPair('HOME_SAMPLE_COLLECTION', 'LAB', false); expect((await refs.listEligibility()).find((e) => e.addonKey === 'HOME_SAMPLE_COLLECTION' && e.packKey === 'LAB')!.active).toBe(false);
    await setPair('HOME_SAMPLE_COLLECTION', 'LAB', true); expect((await refs.listEligibility()).find((e) => e.addonKey === 'HOME_SAMPLE_COLLECTION' && e.packKey === 'LAB')!.active).toBe(true);
    await setPair('HOME_SAMPLE_COLLECTION', 'CLINIC', true);   // the not-yet-defined second case is one more row
    expect((await refs.listEligibility()).filter((e) => e.addonKey === 'HOME_SAMPLE_COLLECTION' && e.packKey === 'CLINIC')).toHaveLength(1);
    expect(await refs.createEligibility([{ addonKey: 'HOME_SAMPLE_COLLECTION', packKey: 'CLINIC' }])).toBe(0);   // skipDuplicates
  });

  it('the firm table holds exactly one row, the defaults at first, and the database repeats the GSTIN, PAN and non-empty checks', async () => {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "g4d_firm_profile"`; expect(rows).toEqual([{ id: 'platform' }]);
    if (firmBefore && firmBefore.gstin === null && firmBefore.legalName === FIRM_DEFAULTS.legalName) expect(firmBefore).toMatchObject({ registeredAddress: FIRM_DEFAULTS.registeredAddress, pan: null });
    await expect(prisma.$executeRaw`INSERT INTO "g4d_firm_profile" ("id", "updatedAt") VALUES ('second', CURRENT_TIMESTAMP)`).rejects.toThrow(/23514|single_row_check|check constraint/);
    await expect(prisma.$executeRaw`UPDATE "g4d_firm_profile" SET "gstin" = '40ABCDE1234F1Z5' WHERE "id" = 'platform'`).rejects.toThrow(/23514|gstin_check|check constraint/);
    await expect(prisma.$executeRaw`UPDATE "g4d_firm_profile" SET "gstin" = '33abcde1234f1z5' WHERE "id" = 'platform'`).rejects.toThrow(/23514|gstin_check|check constraint/);
    await expect(prisma.$executeRaw`UPDATE "g4d_firm_profile" SET "pan" = '12345' WHERE "id" = 'platform'`).rejects.toThrow(/23514|pan_check|check constraint/);
    await expect(prisma.$executeRaw`UPDATE "g4d_firm_profile" SET "legalName" = '  ' WHERE "id" = 'platform'`).rejects.toThrow(/23514|name_check|check constraint/);
  });

  it('the service saves through the real store, the public view adds the GSTIN only once it is set, and clearing it removes the line again', async () => {
    firm.invalidate();
    await firm.update({ gstin: GSTIN, pan: PAN }, { id: null }); firm.invalidate();
    expect(await firm.publicView()).toEqual({ legalName: (await firm.get()).legalName, registeredAddress: (await firm.get()).registeredAddress, gstin: GSTIN });
    expect((await prisma.v3FirmProfile.findUnique({ where: { id: 'platform' } }))).toMatchObject({ gstin: GSTIN, pan: PAN });
    await firm.update({ gstin: null, pan: null }, { id: null }); firm.invalidate();
    expect(Object.keys(await firm.publicView()).sort()).toEqual(['legalName', 'registeredAddress']);
    expect((await firm.seller()).gstin).toBe('');
  });
});
