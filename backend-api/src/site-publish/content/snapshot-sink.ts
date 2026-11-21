import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { hashDoc, ManagedDoc } from '../../v3-website/core/managed-doc';

/**
 * Records the managed content document a publication was built from (slice 5.5a), keyed by the publication. The live document is the snapshot of the current
 * publication, so EVERY build that used a managed document records it, whichever route started the build. Insert-if-absent: a reused build never overwrites.
 * A build that used no managed document (a site never edited in the Website manager) records nothing.
 */
export abstract class SnapshotSink {
  abstract record(vendorId: string, publicationId: string, version: number, doc: ManagedDoc | null): Promise<void>;
}

@Injectable()
export class PrismaSnapshotSink extends SnapshotSink {
  constructor(private readonly prisma: PrismaService) { super(); }
  async record(vendorId: string, publicationId: string, version: number, doc: ManagedDoc | null): Promise<void> {
    if (!doc) return;
    await this.prisma.v3SiteSnapshot.createMany({ data: [{ vendorId, publicationId, version, docJson: doc as unknown as object, docHash: hashDoc(doc) }], skipDuplicates: true });
  }
}
