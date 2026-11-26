import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Actor } from '../../plans/admin/audit.service';
import { EntitlementsService } from '../../plans/entitlements/entitlements.service';
import { planError } from '../../plans/plans.errors';
import { PrismaService } from '../../prisma/prisma.service';
import { ActorKind, SiteEventRow, SiteRepository } from '../../site-publish/publish/site.repository';
import { PublicationSummary } from '../../site-publish/publish/site-settings.service';
import { WebsiteService } from '../website.service';
import { WebsiteStore } from '../website.store';

export interface VersionRow {
  version: number;
  status: string;
  themeId: string;
  publishedAt: Date | null;
  rolledBackFromVersion: number | null;
  /** true for the one version the public sees now */
  current: boolean;
  indexable: boolean;
  /** false: the version has no saved content of its own (built before the Website manager), so going back to it empties the draft's own content */
  hasContentSnapshot: boolean;
  /** null when no publish event was kept for this version */
  publishedBy: { type: ActorKind; name: string } | null;
  /** the written reason of a staff rollback that made this version */
  reason: string | null;
}
export interface VersionList {
  items: VersionRow[]; total: number; page: number; pageSize: number;
  /** false when the vendor's plan has no version history, so a rollback would be refused */
  canRollback: boolean;
  /** true when the draft holds edits that are not live; a rollback replaces them */
  unpublishedChanges: boolean;
}

const OWNER = 'the owner';
const SYSTEM = 'the system';
const UNKNOWN_STAFF = 'Get4Domain staff';

/**
 * E11a: what staff see before going back to an earlier version, and the rollback itself. The rollback is the owner's own `restore` (publish an old snapshot as
 * a new version, reset the draft to it, purge the cache), with the staff member's written reason kept on the site event and the audit row.
 */
@Injectable()
export class SiteVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: SiteRepository,
    private readonly store: WebsiteStore,
    private readonly web: WebsiteService,
    @Inject(EntitlementsService) private readonly entitlements: Pick<EntitlementsService, 'resolve'>,
  ) {}

  private async assertVendor(vendorId: string): Promise<void> {
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } });
    if (!v) throw new NotFoundException(planError('UNKNOWN_VENDOR', 'That business was not found.'));
  }

  /** Names only, never an e-mail address: the staff list first, then the platform's own administrator account (a vendor row). */
  private async staffNames(events: SiteEventRow[]): Promise<Map<string, string>> {
    const ids = [...new Set(events.filter((e) => e.actorType === 'STAFF' && e.actorId).map((e) => e.actorId as string))];
    const names = new Map<string, string>();
    if (!ids.length) return names;
    for (const m of await this.prisma.adminTeamMember.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })) if (m.name) names.set(m.id, m.name);
    const rest = ids.filter((id) => !names.has(id));
    if (rest.length) for (const v of await this.prisma.vendor.findMany({ where: { id: { in: rest } }, select: { id: true, name: true } })) if (v.name) names.set(v.id, v.name);
    return names;
  }

  async list(vendorId: string, page: { skip: number; take: number; page: number; pageSize: number }): Promise<VersionList> {
    await this.assertVendor(vendorId);
    const [{ items, total }, current, snapshots, ent, draft] = await Promise.all([
      this.repo.listPublished(vendorId, { skip: page.skip, take: page.take }),
      this.repo.currentPublication(vendorId),
      this.store.snapshotVersions(vendorId),
      this.entitlements.resolve(vendorId),
      this.web.draft(vendorId),
    ]);
    const events = await this.repo.publishEventsOf(vendorId, items.map((p) => p.id));
    const names = await this.staffNames(events);
    const firstFor = new Map<string, SiteEventRow>();
    for (const e of events) if (e.publicationId && !firstFor.has(e.publicationId)) firstFor.set(e.publicationId, e);
    const nameOf = (e: SiteEventRow): string => (e.actorType === 'VENDOR' ? OWNER : e.actorType === 'SYSTEM' ? SYSTEM : (e.actorId && names.get(e.actorId)) || UNKNOWN_STAFF);
    return {
      items: items.map((p): VersionRow => {
        const e = firstFor.get(p.id);
        return {
          version: p.version, status: p.status, themeId: p.themeId, publishedAt: p.publishedAt, rolledBackFromVersion: p.rolledBackFromVersion,
          current: current?.id === p.id, indexable: p.indexable, hasContentSnapshot: snapshots.includes(p.version),
          publishedBy: e ? { type: e.actorType, name: nameOf(e) } : null,
          reason: e && typeof e.detail.reason === 'string' ? e.detail.reason : null,
        };
      }),
      total, page: page.page, pageSize: page.pageSize,
      canRollback: ent.features['site.revisions']?.state === 'ACTIVE',
      unpublishedChanges: draft.dirty,
    };
  }

  async rollback(vendorId: string, toVersion: number, reason: string, actor: Actor): Promise<PublicationSummary & { draftRestored: boolean; replacedUnpublishedChanges: boolean }> {
    await this.assertVendor(vendorId);
    const r = await this.web.restore(vendorId, toVersion, actor, { reason });
    return { ...r.publication, draftRestored: r.draftRestored, replacedUnpublishedChanges: r.replacedUnpublishedChanges };
  }
}
