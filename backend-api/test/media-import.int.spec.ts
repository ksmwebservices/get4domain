// MUST stay the first import: runs the staging guard and sets the test environment (see support/staging-env.ts).
import { RUN_ID } from './support/staging-env';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaMediaUploadStore } from '../src/v3-media-upload/prisma-media-upload.store';
import { MediaUploadService } from '../src/v3-media-upload/media-upload.service';
import { UPLOAD_TYPES } from '../src/v3-storage/settings/storage-settings';
import { FakeMediaStorage, SharpImagePort } from '../src/v3-website/media/media.ports';
import { cleanupTenants, newPrisma, seedBareVendor } from './support/fixtures';
import { runCleanup } from './support/cleanup-guard';

/**
 * Wave 2 Part D on STAFF-ONLY staging: the uploaded files table (row level security, its checks and keys), the real Prisma upload store (scope isolation, the same file is one row, soft removal) and a real picture re-encoded
 * by sharp (metadata dropped, size read) into an IN-MEMORY storage: no real storage is ever called here. Synthetic data only (V3TEST vendors; draft uploads belong to a synthetic staff member and are removed by
 * the cleanup script). NOT RUN in the session that wrote it; the owner runs `npx.cmd jest --ci --runInBand test/media-import.int.spec.ts --selectProjects int`.
 */
jest.setTimeout(180_000);

describe('media upload on staging', () => {
  let prisma: PrismaClient; let store: PrismaMediaUploadStore; let svc: MediaUploadService; let storage: FakeMediaStorage; let A: { vendorId: string }; let B: { vendorId: string }; let staffId: string;
  const caps = { mediaUploadMaxBytes: 2_000_000, mediaUploadMaxPixels: 4_000_000, mediaUploadAllowedTypes: [...UPLOAD_TYPES] };
  const actor = (id: string) => ({ type: 'VENDOR' as const, id, ip: null });
  const png = (w: number, h: number, colour: string): Promise<Buffer> => sharp({ create: { width: w, height: h, channels: 3, background: colour } }).withMetadata({ exif: { IFD0: { Copyright: 'V3TEST' } } }).png().toBuffer();

  beforeAll(async () => {
    prisma = newPrisma(); store = new PrismaMediaUploadStore(prisma as unknown as PrismaService); storage = new FakeMediaStorage();
    svc = new MediaUploadService(store, storage, new SharpImagePort(), { get: async () => caps } as never);
    A = await seedBareVendor(prisma, 'mua', RUN_ID); B = await seedBareVendor(prisma, 'mub', RUN_ID);
    const s = await prisma.adminTeamMember.create({ data: { name: 'V3TEST staff', email: `staff-mu-${RUN_ID}@v3test.invalid`, role: 'MARKETING', status: 'active' } }); staffId = s.id;
  }, 240_000);
  afterAll(async () => {
    await runCleanup([
      () => cleanupTenants(prisma, RUN_ID).then(() => undefined),   // uploads of a vendor go with the vendor; draft uploads go by their synthetic staff member
      () => prisma.v3Media.deleteMany({ where: { vendorId: null, uploadedById: staffId } }).then(() => undefined),
      () => prisma.adminTeamMember.deleteMany({ where: { id: staffId } }).then(() => undefined),
      () => prisma?.$disconnect(),
    ]);
  }, 240_000);

  it('row level security is ON for the uploads table and it carries no policy', async () => {
    const rows = await prisma.$queryRaw<Array<{ relrowsecurity: boolean }>>`SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'g4d_media'`;
    expect(rows).toEqual([{ relrowsecurity: true }]); expect(await prisma.$queryRaw`SELECT tablename FROM pg_policies WHERE schemaname = 'public' AND tablename = 'g4d_media'`).toEqual([]);
  });

  it('the checks: a content type outside the five, a vendor upload with no vendor, a draft upload with a vendor, a picture with no size and a repeated file in one scope are all refused', async () => {
    const base = { scopeKey: `vendor:${A.vendorId}`, kind: 'IMAGE', contentType: 'image/png', bytes: 10, sha256: 'a'.repeat(64), key: `vendors/${A.vendorId}/uploads/${'a'.repeat(64)}.png`, url: 'https://media.example.test/x', uploadedByType: 'VENDOR' };
    await expect(prisma.v3Media.create({ data: { ...base, vendorId: A.vendorId, ownerKind: 'VENDOR_SITE', contentType: 'image/gif', key: 'k1' } })).rejects.toBeDefined();
    await expect(prisma.v3Media.create({ data: { ...base, vendorId: null, ownerKind: 'VENDOR_SITE', key: 'k2' } })).rejects.toBeDefined();
    await expect(prisma.v3Media.create({ data: { ...base, vendorId: A.vendorId, ownerKind: 'LISTING_DRAFT', key: 'k3' } })).rejects.toBeDefined();
    await expect(prisma.v3Media.create({ data: { ...base, vendorId: A.vendorId, ownerKind: 'VENDOR_SITE', key: 'k4' } })).rejects.toBeDefined();   // an IMAGE (not svg) needs width and height
    const ok = await prisma.v3Media.create({ data: { ...base, vendorId: A.vendorId, ownerKind: 'VENDOR_SITE', width: 10, height: 10 } }); expect(ok.id).toBeTruthy();
    await expect(prisma.v3Media.create({ data: { ...base, vendorId: A.vendorId, ownerKind: 'VENDOR_SITE', width: 10, height: 10, key: 'k5' } })).rejects.toBeDefined();   // (scopeKey, sha256) is unique
  });

  it('a real picture is re-encoded (location and camera data dropped), its size is read, it is stored under the vendor, and the same picture is one row', async () => {
    const bytes = await png(40, 30, '#336699'); expect((await sharp(bytes).metadata()).exif).toBeDefined();
    const v = await svc.upload({ kind: 'VENDOR', vendorId: A.vendorId }, actor(A.vendorId), { buffer: bytes, mimetype: 'image/png', size: bytes.length }, 'A blue test square');
    expect(v).toMatchObject({ kind: 'IMAGE', contentType: 'image/png', width: 40, height: 30 });
    const stored = storage.files.get([...storage.files.keys()][0])!; expect((await sharp(stored.bytes).metadata()).exif).toBeUndefined();
    const again = await svc.upload({ kind: 'VENDOR', vendorId: A.vendorId }, actor(A.vendorId), { buffer: bytes, mimetype: 'image/png', size: bytes.length }, 'Same picture'); expect(again.id).toBe(v.id);
    expect(await prisma.v3Media.count({ where: { vendorId: A.vendorId, sha256: { not: 'a'.repeat(64) } } })).toBe(1);
  });

  it('scope isolation through the real store: another business sees nothing and removes nothing; a draft upload belongs to its staff member; removal is soft', async () => {
    const list = await svc.list({ kind: 'VENDOR', vendorId: A.vendorId }); const id = list.items.find((m) => m.width === 40)!.id;
    expect((await svc.list({ kind: 'VENDOR', vendorId: B.vendorId })).total).toBe(0);
    await expect(svc.remove({ kind: 'VENDOR', vendorId: B.vendorId }, id, actor(B.vendorId))).rejects.toBeDefined();
    const bytes = await png(20, 20, '#aa3333');
    const d = await svc.upload({ kind: 'DRAFT', staffId }, { type: 'STAFF', id: staffId, ip: null }, { buffer: bytes, mimetype: 'image/png', size: bytes.length }, 'Draft picture');
    expect((await prisma.v3Media.findUnique({ where: { id: d.id } }))).toMatchObject({ vendorId: null, ownerKind: 'LISTING_DRAFT', scopeKey: `draft:${staffId}` }); expect((await svc.list({ kind: 'DRAFT', staffId: 'someone-else' })).total).toBe(0);
    await svc.remove({ kind: 'VENDOR', vendorId: A.vendorId }, id, actor(A.vendorId)); expect(await prisma.v3Media.findUnique({ where: { id } })).toMatchObject({ status: 'REMOVED' }); expect((await svc.list({ kind: 'VENDOR', vendorId: A.vendorId })).items.some((m) => m.id === id)).toBe(false);
  });

  it('deleting a vendor removes its uploads (the cleanup the staging script relies on)', async () => {
    const gone = await seedBareVendor(prisma, 'mud', RUN_ID); const bytes = await png(8, 8, '#33aa33');
    await svc.upload({ kind: 'VENDOR', vendorId: gone.vendorId }, actor(gone.vendorId), { buffer: bytes, mimetype: 'image/png', size: bytes.length }, 'Temp');
    await prisma.vendor.delete({ where: { id: gone.vendorId } }); expect(await prisma.v3Media.count({ where: { vendorId: gone.vendorId } })).toBe(0);
  });
});
