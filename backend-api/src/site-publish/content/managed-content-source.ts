import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { applyToSource, ManagedDoc, normaliseDoc } from '../../v3-website/core/managed-doc';
import { CmsContentSource, ContentSource, LoadOptions } from './content-source';
import { SourceDocument } from './content-types';

/**
 * Where the LIVE managed content document comes from (slice 5.5a). The live document is the snapshot of the vendor's current PUBLISHED publication, so what is
 * live is always a function of which publication is published; a rollback needs no second write. Null when the site was never built from the Website manager.
 */
export abstract class ManagedLayerPort {
  abstract liveDoc(vendorId: string): Promise<ManagedDoc | null>;
}

/** Prisma implementation: follows `rolledBackFromVersion` until it finds a snapshot (a rollback copy has none of its own until the manager writes one). */
@Injectable()
export class PrismaManagedLayer extends ManagedLayerPort {
  constructor(private readonly prisma: PrismaService) { super(); }
  async liveDoc(vendorId: string): Promise<ManagedDoc | null> {
    let pub = await this.prisma.v3SitePublication.findFirst({ where: { vendorId, status: 'PUBLISHED' }, select: { id: true, version: true, rolledBackFromVersion: true } });
    for (let hops = 0; pub && hops < 50; hops++) {
      const snap = await this.prisma.v3SiteSnapshot.findFirst({ where: { vendorId, OR: [{ publicationId: pub.id }, { version: pub.version }] }, select: { docJson: true } });
      if (snap) return normaliseDoc(snap.docJson);
      if (pub.rolledBackFromVersion === null) return null;
      pub = await this.prisma.v3SitePublication.findFirst({ where: { vendorId, version: pub.rolledBackFromVersion }, select: { id: true, version: true, rolledBackFromVersion: true } });
    }
    return null;
  }
}

/**
 * The content source of the site pipeline from slice 5.5: the legacy site document (read only, through the existing source) with the managed document laid over
 * it. `opts.overlay` replaces the live document for one load: the draft preview, a publish, and a staff approval build from the document they name.
 */
@Injectable()
export class ManagedContentSource extends ContentSource {
  constructor(private readonly legacy: CmsContentSource, private readonly layer: ManagedLayerPort) { super(); }
  async load(vendorId: string, opts?: LoadOptions): Promise<SourceDocument | null> {
    const base = await this.legacy.load(vendorId);
    if (!base) return null;
    const doc = opts?.overlay ?? (await this.layer.liveDoc(vendorId));
    return doc ? applyToSource(base, doc) : base;
  }
}
