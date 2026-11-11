import { PrismaManagedLayer } from '../src/site-publish/content/managed-content-source';
import { PrismaSnapshotSink } from '../src/site-publish/content/snapshot-sink';
import { emptyDoc, hashDoc } from '../src/v3-website/core/managed-doc';

/** The Prisma live-document layer and the snapshot sink, over a small fake of the two tables they read: the walk through rollback copies, the legacy-only case, tenant separation. */
interface Pub { id: string; vendorId: string; version: number; status: string; rolledBackFromVersion: number | null }
interface Snap { vendorId: string; publicationId: string; version: number; docJson: unknown }
const doc = (t: string) => ({ ...emptyDoc(), fields: { 'hero.title': t } });
function fake(pubs: Pub[], snaps: Snap[]) {
  const created: unknown[] = [];
  const prisma = {
    v3SitePublication: { findFirst: async ({ where }: { where: { vendorId: string; status?: string; version?: number } }) => pubs.find((p) => p.vendorId === where.vendorId && (where.status ? p.status === where.status : true) && (where.version !== undefined ? p.version === where.version : true)) ?? null },
    v3SiteSnapshot: {
      findFirst: async ({ where }: { where: { vendorId: string; OR: Array<{ publicationId?: string; version?: number }> } }) => snaps.find((s) => s.vendorId === where.vendorId && where.OR.some((o) => (o.publicationId !== undefined && s.publicationId === o.publicationId) || (o.version !== undefined && s.version === o.version))) ?? null,
      createMany: async (a: unknown) => { created.push(a); return { count: 1 }; },
    },
  };
  return { prisma, created };
}

describe('PrismaManagedLayer: the live document is the snapshot of the current publication', () => {
  it('returns the snapshot of the published version', async () => {
    const { prisma } = fake([{ id: 'p2', vendorId: 'a', version: 2, status: 'PUBLISHED', rolledBackFromVersion: null }], [{ vendorId: 'a', publicationId: 'p2', version: 2, docJson: doc('two') }]);
    expect((await new PrismaManagedLayer(prisma as never).liveDoc('a'))?.fields['hero.title']).toBe('two');
  });
  it('a rollback copy with no snapshot of its own resolves to its source version, through a chain of rollbacks', async () => {
    const pubs: Pub[] = [
      { id: 'p1', vendorId: 'a', version: 1, status: 'SUPERSEDED', rolledBackFromVersion: null }, { id: 'p3', vendorId: 'a', version: 3, status: 'SUPERSEDED', rolledBackFromVersion: 1 },
      { id: 'p4', vendorId: 'a', version: 4, status: 'PUBLISHED', rolledBackFromVersion: 3 },
    ];
    const { prisma } = fake(pubs, [{ vendorId: 'a', publicationId: 'p1', version: 1, docJson: doc('one') }]);
    expect((await new PrismaManagedLayer(prisma as never).liveDoc('a'))?.fields['hero.title']).toBe('one');
  });
  it('a published version built before the manager existed (no snapshot, no rollback) gives null: the legacy document alone', async () => {
    const { prisma } = fake([{ id: 'p1', vendorId: 'a', version: 1, status: 'PUBLISHED', rolledBackFromVersion: null }], []);
    expect(await new PrismaManagedLayer(prisma as never).liveDoc('a')).toBeNull();
  });
  it('no published version, or an unknown vendor, gives null', async () => {
    const { prisma } = fake([{ id: 'p1', vendorId: 'a', version: 1, status: 'DRAFT_PREVIEW', rolledBackFromVersion: null }], [{ vendorId: 'a', publicationId: 'p1', version: 1, docJson: doc('x') }]);
    const l = new PrismaManagedLayer(prisma as never); expect(await l.liveDoc('a')).toBeNull(); expect(await l.liveDoc('nobody')).toBeNull();
  });
  it('another vendor with the same version number never supplies the document', async () => {
    const { prisma } = fake([{ id: 'pa', vendorId: 'a', version: 1, status: 'PUBLISHED', rolledBackFromVersion: null }], [{ vendorId: 'b', publicationId: 'pb', version: 1, docJson: doc('theirs') }]);
    expect(await new PrismaManagedLayer(prisma as never).liveDoc('a')).toBeNull();
  });
  it('a loop of rollbacks is cut off, not followed for ever', async () => {
    const pubs: Pub[] = [{ id: 'p1', vendorId: 'a', version: 1, status: 'PUBLISHED', rolledBackFromVersion: 2 }, { id: 'p2', vendorId: 'a', version: 2, status: 'SUPERSEDED', rolledBackFromVersion: 1 }];
    expect(await new PrismaManagedLayer(fake(pubs, []).prisma as never).liveDoc('a')).toBeNull();
  });
});

describe('PrismaSnapshotSink', () => {
  it('records nothing for a build that used no managed document', async () => {
    const { prisma, created } = fake([], []); await new PrismaSnapshotSink(prisma as never).record('a', 'p1', 1, null); expect(created).toEqual([]);
  });
  it('records insert-if-absent, with the vendor, the publication, the version and the hash of the document', async () => {
    const { prisma, created } = fake([], []); const d = doc('x'); await new PrismaSnapshotSink(prisma as never).record('a', 'p1', 1, d);
    expect(created).toEqual([{ data: [{ vendorId: 'a', publicationId: 'p1', version: 1, docJson: d, docHash: hashDoc(d) }], skipDuplicates: true }]);
  });
});
