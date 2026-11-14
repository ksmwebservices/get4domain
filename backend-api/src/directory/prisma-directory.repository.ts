import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RemovalStatus } from './core/removal';
import { toPrefixTsQuery } from './core/search';
import { PrismaService } from '../prisma/prisma.service';
import {
  BusinessPatch, BusinessRow, CategoryRow, ChallengeRow, DirectoryRepository, GrantRow, LocationKind, LocationRow, MediaRow, NewBusiness, OtpStatus, OverrideRow, PlacementRow, RemovalRow,
  SearchQuery, ServiceRow, StaffBusinessQuery,
} from './directory.repository';

type Biz = Prisma.V3DirectoryBusinessGetPayload<Record<string, never>>;
/** Owner rule 6: a suspension never hides a listing, so SUSPENDED is listed (as a Free listing-only site). Only REMOVED (and a draft) is out. */
const VISIBLE = ['CLAIMED', 'UNCLAIMED', 'SUSPENDED'] as const;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

const toBusiness = (b: Biz): BusinessRow => ({
  id: b.id, vendorId: b.vendorId, slug: b.slug, name: b.name, categoryId: b.categoryId, locationId: b.locationId, address: obj(b.addressJson) as BusinessRow['address'], phoneE164: b.phoneE164,
  emailMasked: b.emailMasked, hours: obj(b.hoursJson), geo: (b.geoJson && typeof b.geoJson === 'object' && !Array.isArray(b.geoJson) ? (b.geoJson as { lat: number; lng: number }) : null),
  descriptionText: b.descriptionText, status: b.status, indexable: b.indexable, source: b.source, claimedAt: b.claimedAt, removedAt: b.removedAt, createdAt: b.createdAt, updatedAt: b.updatedAt,
});
const toLocation = (l: { id: string; parentId: string | null; parentKey: string; kind: LocationKind; name: string; slug: string; sortOrder: number; proposed: boolean; active: boolean }): LocationRow => ({ ...l });
const toCategory = (c: { id: string; parentId: string | null; parentKey: string; name: string; slug: string; themeCategoryId: string | null; family: string | null; sortOrder: number; proposed: boolean; active: boolean }): CategoryRow => ({ ...c });

function patchData(p: BusinessPatch): Prisma.V3DirectoryBusinessUncheckedUpdateInput {
  const { address, hours, geo, ...rest } = p;
  return { ...rest, ...(address !== undefined ? { addressJson: address as Prisma.InputJsonValue } : {}), ...(hours !== undefined ? { hoursJson: hours as Prisma.InputJsonValue } : {}), ...(geo !== undefined ? { geoJson: geo === null ? Prisma.JsonNull : (geo as Prisma.InputJsonValue) } : {}) };
}

/** Postgres 23505, as Prisma reports it for a raw statement (P2010 with meta.code) or for a model call (P2002). */
function isUniqueViolation(e: unknown): boolean {
  const x = e as { code?: string; meta?: { code?: string }; message?: string } | null;
  return !!x && (x.code === 'P2002' || (x.code === 'P2010' && x.meta?.code === '23505') || /duplicate key value violates unique constraint/i.test(String(x.message ?? '')));
}

@Injectable()
export class PrismaDirectoryRepository extends DirectoryRepository {
  private trgm: { at: number; v: boolean } | null = null;
  constructor(private readonly prisma: PrismaService) { super(); }

  // tree
  async listLocations() { return (await this.prisma.v3DirectoryLocation.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })).map(toLocation); }
  async getLocation(id: string) { const l = await this.prisma.v3DirectoryLocation.findUnique({ where: { id } }); return l ? toLocation(l) : null; }
  async createLocation(d: { parentId: string | null; kind: LocationKind; name: string; slug: string; sortOrder: number }) { return toLocation(await this.prisma.v3DirectoryLocation.create({ data: { parentId: d.parentId, parentKey: d.parentId ?? 'ROOT', kind: d.kind, name: d.name, slug: d.slug, sortOrder: d.sortOrder } })); }
  async updateLocation(id: string, p: Partial<Pick<LocationRow, 'name' | 'slug' | 'sortOrder' | 'active' | 'proposed'>>) { return toLocation(await this.prisma.v3DirectoryLocation.update({ where: { id }, data: p })); }
  async listCategories() { return (await this.prisma.v3DirectoryCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })).map(toCategory); }
  async getCategory(id: string) { const c = await this.prisma.v3DirectoryCategory.findUnique({ where: { id } }); return c ? toCategory(c) : null; }
  async createCategory(d: { parentId: string | null; name: string; slug: string; themeCategoryId: string | null; family: string | null; sortOrder: number }) { return toCategory(await this.prisma.v3DirectoryCategory.create({ data: { parentId: d.parentId, parentKey: d.parentId ?? 'ROOT', name: d.name, slug: d.slug, themeCategoryId: d.themeCategoryId, family: d.family, sortOrder: d.sortOrder } })); }
  async updateCategory(id: string, p: Partial<Pick<CategoryRow, 'name' | 'slug' | 'sortOrder' | 'active' | 'proposed' | 'themeCategoryId' | 'family'>>) { return toCategory(await this.prisma.v3DirectoryCategory.update({ where: { id }, data: p })); }

  // businesses
  async getBusiness(id: string) { const b = await this.prisma.v3DirectoryBusiness.findUnique({ where: { id } }); return b ? toBusiness(b) : null; }
  async getBusinessBySlug(slug: string) { const b = await this.prisma.v3DirectoryBusiness.findUnique({ where: { slug } }); return b ? toBusiness(b) : null; }
  async getBusinessByVendor(vendorId: string) { const b = await this.prisma.v3DirectoryBusiness.findUnique({ where: { vendorId } }); return b ? toBusiness(b) : null; }
  async slugTaken(slug: string) { return (await this.prisma.v3DirectoryBusiness.count({ where: { slug } })) > 0; }
  async createBusiness(d: NewBusiness) {
    return toBusiness(await this.prisma.v3DirectoryBusiness.create({
      data: {
        vendorId: d.vendorId, slug: d.slug, name: d.name, categoryId: d.categoryId, locationId: d.locationId, addressJson: d.address as Prisma.InputJsonValue, phoneE164: d.phoneE164, emailMasked: d.emailMasked,
        hoursJson: d.hours as Prisma.InputJsonValue, ...(d.geo ? { geoJson: d.geo as Prisma.InputJsonValue } : {}), descriptionText: d.descriptionText, status: d.status, indexable: d.indexable, source: d.source, claimedAt: d.claimedAt ?? null,
      },
    }));
  }
  async updateBusiness(id: string, p: BusinessPatch) { return toBusiness(await this.prisma.v3DirectoryBusiness.update({ where: { id }, data: patchData(p) })); }
  async getServices(businessId: string): Promise<ServiceRow[]> { return this.prisma.v3DirectoryBusinessService.findMany({ where: { businessId }, orderBy: { sortOrder: 'asc' }, select: { id: true, businessId: true, name: true, description: true, sortOrder: true } }); }
  async getMedia(businessId: string): Promise<MediaRow[]> { return this.prisma.v3DirectoryBusinessMedia.findMany({ where: { businessId }, orderBy: { sortOrder: 'asc' }, select: { id: true, businessId: true, url: true, kind: true, altText: true, sortOrder: true } }); }
  async replaceServices(businessId: string, items: Array<{ name: string; description: string }>) {
    await this.prisma.$transaction([this.prisma.v3DirectoryBusinessService.deleteMany({ where: { businessId } }), this.prisma.v3DirectoryBusinessService.createMany({ data: items.map((s, i) => ({ businessId, name: s.name, description: s.description, sortOrder: i })) })]);
  }
  async replaceMedia(businessId: string, items: Array<{ url: string; altText: string; kind?: string }>) {
    await this.prisma.$transaction([this.prisma.v3DirectoryBusinessMedia.deleteMany({ where: { businessId } }), this.prisma.v3DirectoryBusinessMedia.createMany({ data: items.map((m, i) => ({ businessId, url: m.url, altText: m.altText, kind: m.kind ?? 'IMAGE', sortOrder: i })) })]);
  }

  private scopeWhere(s: { categoryIds?: string[]; locationIds?: string[] }): Prisma.V3DirectoryBusinessWhereInput {
    return { status: { in: [...VISIBLE] }, ...(s.categoryIds ? { categoryId: { in: s.categoryIds } } : {}), ...(s.locationIds ? { locationId: { in: s.locationIds } } : {}) };
  }

  /** pg_trgm present? Checked once a minute. When it is not, search uses full text only (see the migration header). */
  private async hasTrigram(): Promise<boolean> {
    if (this.trgm && Date.now() - this.trgm.at < 60_000) return this.trgm.v;
    const r = await this.prisma.$queryRaw<Array<{ ok: boolean }>>`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS ok`;
    this.trgm = { at: Date.now(), v: !!r[0]?.ok };
    return this.trgm.v;
  }

  async search(q: SearchQuery): Promise<{ items: BusinessRow[]; total: number }> {
    if (!q.tokens.length) {
      const where = this.scopeWhere(q);
      const [rows, total] = await Promise.all([this.prisma.v3DirectoryBusiness.findMany({ where, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: q.skip, take: q.take }), this.prisma.v3DirectoryBusiness.count({ where })]);
      return { items: rows.map(toBusiness), total };
    }
    const tsq = toPrefixTsQuery(q.tokens);
    const useTrgm = await this.hasTrigram();
    const conds: Prisma.Sql[] = [Prisma.sql`"status" IN ('CLAIMED', 'UNCLAIMED', 'SUSPENDED')`];
    if (q.categoryIds) conds.push(Prisma.sql`"categoryId" IN (${Prisma.join(q.categoryIds)})`);
    if (q.locationIds) conds.push(Prisma.sql`"locationId" IN (${Prisma.join(q.locationIds)})`);
    const match = useTrgm
      ? Prisma.sql`("searchVector" @@ to_tsquery('simple', ${tsq}) OR similarity("name", ${q.text}) > 0.3)`
      : Prisma.sql`"searchVector" @@ to_tsquery('simple', ${tsq})`;
    const rank = useTrgm ? Prisma.sql`(ts_rank("searchVector", to_tsquery('simple', ${tsq})) * 2 + similarity("name", ${q.text}))` : Prisma.sql`ts_rank("searchVector", to_tsquery('simple', ${tsq}))`;
    const where = Prisma.join([...conds, match], ' AND ');
    const [ids, count] = await Promise.all([
      this.prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "g4d_directory_businesses" WHERE ${where} ORDER BY ${rank} DESC, "name" ASC, "id" ASC LIMIT ${q.take} OFFSET ${q.skip}`,
      this.prisma.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*) AS n FROM "g4d_directory_businesses" WHERE ${where}`,
    ]);
    const rows = await this.prisma.v3DirectoryBusiness.findMany({ where: { id: { in: ids.map((i) => i.id) } } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return { items: ids.map((i) => byId.get(i.id)).filter((r): r is Biz => !!r).map(toBusiness), total: Number(count[0]?.n ?? 0) };
  }

  countPublic(scope: { categoryIds?: string[]; locationIds?: string[] }) { return this.prisma.v3DirectoryBusiness.count({ where: this.scopeWhere(scope) }); }

  async sitemapPage(skip: number, take: number) {
    const where: Prisma.V3DirectoryBusinessWhereInput = { status: { in: ['CLAIMED', 'UNCLAIMED'] }, indexable: true };   // a suspended listing stays listed but is never put in the sitemap
    const [rows, total] = await Promise.all([this.prisma.v3DirectoryBusiness.findMany({ where, orderBy: { slug: 'asc' }, skip, take, select: { slug: true, updatedAt: true } }), this.prisma.v3DirectoryBusiness.count({ where })]);
    return { items: rows, total };
  }

  async listForStaff(q: StaffBusinessQuery) {
    const where: Prisma.V3DirectoryBusinessWhereInput = { ...(q.status ? { status: q.status } : {}), ...(q.categoryId ? { categoryId: q.categoryId } : {}), ...(q.locationId ? { locationId: q.locationId } : {}), ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}) };
    const [rows, total] = await Promise.all([this.prisma.v3DirectoryBusiness.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: q.skip, take: q.take }), this.prisma.v3DirectoryBusiness.count({ where })]);
    return { items: rows.map(toBusiness), total };
  }

  // placements
  private toPlacement(p: { id: string; businessId: string; kind: 'SPONSORED'; startsAt: Date; endsAt: Date; label: string; createdByStaffId: string | null; revokedAt: Date | null; createdAt: Date }): PlacementRow { return { ...p }; }
  async createPlacement(d: { businessId: string; startsAt: Date; endsAt: Date; label: string; createdByStaffId: string | null }) { return this.toPlacement(await this.prisma.v3DirectoryPlacement.create({ data: { ...d, kind: 'SPONSORED' } })); }
  async getPlacement(id: string) { const p = await this.prisma.v3DirectoryPlacement.findUnique({ where: { id } }); return p ? this.toPlacement(p) : null; }
  async listPlacements(businessId: string) { return (await this.prisma.v3DirectoryPlacement.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } })).map((p) => this.toPlacement(p)); }
  async revokePlacement(id: string, now: Date) { return (await this.prisma.v3DirectoryPlacement.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } })).count === 1; }
  async activePlacements(now: Date, scope: { categoryIds?: string[]; locationIds?: string[] }, limit: number) {
    const rows = await this.prisma.v3DirectoryPlacement.findMany({ where: { revokedAt: null, startsAt: { lte: now }, endsAt: { gt: now }, business: this.scopeWhere(scope) }, include: { business: true }, orderBy: [{ startsAt: 'asc' }, { id: 'asc' }], take: limit });
    return rows.map((r) => ({ placement: this.toPlacement(r), business: toBusiness(r.business) }));
  }

  // OTP
  private toChallenge(c: { id: string; subjectType: string; subjectId: string; channel: 'SMS' | 'EMAIL'; phoneHash: string; codeHash: string; salt: string; attempts: number; maxAttempts: number; expiresAt: Date; usedAt: Date | null; requestIpHash: string | null; status: OtpStatus; sandboxBody: string | null; createdAt: Date }): ChallengeRow { return { ...c }; }
  async createChallenge(d: Omit<ChallengeRow, 'id' | 'createdAt' | 'attempts' | 'usedAt' | 'status'>) { return this.toChallenge(await this.prisma.v3OtpChallenge.create({ data: { ...d } })); }
  async latestChallenge(subjectType: string, subjectId: string) { const c = await this.prisma.v3OtpChallenge.findFirst({ where: { subjectType, subjectId }, orderBy: { createdAt: 'desc' } }); return c ? this.toChallenge(c) : null; }
  async countChallengesSince(by: { phoneHash?: string; ipHash?: string }, since: Date) {
    const or: Prisma.V3OtpChallengeWhereInput[] = [...(by.phoneHash ? [{ phoneHash: by.phoneHash }] : []), ...(by.ipHash ? [{ requestIpHash: by.ipHash }] : [])];
    return or.length ? this.prisma.v3OtpChallenge.count({ where: { createdAt: { gte: since }, OR: or } }) : 0;
  }
  async applyAttempt(id: string, expectedAttempts: number, next: { attempts: number; status: OtpStatus; usedAt: Date | null }) {
    return (await this.prisma.v3OtpChallenge.updateMany({ where: { id, attempts: expectedAttempts, status: 'PENDING' }, data: { attempts: next.attempts, status: next.status, usedAt: next.usedAt } })).count === 1;
  }
  async revokePendingChallenges(subjectType: string, subjectId: string) { await this.prisma.v3OtpChallenge.updateMany({ where: { subjectType, subjectId, status: 'PENDING' }, data: { status: 'REVOKED' } }); }

  // claim helpers
  async latestOverride(businessId: string): Promise<OverrideRow | null> { return this.prisma.v3DirectoryClaimOverride.findFirst({ where: { businessId, revokedAt: null }, orderBy: { createdAt: 'desc' } }); }
  async addOverride(d: { businessId: string; phoneE164: string; phoneHash: string; reason: string; approvedByStaffId: string }): Promise<OverrideRow> { return this.prisma.v3DirectoryClaimOverride.create({ data: d }); }
  async vendorBasics(vendorId: string) { const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, name: true, phone: true, email: true } }); return v ? { id: v.id, name: v.name, phone: v.phone ?? null, email: v.email } : null; }
  async hasPublishedSite(vendorId: string): Promise<boolean> { return (await this.prisma.v3SitePublication.count({ where: { vendorId, currentVendorId: vendorId } })) > 0; }
  async createGrant(d: { vendorId: string; tokenHash: string; expiresAt: Date }): Promise<GrantRow> { return this.prisma.v3AccountSetupGrant.create({ data: d }); }
  async findGrantByHash(tokenHash: string): Promise<GrantRow | null> { return this.prisma.v3AccountSetupGrant.findUnique({ where: { tokenHash } }); }
  async consumeGrant(id: string, now: Date) { return (await this.prisma.v3AccountSetupGrant.updateMany({ where: { id, status: 'ACTIVE', expiresAt: { gt: now } }, data: { status: 'USED', usedAt: now } })).count === 1; }

  // removal
  async createRemoval(d: { businessId: string; tokenHash: string; reason: string | null; requesterContactMasked: string | null; expiresAt: Date }): Promise<RemovalRow> { return this.prisma.v3DirectoryRemovalRequest.create({ data: d }); }
  async findRemovalByHash(tokenHash: string): Promise<RemovalRow | null> { return this.prisma.v3DirectoryRemovalRequest.findUnique({ where: { tokenHash } }); }
  async getRemoval(id: string): Promise<RemovalRow | null> { return this.prisma.v3DirectoryRemovalRequest.findUnique({ where: { id } }); }
  async listRemovals(q: { status?: RemovalStatus; skip: number; take: number }) {
    const where: Prisma.V3DirectoryRemovalRequestWhereInput = q.status ? { status: q.status } : {};
    const [items, total] = await Promise.all([this.prisma.v3DirectoryRemovalRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.take }), this.prisma.v3DirectoryRemovalRequest.count({ where })]);
    return { items, total };
  }
  async confirmRemoval(id: string, now: Date) { return (await this.prisma.v3DirectoryRemovalRequest.updateMany({ where: { id, status: 'REQUESTED', confirmedAt: null }, data: { confirmedAt: now } })).count === 1; }
  async moveRemoval(id: string, from: RemovalStatus, to: RemovalStatus, patch: { handledByStaffId?: string | null; handledAt?: Date; executedAt?: Date; reason?: string | null }) {
    return (await this.prisma.v3DirectoryRemovalRequest.updateMany({ where: { id, status: from }, data: { status: to, ...patch } })).count === 1;
  }
  async countRecentRemovals(businessId: string, since: Date) { return this.prisma.v3DirectoryRemovalRequest.count({ where: { businessId, createdAt: { gte: since } } }); }

  // ── visits (slice 5.7b) ──
  async incrementVisit(businessId: string, day: string, fromSearch: boolean): Promise<void> {
    const s = fromSearch ? 1 : 0;
    // One atomic statement: no read-then-write, so parallel visits never lose a count. ON CONFLICT names ONE arbiter, ("businessId","day"); Postgres only arbitrates that index. The id is therefore
    // random: a deterministic id would make the primary key a SECOND unique index that the same row can violate, and a request that loses the race for the first row of the day would fail with
    // a unique violation instead of taking the update path (seen on staging as 39 counted of 40). One retry covers any other racing insert; the second attempt always finds the row.
    for (let attempt = 0; ; attempt++) {
      try {
        await this.prisma.$executeRaw`INSERT INTO "g4d_directory_visit_daily" ("id", "businessId", "day", "count", "searchCount", "createdAt", "updatedAt")
          VALUES (${`vd_${randomUUID()}`}, ${businessId}, ${day}, 1, ${s}, NOW(), NOW())
          ON CONFLICT ("businessId", "day") DO UPDATE SET "count" = "g4d_directory_visit_daily"."count" + 1, "searchCount" = "g4d_directory_visit_daily"."searchCount" + ${s}, "updatedAt" = NOW()`;
        return;
      } catch (e) {
        if (attempt >= 1 || !isUniqueViolation(e)) throw e;
      }
    }
  }
  async visitDays(businessId: string, fromDay: string, toDay: string) {
    return this.prisma.v3DirectoryVisitDaily.findMany({ where: { businessId, day: { gte: fromDay, lte: toDay } }, orderBy: { day: 'asc' }, select: { day: true, count: true, searchCount: true } });
  }
  async visitTotals(fromDay: string, toDay: string, o: { vendorId?: string; skip: number; take: number }) {
    const where: Prisma.V3DirectoryVisitDailyWhereInput = { day: { gte: fromDay, lte: toDay }, ...(o.vendorId ? { business: { vendorId: o.vendorId } } : {}) };
    const groups = await this.prisma.v3DirectoryVisitDaily.groupBy({ by: ['businessId'], where, _sum: { count: true, searchCount: true }, orderBy: { _sum: { count: 'desc' } }, skip: o.skip, take: o.take });
    const total = (await this.prisma.v3DirectoryVisitDaily.groupBy({ by: ['businessId'], where })).length;
    const biz = await this.prisma.v3DirectoryBusiness.findMany({ where: { id: { in: groups.map((g) => g.businessId) } }, select: { id: true, slug: true, name: true } });
    const by = new Map(biz.map((b) => [b.id, b]));
    return { items: groups.map((g) => ({ businessId: g.businessId, slug: by.get(g.businessId)?.slug ?? '', name: by.get(g.businessId)?.name ?? '', count: g._sum.count ?? 0, searchCount: g._sum.searchCount ?? 0 })), total };
  }
  async createVisitRef(d: { refHash: string; businessId: string; expiresAt: Date }) { await this.prisma.v3DirectoryVisitRef.create({ data: d }); }
  async consumeVisitRef(refHash: string, businessId: string, now: Date) {
    return (await this.prisma.v3DirectoryVisitRef.updateMany({ where: { refHash, businessId, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })).count === 1;
  }
  async siteFacts(vendorIds: string[], now: Date) {
    const out = new Map<string, { subdomain: string | null; proActive: boolean }>();
    if (!vendorIds.length) return out;
    const [vendors, subs] = await Promise.all([
      this.prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, subdomain: true } }),
      this.prisma.v3PlanSubscription.findMany({ where: { currentVendorId: { in: vendorIds }, plan: { level: 'PRO' } }, select: { currentVendorId: true, endsAt: true } }),
    ]);
    const pro = new Set(subs.filter((s) => s.endsAt === null || s.endsAt.getTime() > now.getTime()).map((s) => s.currentVendorId));
    for (const v of vendors) out.set(v.id, { subdomain: v.subdomain ?? null, proActive: pro.has(v.id) });
    return out;
  }
}
