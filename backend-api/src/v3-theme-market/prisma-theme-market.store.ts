import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../plans/admin/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditSpec, NewTheme, ThemeFilter, ThemePatch, ThemeRow, ThemeRowWithBytes, ThemeStatus, ThemeMarketStore } from './theme-market.store';

type Db = Prisma.V3ThemeMarketPackageGetPayload<Record<string, never>>;
type DbLite = Omit<Db, 'bytes'>;
const LITE = { id: true, key: true, version: true, name: true, description: true, tier: true, status: true, visibility: true, privateVendorId: true, sourceVendorId: true, starter: true, licence: true, tracks: true, packs: true, addons: true, capabilities: true, tags: true, catalogueCategories: true, kitCategories: true, manifestJson: true, contentHash: true, sizeBytes: true, fileCount: true, consentObtained: true, consentNote: true, consentAt: true, consentById: true, reviewNote: true, createdByType: true, createdById: true, createdAt: true, updatedAt: true, submittedAt: true, publishedAt: true, publishedById: true, archivedAt: true, deletedAt: true, deletedById: true } as const;

const row = (r: DbLite): ThemeRow => ({
  id: r.id, key: r.key, version: r.version, name: r.name, description: r.description, tier: r.tier, status: r.status as ThemeStatus, visibility: r.visibility as ThemeRow['visibility'], privateVendorId: r.privateVendorId, sourceVendorId: r.sourceVendorId,
  starter: r.starter, licence: r.licence, tracks: r.tracks, packs: r.packs, addons: r.addons, capabilities: r.capabilities, tags: r.tags, catalogueCategories: r.catalogueCategories, kitCategories: r.kitCategories, manifest: r.manifestJson,
  contentHash: r.contentHash, sizeBytes: r.sizeBytes, fileCount: r.fileCount, consentObtained: r.consentObtained, consentNote: r.consentNote, consentAt: r.consentAt, consentById: r.consentById, reviewNote: r.reviewNote,
  createdByType: r.createdByType, createdById: r.createdById, createdAt: r.createdAt, updatedAt: r.updatedAt, submittedAt: r.submittedAt, publishedAt: r.publishedAt, publishedById: r.publishedById, archivedAt: r.archivedAt, deletedAt: r.deletedAt,
});

/** thrown inside the delete transaction to undo it */
class ChangedMeanwhile extends Error {}

@Injectable()
export class PrismaThemeMarketStore extends ThemeMarketStore {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) { super(); }

  async create(n: NewTheme, a: AuditSpec): Promise<ThemeRow | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { manifest, bytes, ...rest } = n;
        const created = await tx.v3ThemeMarketPackage.create({ data: { ...rest, manifestJson: manifest as Prisma.InputJsonValue, bytes: new Uint8Array(bytes) }, select: LITE });
        await this.audit.record(tx, a.actor, a.action, 'theme', created.id, a.before, a.after);
        return row(created);
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null;
      throw e;
    }
  }

  async find(id: string): Promise<ThemeRow | null> { const r = await this.prisma.v3ThemeMarketPackage.findFirst({ where: { id, deletedAt: null }, select: LITE }); return r ? row(r) : null; }
  async findWithBytes(id: string): Promise<ThemeRowWithBytes | null> { const r = await this.prisma.v3ThemeMarketPackage.findFirst({ where: { id, deletedAt: null } }); return r ? { ...row(r), bytes: Buffer.from(r.bytes) } : null; }
  async findByKeyVersion(key: string, version: number): Promise<ThemeRow | null> { const r = await this.prisma.v3ThemeMarketPackage.findUnique({ where: { key_version: { key, version } }, select: LITE }); return r ? row(r) : null; }
  async maxVersion(key: string): Promise<number> { const r = await this.prisma.v3ThemeMarketPackage.aggregate({ where: { key }, _max: { version: true } }); return r._max.version ?? 0; }

  private where(f: ThemeFilter): Prisma.V3ThemeMarketPackageWhereInput {
    return {
      deletedAt: null,
      ...(f.status ? { status: f.status } : {}), ...(f.visibility ? { visibility: f.visibility } : {}), ...(f.tier ? { tier: f.tier } : {}), ...(f.key ? { key: f.key } : {}), ...(f.privateVendorId ? { privateVendorId: f.privateVendorId } : {}),
      ...(f.pack ? { packs: { has: f.pack } } : {}), ...(f.addon ? { addons: { has: f.addon } } : {}), ...(f.capability ? { capabilities: { has: f.capability } } : {}), ...(f.tag ? { tags: { has: f.tag } } : {}), ...(f.category ? { catalogueCategories: { has: f.category } } : {}),
      ...(typeof f.starter === 'boolean' ? { starter: f.starter } : {}), ...(f.q ? { OR: [{ name: { contains: f.q, mode: 'insensitive' as const } }, { key: { contains: f.q.toLowerCase() } }] } : {}),
    };
  }

  async list(f: ThemeFilter, skip: number, take: number): Promise<{ items: ThemeRow[]; total: number }> {
    const where = this.where(f);
    const [items, total] = await Promise.all([this.prisma.v3ThemeMarketPackage.findMany({ where, orderBy: [{ name: 'asc' }, { key: 'asc' }, { version: 'desc' }], skip, take, select: LITE }), this.prisma.v3ThemeMarketPackage.count({ where })]);
    return { items: items.map(row), total };
  }

  async transition(id: string, from: readonly ThemeStatus[], patch: ThemePatch, a: AuditSpec, older?: { key: string; below: number }): Promise<ThemeRow | null> {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.v3ThemeMarketPackage.updateMany({ where: { id, status: { in: [...from] }, deletedAt: null }, data: patch as Prisma.V3ThemeMarketPackageUpdateManyMutationInput });
      if (r.count === 0) return null;
      // publishing a newer version of a key retires the older published versions of that key for new choices (vendors on the key simply get the newer version)
      if (older) {
        const retired = await tx.v3ThemeMarketPackage.findMany({ where: { key: older.key, status: 'PUBLISHED', version: { lt: older.below } }, select: { id: true } });
        if (retired.length) {
          await tx.v3ThemeMarketPackage.updateMany({ where: { id: { in: retired.map((x) => x.id) } }, data: { status: 'ARCHIVED', archivedAt: new Date() } });
          for (const x of retired) await this.audit.record(tx, a.actor, 'theme.archive', 'theme', x.id, { status: 'PUBLISHED' }, { status: 'ARCHIVED', reason: 'a newer version was published' });
        }
      }
      const updated = await tx.v3ThemeMarketPackage.findUniqueOrThrow({ where: { id }, select: LITE });
      await this.audit.record(tx, a.actor, a.action, 'theme', id, a.before, a.after);
      return row(updated);
    });
  }

  async keyUsedByVendor(key: string): Promise<boolean> { return this.usedIn(this.prisma, key); }

  /** Sites, publications, theme changes and bought years remember a theme by its key. Any row counts, an old or expired one too. */
  private async usedIn(db: Prisma.TransactionClient, key: string): Promise<boolean> {
    const found = await Promise.all([
      db.v3SiteSettings.findFirst({ where: { themeId: key }, select: { vendorId: true } }),
      db.v3SitePublication.findFirst({ where: { themeId: key }, select: { id: true } }),
      db.v3ThemeSwitch.findFirst({ where: { OR: [{ toThemeKey: key }, { fromThemeKey: key }] }, select: { id: true } }),
      db.themeEntitlement.findFirst({ where: { themeKey: key }, select: { id: true } }),
    ]);
    return found.some(Boolean);
  }

  async softDeleteTheme(key: string, ids: readonly string[], stamp: { deletedAt: Date; deletedById: string | null }, a: AuditSpec): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const r = await tx.v3ThemeMarketPackage.updateMany({
          where: { key, id: { in: [...ids] }, deletedAt: null, publishedAt: null, status: { not: 'PUBLISHED' }, privateVendorId: null, sourceVendorId: null },
          data: { ...stamp, bytes: new Uint8Array(0) },
        });
        // throwing rolls the whole delete back: a version changed or was added meanwhile, or a business took the theme
        if (r.count !== ids.length || (await tx.v3ThemeMarketPackage.count({ where: { key, deletedAt: null } })) > 0 || (await this.usedIn(tx, key))) throw new ChangedMeanwhile();
        await this.audit.record(tx, a.actor, a.action, 'theme', ids[ids.length - 1], a.before, a.after);
      });
      return true;
    } catch (e) {
      if (e instanceof ChangedMeanwhile) return false;
      throw e;
    }
  }

  async loadServable(): Promise<ThemeRowWithBytes[]> {
    const rows = await this.prisma.v3ThemeMarketPackage.findMany({ where: { status: { in: ['PUBLISHED', 'ARCHIVED'] }, deletedAt: null }, orderBy: [{ key: 'asc' }, { version: 'desc' }] });
    return rows.map((r) => ({ ...row(r), bytes: Buffer.from(r.bytes) }));
  }

  async servableMeta(): Promise<ThemeRow[]> {
    const rows = await this.prisma.v3ThemeMarketPackage.findMany({ where: { status: { in: ['PUBLISHED', 'ARCHIVED'] }, deletedAt: null }, orderBy: [{ key: 'asc' }, { version: 'desc' }], select: LITE, take: 2000 });
    return rows.map(row);
  }

  async vendorExists(vendorId: string): Promise<boolean> { return !!(await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } })); }

  async vendorFacts(vendorId: string): Promise<{ name: string; email: string | null; phone: string | null; subdomain: string | null; customDomain: string | null; mediaHashes: string[] } | null> {
    const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { businessName: true, email: true, phone: true, subdomain: true, customDomain: true } });
    if (!v) return null;
    const media = await this.prisma.v3Media.findMany({ where: { vendorId }, select: { sha256: true }, take: 5000 });
    return { name: v.businessName, email: v.email, phone: v.phone, subdomain: v.subdomain, customDomain: v.customDomain, mediaHashes: media.map((m) => m.sha256) };
  }
}
