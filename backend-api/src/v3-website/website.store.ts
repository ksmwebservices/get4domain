import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hashDoc, ManagedDoc, normaliseDoc } from './core/managed-doc';

export interface DraftRow { vendorId: string; doc: ManagedDoc; rev: number; baseVersion: number | null; updatedAt: Date }
export interface SnapshotRow { vendorId: string; publicationId: string; version: number; doc: ManagedDoc; docHash: string; createdAt: Date }

/** Everything the Website manager stores (slice 5.5a). Prisma implementation below; an in-memory twin lives in test/support. Every call is scoped by vendor id. */
export abstract class WebsiteStore {
  abstract getDraft(vendorId: string): Promise<DraftRow | null>;
  /** Compare and set: writes only when the stored revision equals `expectedRev` (null = no draft yet). Returns null when the draft moved meanwhile. */
  abstract saveDraft(vendorId: string, doc: ManagedDoc, o: { expectedRev: number | null; baseVersion: number | null; by: string | null }): Promise<DraftRow | null>;
  abstract deleteDraft(vendorId: string): Promise<void>;
  abstract snapshotByVersion(vendorId: string, version: number): Promise<SnapshotRow | null>;
  abstract snapshotVersions(vendorId: string): Promise<number[]>;
}

@Injectable()
export class PrismaWebsiteStore extends WebsiteStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  private draftRow(r: { vendorId: string; docJson: Prisma.JsonValue; rev: number; baseVersion: number | null; updatedAt: Date }): DraftRow {
    return { vendorId: r.vendorId, doc: normaliseDoc(r.docJson), rev: r.rev, baseVersion: r.baseVersion, updatedAt: r.updatedAt };
  }
  async getDraft(vendorId: string): Promise<DraftRow | null> {
    const r = await this.prisma.v3SiteDraft.findUnique({ where: { vendorId } });
    return r ? this.draftRow(r) : null;
  }
  async saveDraft(vendorId: string, doc: ManagedDoc, o: { expectedRev: number | null; baseVersion: number | null; by: string | null }): Promise<DraftRow | null> {
    const data = { docJson: doc as unknown as Prisma.InputJsonValue, baseVersion: o.baseVersion, updatedBy: o.by };
    if (o.expectedRev === null) {
      const made = await this.prisma.v3SiteDraft.createMany({ data: [{ vendorId, ...data, rev: 1 }], skipDuplicates: true });
      return made.count === 1 ? this.getDraft(vendorId) : null;
    }
    const done = await this.prisma.v3SiteDraft.updateMany({ where: { vendorId, rev: o.expectedRev }, data: { ...data, rev: o.expectedRev + 1 } });
    return done.count === 1 ? this.getDraft(vendorId) : null;
  }
  async deleteDraft(vendorId: string): Promise<void> { await this.prisma.v3SiteDraft.deleteMany({ where: { vendorId } }); }
  async snapshotByVersion(vendorId: string, version: number): Promise<SnapshotRow | null> {
    const r = await this.prisma.v3SiteSnapshot.findUnique({ where: { vendorId_version: { vendorId, version } } });
    return r ? { vendorId, publicationId: r.publicationId, version: r.version, doc: normaliseDoc(r.docJson), docHash: r.docHash || hashDoc(normaliseDoc(r.docJson)), createdAt: r.createdAt } : null;
  }
  async snapshotVersions(vendorId: string): Promise<number[]> {
    return (await this.prisma.v3SiteSnapshot.findMany({ where: { vendorId }, select: { version: true }, orderBy: { version: 'desc' }, take: 500 })).map((r) => r.version);
  }
}
