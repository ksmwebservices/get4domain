// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaProfileFieldStore, PrismaProfileValueStore } from '../src/v3-profile-fields/prisma-profile.store';
import { buildProfileSeed, ProfileField, resolveSchema } from '../src/v3-profile-fields/core/profile-core';
import { loadProfileFields } from '../src/v3-profile-fields/seed/profile-loader';
import { buildSeed } from '../src/v3-packs/seed/pack-seed';
import { readSeedSources } from '../src/v3-packs/seed/seed-files';
import { cleanupTenants, newPrisma, seedBareVendor } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';

/**
 * Wave 2 Part E on STAFF-ONLY staging: the three profile tables (row level security, checks, the unique keys including the empty-string scope), the real stores (field sets with a category override, a staff edit that a
 * second load never overwrites, the map, the vendor values with replace and clear and isolation), and the loader DRY RUN against the real tables (it never applies here: the owner runs the seed script). Platform rows
 * the test makes carry the pack key `vtest-<run id>` and are removed at the end. NOT RUN in the session that wrote it; the owner runs `npx.cmd jest --ci --runInBand test/profile-fields.int.spec.ts --selectProjects int`.
 */
jest.setTimeout(180_000);

describe('profile fields on staging', () => {
  let prisma: PrismaClient; let fields: PrismaProfileFieldStore; let values: PrismaProfileValueStore; let A: { vendorId: string }; let B: { vendorId: string };
  const PACK = `vtest-${RUN_ID.toLowerCase()}-pack`; const CAT = 'vtest-category';
  const f = (over: Partial<ProfileField>): ProfileField => ({ packKey: PACK, categorySlug: '', fieldKey: 'tagline', label: 'Tagline', type: 'text', required: false, options: [], sortOrder: 10, siteSection: 'hero', active: true, ...over });

  beforeAll(async () => {
    prisma = newPrisma(); const svc = prisma as unknown as PrismaService; fields = new PrismaProfileFieldStore(svc); values = new PrismaProfileValueStore(svc);
    A = await seedBareVendor(prisma, 'pfa', RUN_ID); B = await seedBareVendor(prisma, 'pfb', RUN_ID);
  }, 240_000);
  afterAll(async () => {
    await runCleanup([
      () => cleanupTenants(prisma, RUN_ID).then(() => undefined),   // the values go with their vendors (ON DELETE CASCADE)
      () => prisma.v3CategoryProfileField.deleteMany({ where: { packKey: PACK } }).then(() => undefined),
      () => prisma.v3ProfileSiteMap.deleteMany({ where: { packKey: PACK } }).then(() => undefined),
      () => prisma?.$disconnect(),
    ]);
  }, 240_000);

  it('row level security is ON for all three tables and none carries a policy', async () => {
    const names = ['g4d_category_profile_fields', 'g4d_profile_site_map', 'g4d_vendor_profile_values'];
    const rows = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY(${names})`;
    expect(rows.map((r) => r.relname).sort()).toEqual([...names].sort()); expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    expect(await prisma.$queryRaw`SELECT tablename FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY(${names})`).toEqual([]);
  });

  it('the field table: the type and the map kind are closed sets, and a field is unique per pack, category scope and key (the empty scope included)', async () => {
    await fields.createFields([f({}), f({ fieldKey: 'service_areas', label: 'Service areas', type: 'textlist', sortOrder: 20 })]);
    await expect(prisma.v3CategoryProfileField.create({ data: { packKey: PACK, categorySlug: '', fieldKey: 'tagline', label: 'Dup', type: 'text' } })).rejects.toBeDefined();   // '' is a value, so the key holds
    await expect(prisma.v3CategoryProfileField.create({ data: { packKey: PACK, categorySlug: '', fieldKey: 'weird', label: 'Weird', type: 'blob' } })).rejects.toBeDefined();
    await expect(prisma.v3ProfileSiteMap.create({ data: { packKey: PACK, categorySlug: '', fieldKey: 'tagline', targetKind: 'EVERYWHERE' } })).rejects.toBeDefined();
  });

  it('a category override replaces the pack field and a staff edit is never overwritten by a second load', async () => {
    await fields.createFields([f({ categorySlug: CAT, label: 'Tagline for this category', required: true })]);
    const schema = resolveSchema(await fields.listFields(), PACK, CAT); expect(schema.find((x) => x.fieldKey === 'tagline')).toMatchObject({ label: 'Tagline for this category', required: true });
    expect(resolveSchema(await fields.listFields(), PACK, 'another-category').find((x) => x.fieldKey === 'tagline')!.label).toBe('Tagline');
    await fields.upsertField(f({ label: 'Edited by staff' }), null);
    await fields.createFields([f({ label: 'The loader again' })]);   // skipDuplicates: the edit stays
    expect((await fields.listFields()).find((x) => x.packKey === PACK && x.categorySlug === '' && x.fieldKey === 'tagline')!.label).toBe('Edited by staff');
  });

  it('the map: a row is created, an edit is kept, and the most specific row is readable', async () => {
    await fields.createMaps([{ packKey: PACK, categorySlug: '', fieldKey: 'tagline', targetKind: 'FIELD', targetKey: 'site.tagline', itemMap: {}, active: true }]);
    await fields.upsertMap({ packKey: PACK, categorySlug: CAT, fieldKey: 'tagline', targetKind: 'NONE', targetKey: '', itemMap: {}, active: true }, null);
    const maps = (await fields.listMaps()).filter((m) => m.packKey === PACK); expect(maps.map((m) => `${m.categorySlug}|${m.targetKind}`).sort()).toEqual(['vtest-category|NONE', '|FIELD'].sort());
  });

  it('the category lookups read the real category map: a known category answers with its pack, an unknown one with null', async () => {
    expect(await fields.categoryByKey('plumber')).toMatchObject({ categoryKey: 'plumber' }); expect(await fields.categoryByKey('no-such-category')).toBeNull(); expect(await fields.categoryOfVendor(A.vendorId)).toBeNull();
  });

  it('the loader dry run counts against the real tables and writes nothing', async () => {
    const cats = buildSeed(readSeedSources()).categories.map((c) => ({ categoryKey: c.categoryKey, packKey: c.packKey, fieldHints: c.fieldHints ?? [] }));
    const before = [await prisma.v3CategoryProfileField.count(), await prisma.v3ProfileSiteMap.count()];
    const r = await loadProfileFields(fields, cats, { apply: false });
    expect(r).toMatchObject({ applied: false, refused: false, packs: 16, problems: [] }); expect(r.fields).toBe(buildProfileSeed(cats).fields.length);
    expect([await prisma.v3CategoryProfileField.count(), await prisma.v3ProfileSiteMap.count()]).toEqual(before);
  });

  it('the values: replace writes and clears in one go, one business never reads another\'s, and deleting a vendor removes them', async () => {
    await values.replace(A.vendorId, { tagline: 'Plumbing for homes', service_areas: ['Aluva', 'Kakkanad'] }, { type: 'VENDOR', id: A.vendorId });
    expect(await values.get(A.vendorId)).toEqual({ tagline: 'Plumbing for homes', service_areas: ['Aluva', 'Kakkanad'] }); expect(await values.get(B.vendorId)).toEqual({});
    await values.replace(A.vendorId, { tagline: 'Changed' }, { type: 'VENDOR', id: A.vendorId }); expect(await values.get(A.vendorId)).toEqual({ tagline: 'Changed' });
    const gone = await seedBareVendor(prisma, 'pfc', RUN_ID); await values.replace(gone.vendorId, { tagline: 'Temp' }, { type: 'VENDOR', id: gone.vendorId });
    await prisma.vendor.delete({ where: { id: gone.vendorId } }); expect(await prisma.v3VendorProfileValue.count({ where: { vendorId: gone.vendorId } })).toBe(0);
  });
});
