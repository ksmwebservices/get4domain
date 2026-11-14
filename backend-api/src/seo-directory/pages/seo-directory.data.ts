import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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
}

const LISTED = ['CLAIMED', 'UNCLAIMED', 'SUSPENDED'] as const;
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

  async businessBySlug(slug: string): Promise<ListedBusiness | null> {
    const b = await this.prisma.v3DirectoryBusiness.findUnique({ where: { slug }, include: { media: { orderBy: { sortOrder: 'asc' }, take: 1 } } });
    return b ? toListed(b) : null;
  }
}
