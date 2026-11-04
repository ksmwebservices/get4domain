import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { advisoryXactLock } from '../../common/db-lock';
import { KeyedQueue } from '../../common/keyed-queue';
import { PrismaService } from '../../prisma/prisma.service';
import { MissingField, siteError } from '../site.errors';
import { HostResolver } from './site-public.service';
import {
  NewPage, NewPublication, PageRow, PublicationRow, PublishOptions, RollbackOptions, SiteEventInput, SiteRepository, SiteSettingsRow, TxHook,
} from './site.repository';

const notFound = (): NotFoundException => new NotFoundException(siteError('PUBLICATION_NOT_FOUND', 'That version of the site does not exist.'));
const toPub = (r: Prisma.V3SitePublicationGetPayload<object>): PublicationRow => ({
  ...r, missingFieldsJson: r.missingFieldsJson as unknown as MissingField[], warningsJson: r.warningsJson as unknown as string[], createdByType: r.createdByType,
});
const toPage = (r: Prisma.V3SitePublicationPageGetPayload<object>): PageRow => ({ publicationId: r.publicationId, vendorId: r.vendorId, path: r.path, lang: r.lang, html: r.html, seoJson: (r.seoJson ?? {}) as Record<string, unknown>, bytes: r.bytes, sha256: r.sha256 });
const eventData = (vendorId: string, publicationId: string | null, e: SiteEventInput) => ({ vendorId, publicationId, type: e.type, actorType: e.actorType, actorId: e.actorId, detailJson: e.detail as Prisma.InputJsonValue });
const supersededStatus = (rolledBackFrom: number | null): 'SUPERSEDED' | 'ROLLED_BACK' => (rolledBackFrom !== null ? 'ROLLED_BACK' : 'SUPERSEDED');

/**
 * Prisma implementation of the site storage. Build, publish and rollback each take a per-vendor advisory lock inside one transaction and write the audit row
 * (the hook runs on the transaction client) with the change. The checks that read other tables (entitlements, content) run just BEFORE the locked
 * transaction, not inside it: an interactive transaction holds a pooled connection, and a check that needs a second one while two publishes overlap could
 * exhaust a small pool. Inside the lock the status of the row is read again, which is what makes the transition safe.
 */
@Injectable()
export class PrismaSiteRepository extends SiteRepository {
  /** Waiting for a vendor's turn happens here, in memory, NOT inside a transaction (see keyed-queue.ts: pool starvation). The advisory lock stays as the guard between processes. */
  private readonly queue = new KeyedQueue();
  constructor(private readonly prisma: PrismaService) { super(); }

  async getSettings(vendorId: string): Promise<SiteSettingsRow | null> { return this.prisma.v3SiteSettings.findUnique({ where: { vendorId } }); }

  async upsertSettings(vendorId: string, patch: Partial<Pick<SiteSettingsRow, 'themeId' | 'language' | 'variant' | 'motionIntensity' | 'forceNoindex'>>): Promise<SiteSettingsRow> {
    return this.prisma.v3SiteSettings.upsert({ where: { vendorId }, create: { vendorId, ...patch }, update: patch });
  }

  async newestPublication(vendorId: string) { const r = await this.prisma.v3SitePublication.findFirst({ where: { vendorId }, orderBy: { version: 'desc' } }); return r ? toPub(r) : null; }
  async currentPublication(vendorId: string) { const r = await this.prisma.v3SitePublication.findFirst({ where: { vendorId, status: 'PUBLISHED' } }); return r ? toPub(r) : null; }
  async getPublication(id: string) { const r = await this.prisma.v3SitePublication.findUnique({ where: { id } }); return r ? toPub(r) : null; }
  async listPublications(vendorId: string, take: number) { return (await this.prisma.v3SitePublication.findMany({ where: { vendorId }, orderBy: { version: 'desc' }, take })).map(toPub); }
  async pagesOf(publicationId: string) { return (await this.prisma.v3SitePublicationPage.findMany({ where: { publicationId }, orderBy: [{ lang: 'asc' }, { path: 'asc' }] })).map(toPage); }
  async getPage(publicationId: string, path: string, lang: string) { const r = await this.prisma.v3SitePublicationPage.findUnique({ where: { publicationId_path_lang: { publicationId, path, lang } } }); return r ? toPage(r) : null; }

  async createPublication(data: NewPublication, pages: NewPage[], event: SiteEventInput, audit?: TxHook): Promise<PublicationRow> {
    return this.queue.run(`site-build:${data.vendorId}`, () => this.prisma.$transaction(async (tx) => {
      await advisoryXactLock(tx, `site-build:${data.vendorId}`);
      const last = await tx.v3SitePublication.aggregate({ where: { vendorId: data.vendorId }, _max: { version: true } });
      const row = await tx.v3SitePublication.create({
        data: { ...data, version: (last._max.version ?? 0) + 1, missingFieldsJson: data.missingFieldsJson as unknown as Prisma.InputJsonValue, warningsJson: data.warningsJson as unknown as Prisma.InputJsonValue },
      });
      await tx.v3SitePublicationPage.createMany({ data: pages.map((p) => ({ ...p, publicationId: row.id, vendorId: data.vendorId, seoJson: p.seoJson as Prisma.InputJsonValue })) });
      await tx.v3SiteEvent.create({ data: eventData(data.vendorId, row.id, event) });
      if (audit) await audit(tx);
      return toPub(row);
    }, { timeout: 60_000, maxWait: 15_000 }));
  }

  async publish(vendorId: string, publicationId: string, o: PublishOptions): Promise<PublicationRow> {
    const pre = await this.prisma.v3SitePublication.findUnique({ where: { id: publicationId } });
    if (!pre || pre.vendorId !== vendorId) throw notFound();
    if (pre.status === 'PUBLISHED') return toPub(pre);
    if (pre.status !== 'DRAFT_PREVIEW') throw notFound();
    await o.validate(toPub(pre));
    return this.queue.run(`site-publish:${vendorId}`, () => this.prisma.$transaction(async (tx) => {
      await advisoryXactLock(tx, `site-publish:${vendorId}`);
      const target = await tx.v3SitePublication.findUnique({ where: { id: publicationId } });
      if (!target || target.vendorId !== vendorId) throw notFound();
      if (target.status === 'PUBLISHED') return toPub(target);
      if (target.status !== 'DRAFT_PREVIEW') throw notFound();
      const prev = await tx.v3SitePublication.findFirst({ where: { vendorId, status: 'PUBLISHED' } });
      if (prev) await tx.v3SitePublication.update({ where: { id: prev.id }, data: { status: supersededStatus(prev.rolledBackFromVersion), currentVendorId: null } });
      const row = await tx.v3SitePublication.update({ where: { id: publicationId }, data: { status: 'PUBLISHED', publishedAt: o.now, currentVendorId: vendorId } });
      await tx.v3SiteEvent.create({ data: eventData(vendorId, publicationId, o.event) });
      if (o.audit) await o.audit(tx);
      return toPub(row);
    }, { maxWait: 15_000 }));
  }

  async rollback(vendorId: string, toVersion: number, o: RollbackOptions): Promise<PublicationRow> {
    const src = await this.prisma.v3SitePublication.findUnique({ where: { vendorId_version: { vendorId, version: toVersion } } });
    if (!src || src.publishedAt === null) throw notFound();
    await o.validate(toPub(src));
    const pages = await this.prisma.v3SitePublicationPage.findMany({ where: { publicationId: src.id } });
    return this.queue.run(`site-publish:${vendorId}`, () => this.prisma.$transaction(async (tx) => {
      await advisoryXactLock(tx, `site-publish:${vendorId}`);
      const last = await tx.v3SitePublication.aggregate({ where: { vendorId }, _max: { version: true } });
      const version = (last._max.version ?? 0) + 1;
      const prev = await tx.v3SitePublication.findFirst({ where: { vendorId, status: 'PUBLISHED' } });
      if (prev) await tx.v3SitePublication.update({ where: { id: prev.id }, data: { status: supersededStatus(prev.rolledBackFromVersion), currentVendorId: null } });
      const row = await tx.v3SitePublication.create({
        data: {
          vendorId, version, status: 'PUBLISHED', themeId: src.themeId, themeHash: src.themeHash, contentHash: src.contentHash, settingsHash: src.settingsHash, indexable: src.indexable, indexHeader: src.indexHeader,
          missingFieldsJson: src.missingFieldsJson as Prisma.InputJsonValue, warningsJson: src.warningsJson as Prisma.InputJsonValue, languages: src.languages, totalBytes: src.totalBytes,
          rolledBackFromVersion: toVersion, createdByType: o.actor.type, createdById: o.actor.id, publishedAt: o.now, currentVendorId: vendorId,
        },
      });
      await tx.v3SitePublicationPage.createMany({ data: pages.map((p) => ({ publicationId: row.id, vendorId, path: p.path, lang: p.lang, html: p.html, seoJson: (p.seoJson ?? {}) as Prisma.InputJsonValue, bytes: p.bytes, sha256: p.sha256 })) });
      await tx.v3SiteEvent.create({ data: eventData(vendorId, row.id, o.event(version)) });
      if (o.audit) await o.audit(tx);
      return toPub(row);
    }, { timeout: 60_000, maxWait: 15_000 }));
  }

  async recordEvent(vendorId: string, publicationId: string | null, event: SiteEventInput, audit?: TxHook): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.v3SiteEvent.create({ data: eventData(vendorId, publicationId, event) });
      if (audit) await audit(tx);
    });
  }

  async listSites(f: { skip: number; take: number }) {
    const where: Prisma.VendorWhereInput = { OR: [{ v3SiteSettings: { isNot: null } }, { v3SitePublications: { some: {} } }] };
    const [vendors, total] = await Promise.all([
      this.prisma.vendor.findMany({ where, select: { id: true, businessName: true }, orderBy: { createdAt: 'desc' }, skip: f.skip, take: f.take }),
      this.prisma.vendor.count({ where }),
    ]);
    const items = await Promise.all(vendors.map(async (v) => ({ vendorId: v.id, businessName: v.businessName, settings: await this.getSettings(v.id), current: await this.currentPublication(v.id), newest: await this.newestPublication(v.id) })));
    return { items, total };
  }
}

/** Host name -> vendor, from the vendor's subdomain. A removed business and an unknown name give the same null; a suspended or pending vendor is served (owner rule 9). */
@Injectable()
export class SubdomainHostResolver extends HostResolver {
  constructor(private readonly prisma: PrismaService) { super(); }

  async resolve(host: string): Promise<{ vendorId: string } | null> {
    const base = (process.env.SITE_BASE_DOMAIN || 'get4domain.com').toLowerCase();
    if (!host.endsWith(`.${base}`)) return null;
    const sub = host.slice(0, -(base.length + 1));
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(sub)) return null;
    const v = await this.prisma.vendor.findUnique({ where: { subdomain: sub }, select: { id: true, v3SiteRemoval: { select: { vendorId: true } } } });
    return v && !v.v3SiteRemoval ? { vendorId: v.id } : null;
  }
}
