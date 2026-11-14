import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { Stat } from '../core/sitemap';

/** A directory business as the page models need it. Read only. Private fields (email, owner) are not here at all. */
export interface ListedBusiness {
  id: string; slug: string; name: string; categoryId: string; locationId: string | null; pincode: string | null; descriptionText: string;
  status: 'CLAIMED' | 'UNCLAIMED' | 'SUSPENDED' | 'REMOVED' | 'DRAFT'; indexable: boolean; vendorId: string | null; claimed: boolean;
  address: { line1?: string; line2?: string; pin?: string; city?: string }; hours: Record<string, unknown>; geo: { lat: number; lng: number } | null; imageUrl: string | null; updatedAt: Date;
}
export interface Scope { locationIds?: string[]; categoryIds?: string[]; pincode?: string }
export interface FacetCounts { byLocation: Map<string, number>; byCategory: Map<string, number>; byPincode: Map<string, number> }

/**
 * The read port of the SEO page models (platform-level: it reads public directory rows and writes nothing). "Listed" = CLAIMED, UNCLAIMED or SUSPENDED (a suspended listing stays listed as
 * a listing only); DRAFT and REMOVED are never listed. A Prisma implementation and an in-memory twin (tests) implement it.
 */
export abstract class SeoDirectoryData {
  abstract businesses(scope: Scope, skip: number, take: number): Promise<{ items: ListedBusiness[]; total: number }>;
  abstract facets(scope: Scope): Promise<FacetCounts>;
  /** by slug, any status (a removed one answers 410) */
  abstract businessBySlug(slug: string): Promise<ListedBusiness | null>;
  /** sitemaps: the grouped counts of listed businesses (location, category, pincode) with the newest change in each group */
  abstract groupStats(): Promise<Stat[]>;
  /** sitemaps: business profiles that are indexable (CLAIMED or UNCLAIMED, flagged indexable), by slug */
  abstract indexableBusinesses(skip: number, take: number): Promise<Array<{ slug: string; updatedAt: Date }>>;
  abstract indexableBusinessMeta(): Promise<{ total: number; newest: Date | null }>;
  /** monitoring: vendor sites that are published and indexable, with their subdomain */
  abstract publishedIndexableSites(skip: number, take: number): Promise<{ items: Array<{ subdomain: string; publishedAt: Date | null }>; total: number }>;
}

const LISTED = ['CLAIMED', 'UNCLAIMED', 'SUSPENDED'] as const;
/** the same rule as the directory's own sitemap data: a suspended listing stays listed but is never put in a sitemap */
const INDEXABLE: Prisma.V3DirectoryBusinessWhereInput = { status: { in: ['CLAIMED', 'UNCLAIMED'] }, indexable: true };
const where = (s: Scope): Prisma.V3DirectoryBusinessWhereInput => ({ status: { in: [...LISTED] }, ...(s.locationIds ? { locationId: { in: s.locationIds } } : {}), ...(s.categoryIds ? { categoryId: { in: s.categoryIds } } : {}), ...(s.pincode ? { pincode: s.pincode } : {}) });
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

type Row = Prisma.V3DirectoryBusinessGetPayload<{ include: { media: true } }>;
function toListed(b: Row): ListedBusiness {
  const claimed = b.status === 'CLAIMED' || (b.status === 'SUSPENDED' && !!b.claimedAt);
  const geo = b.geoJson && typeof b.geoJson === 'object' && !Array.isArray(b.geoJson) ? (b.geoJson as { lat: number; lng: number }) : null;
  const first = [...b.media].sort((x, y) => x.sortOrder - y.sortOrder)[0];
  return {
    id: b.id, slug: b.slug, name: b.name, categoryId: b.categoryId, locationId: b.locationId, pincode: b.pincode, descriptionText: b.descriptionText, status: b.status, indexable: b.indexable, vendorId: b.vendorId, claimed,
    address: obj(b.addressJson) as ListedBusiness['address'], hours: obj(b.hoursJson), geo, imageUrl: claimed && first ? first.url : null, updatedAt: b.updatedAt,
  };
}

@Injectable()
export class PrismaSeoDirectoryData extends SeoDirectoryData {
  constructor(private readonly prisma: PrismaService) { super(); }

  async businesses(scope: Scope, skip: number, take: number) {
    const w = where(scope);
    const [rows, total] = await Promise.all([
      this.prisma.v3DirectoryBusiness.findMany({ where: w, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip, take, include: { media: { orderBy: { sortOrder: 'asc' }, take: 1 } } }),
      this.prisma.v3DirectoryBusiness.count({ where: w }),
    ]);
    return { items: rows.map(toListed), total };
  }

  async facets(scope: Scope): Promise<FacetCounts> {
    const w = where(scope);
    const [loc, cat, pin] = await Promise.all([
      this.prisma.v3DirectoryBusiness.groupBy({ by: ['locationId'], where: w, _count: { _all: true } }),
      this.prisma.v3DirectoryBusiness.groupBy({ by: ['categoryId'], where: w, _count: { _all: true } }),
      this.prisma.v3DirectoryBusiness.groupBy({ by: ['pincode'], where: { ...w, pincode: { not: null } }, _count: { _all: true } }),
    ]);
    return {
      byLocation: new Map(loc.filter((r) => r.locationId).map((r) => [r.locationId as string, r._count._all])),
      byCategory: new Map(cat.map((r) => [r.categoryId, r._count._all])),
      byPincode: new Map(pin.filter((r) => r.pincode).map((r) => [r.pincode as string, r._count._all])),
    };
  }

  async groupStats(): Promise<Stat[]> {
    const rows = await this.prisma.v3DirectoryBusiness.groupBy({ by: ['locationId', 'categoryId', 'pincode'], where: where({}), _count: { _all: true }, _max: { updatedAt: true } });
    return rows.map((r) => ({ locationId: r.locationId, categoryId: r.categoryId, pincode: r.pincode, count: r._count._all, lastmod: r._max.updatedAt ?? new Date(0) }));
  }

  async indexableBusinesses(skip: number, take: number) {
    return this.prisma.v3DirectoryBusiness.findMany({ where: INDEXABLE, orderBy: { slug: 'asc' }, skip, take, select: { slug: true, updatedAt: true } });
  }
  async indexableBusinessMeta() {
    const [total, newest] = await Promise.all([this.prisma.v3DirectoryBusiness.count({ where: INDEXABLE }), this.prisma.v3DirectoryBusiness.aggregate({ where: INDEXABLE, _max: { updatedAt: true } })]);
    return { total, newest: newest._max.updatedAt ?? null };
  }

  async publishedIndexableSites(skip: number, take: number) {
    const w: Prisma.V3SitePublicationWhereInput = { status: 'PUBLISHED', indexable: true, vendor: { subdomain: { not: null } } };
    const [rows, total] = await Promise.all([
      this.prisma.v3SitePublication.findMany({ where: w, orderBy: { vendor: { subdomain: 'asc' } }, skip, take, select: { publishedAt: true, vendor: { select: { subdomain: true } } } }),
      this.prisma.v3SitePublication.count({ where: w }),
    ]);
    return { items: rows.filter((r) => !!r.vendor.subdomain).map((r) => ({ subdomain: r.vendor.subdomain as string, publishedAt: r.publishedAt })), total };
  }

  async businessBySlug(slug: string): Promise<ListedBusiness | null> {
    const b = await this.prisma.v3DirectoryBusiness.findUnique({ where: { slug }, include: { media: { orderBy: { sortOrder: 'asc' }, take: 1 } } });
    return b ? toListed(b) : null;
  }
}
