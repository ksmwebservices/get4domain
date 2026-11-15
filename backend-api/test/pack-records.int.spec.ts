// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaPackRecordStore, PrismaPackTabFieldStore } from '../src/v3-pack-records/prisma-pack-records.store';
import { loadTabFields } from '../src/v3-pack-records/seed/tab-field-loader';
import { buildSeed } from '../src/v3-packs/seed/pack-seed';
import { readSeedSources } from '../src/v3-packs/seed/seed-files';
import { cleanupTenants, newPrisma, seedBareVendor } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';

/**
 * Wave 2 Part A on STAFF-ONLY staging: the pack record tables. Row level security on both, the database checks and keys, tenant isolation through the real Prisma stores, soft delete, the loader dry run against the real
 * field table (it NEVER applies here: the owner runs the seed script for that), and the cascade that cleans a vendor's records. Synthetic data only: platform rows carry `vtest-<run id>` and every vendor is V3TEST.
 * NOT RUN in the session that wrote it (no .env.staging there); the owner runs `npx.cmd jest --ci --runInBand test/pack-records.int.spec.ts --selectProjects int`.
 */
jest.setTimeout(180_000);

describe('pack records on staging', () => {
  let prisma: PrismaClient; let fields: PrismaPackTabFieldStore; let records: PrismaPackRecordStore;
  let A: { vendorId: string }; let B: { vendorId: string };
  const id = RUN_ID.toLowerCase(); const OWNER = `vtest-${id}-pack`; const TAB = 'jobs';
  const by = { type: 'VENDOR', id: 'v' };

  beforeAll(async () => {
    prisma = newPrisma(); const svc = prisma as unknown as PrismaService; fields = new PrismaPackTabFieldStore(svc); records = new PrismaPackRecordStore(svc);
    A = await seedBareVendor(prisma, 'pra', RUN_ID); B = await seedBareVendor(prisma, 'prb', RUN_ID);
  }, 240_000);
  afterAll(async () => {
    await runCleanup([
      () => cleanupTenants(prisma, RUN_ID).then(() => undefined),   // the records go with their vendors (ON DELETE CASCADE); the tagged platform rows go by their owner key
      () => prisma.v3PackTabField.deleteMany({ where: { ownerKey: { startsWith: `vtest-${id}` } } }).then(() => undefined),
      () => prisma?.$disconnect(),
    ]);
  }, 240_000);

  it('row level security is ON for both tables and neither carries a policy', async () => {
    const rows = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('g4d_pack_tab_fields', 'g4d_pack_records')`;
    expect(rows.map((r) => r.relname).sort()).toEqual(['g4d_pack_records', 'g4d_pack_tab_fields']); expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    expect(await prisma.$queryRaw`SELECT tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('g4d_pack_tab_fields', 'g4d_pack_records')`).toEqual([]);
  });

  it('the field table: the type is a closed set and a field key is unique per tab', async () => {
    await fields.createFields([{ ownerKey: OWNER, tabKey: TAB, fieldKey: 'title', label: 'Title', type: 'text', required: true, options: [], sortOrder: 10, listColumn: true, searchable: true }]);
    await fields.createFields([{ ownerKey: OWNER, tabKey: TAB, fieldKey: 'title', label: 'Changed by a second load', type: 'text', required: true, options: [], sortOrder: 10, listColumn: true, searchable: true }]);   // skipDuplicates: never overwritten
    const have = await fields.listFields(OWNER, TAB); expect(have).toHaveLength(1); expect(have[0].label).toBe('Title');
    await expect(prisma.v3PackTabField.create({ data: { ownerKey: OWNER, tabKey: TAB, fieldKey: 'bad', label: 'Bad', type: 'blob' } })).rejects.toBeDefined();
    await expect(prisma.v3PackTabField.create({ data: { ownerKey: OWNER, tabKey: TAB, fieldKey: 'title', label: 'Dup', type: 'text' } })).rejects.toBeDefined();
  });

  it('the loader dry run counts against the real table and writes nothing', async () => {
    const before = await prisma.v3PackTabField.count();
    const r = await loadTabFields(fields, buildSeed(readSeedSources()).tabs, { apply: false });
    expect(r).toMatchObject({ applied: false, refused: false, problems: [] }); expect(r.total).toBeGreaterThan(400); expect(await prisma.v3PackTabField.count()).toBe(before);
  });

  it('records: a status outside the set is refused by the database; one vendor never reads, changes or archives another vendor\'s record; archive is a soft delete', async () => {
    const a = await records.create(A.vendorId, OWNER, TAB, { data: { title: 'A job' }, searchText: 'a job', status: 'OPEN' }, by);
    await expect(prisma.v3PackRecord.create({ data: { vendorId: A.vendorId, packKey: OWNER, tabKey: TAB, data: {}, status: 'BOGUS', createdByType: 'VENDOR' } })).rejects.toBeDefined();
    expect(await records.get(B.vendorId, OWNER, TAB, a.id)).toBeNull(); expect((await records.list(B.vendorId, OWNER, TAB, { q: '', status: null, archived: false, skip: 0, take: 10 })).total).toBe(0);
    expect(await records.update(B.vendorId, OWNER, TAB, a.id, { data: { title: 'stolen' } }, by)).toBeNull(); expect(await records.setArchived(B.vendorId, OWNER, TAB, a.id, true, by)).toBeNull();
    expect((await records.get(A.vendorId, OWNER, TAB, a.id))!.data).toEqual({ title: 'A job' });
    expect((await records.setArchived(A.vendorId, OWNER, TAB, a.id, true, by))!.deletedAt).not.toBeNull();
    expect((await records.list(A.vendorId, OWNER, TAB, { q: '', status: null, archived: false, skip: 0, take: 10 })).total).toBe(0); expect((await records.list(A.vendorId, OWNER, TAB, { q: '', status: null, archived: true, skip: 0, take: 10 })).total).toBe(1);
    expect(await records.update(A.vendorId, OWNER, TAB, a.id, { data: { title: 'edit while archived' } }, by)).toBeNull();   // an archived record is not edited until restored
    expect((await records.setArchived(A.vendorId, OWNER, TAB, a.id, false, by))!.deletedAt).toBeNull();
    expect(await prisma.v3PackRecord.count({ where: { id: a.id } })).toBe(1);   // never hard deleted
  });

  it('search matches the searchable text, case folded, and status filters', async () => {
    await records.create(A.vendorId, OWNER, TAB, { data: { title: 'Fix drain' }, searchText: 'fix drain', status: 'DONE' }, by);
    const hit = await records.list(A.vendorId, OWNER, TAB, { q: 'drain', status: 'DONE', archived: false, skip: 0, take: 10 }); expect(hit.total).toBe(1);
    expect((await records.list(A.vendorId, OWNER, TAB, { q: 'drain', status: 'OPEN', archived: false, skip: 0, take: 10 })).total).toBe(0);
  });

  it('deleting a vendor removes its records (the cleanup the staging script relies on)', async () => {
    const gone = await seedBareVendor(prisma, 'prc', RUN_ID);
    await records.create(gone.vendorId, OWNER, TAB, { data: { title: 'Temp' }, searchText: 'temp', status: 'OPEN' }, by);
    await prisma.vendor.delete({ where: { id: gone.vendorId } });
    expect(await prisma.v3PackRecord.count({ where: { vendorId: gone.vendorId } })).toBe(0);
  });
});
