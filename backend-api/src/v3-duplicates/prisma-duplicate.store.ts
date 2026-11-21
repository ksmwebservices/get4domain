import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NameCandidate, normaliseArea, normaliseBusinessName, trigramSimilarity } from './core/duplicate-core';
import { DuplicateStore, Hit, HostHit, NameQuery, OverrideRecord, PublicListing, ReviewRow, VendorBasics } from './duplicate.store';

// A demo sandbox is a throwaway tour account (isSandbox with an expiry) and never counts; a pre-sale prospect (isSandbox, no expiry) is a real business and does. Every query below says so.
const NAME_FLOOR = 0.4;   // the lowest similarity that can ever matter (the medium rule with support); the core decides the rest
const TAKE = 50;

interface ListingRow { id: string; vendorId: string | null; status: string; pincode: string | null; line1: string | null; line2: string | null; name: string; cat: string; kit: string | null; owner: string | null; sim: number | null }
interface VendorRow { id: string; owner: string; businessName: string; industry: string | null; address: string | null; sim: number | null }

@Injectable()
export class PrismaDuplicateStore extends DuplicateStore {
  private trgm: boolean | null = null;
  constructor(private readonly prisma: PrismaService) { super(); }

  /** pg_trgm is optional (the migration creates it in a guarded block); asked once. */
  private async hasTrigram(): Promise<boolean> {
    if (this.trgm === null) { const r = await this.prisma.$queryRaw<Array<{ ok: boolean }>>`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS ok`; this.trgm = r[0]?.ok === true; }
    return this.trgm;
  }

  async vendorsByEmail(email: string, ex: string | null): Promise<string[]> {
    const rows = await this.prisma.vendor.findMany({ where: { email: { equals: email, mode: 'insensitive' }, ...(ex ? { id: { not: ex } } : {}), OR: [{ isSandbox: false }, { expiresAt: null }] }, select: { id: true }, take: TAKE });
    return rows.map((r) => r.id);
  }

  async byPhone(key: string, e164: string | null, ex: string | null): Promise<Hit[]> {
    const out: Hit[] = [];
    const vendors = await this.prisma.vendor.findMany({
      where: {
        ...(ex ? { id: { not: ex } } : {}), OR: [{ isSandbox: false }, { expiresAt: null }],
        // a row with a key is found by the index; a row written before the backfill (or by an older release) has none, so it is found by the last six digits and compared the long way
        AND: [{ OR: [{ phoneKey: key }, { phoneKey: null, phone: { contains: key.slice(-6) } }] }],
      },
      select: { id: true, phone: true, phoneKey: true }, take: TAKE,
    });
    for (const v of vendors) if (v.phoneKey === key || (v.phoneKey === null && (v.phone ?? '').replace(/\D/g, '').slice(-10) === key)) out.push({ vendorId: v.id, businessId: null, attachable: false });
    if (e164) {
      const listings = await this.prisma.v3DirectoryBusiness.findMany({ where: { phoneE164: e164, status: { not: 'REMOVED' }, ...(ex ? { OR: [{ vendorId: null }, { vendorId: { not: ex } }] } : {}) }, select: { id: true, vendorId: true, status: true }, take: TAKE });
      for (const l of listings) out.push({ vendorId: l.vendorId, businessId: l.id, attachable: l.vendorId === null && l.status === 'UNCLAIMED' });
    }
    return out;
  }

  async vendorsByGstin(gstin: string, ex: string | null): Promise<string[]> {
    const rows = await this.prisma.v3VendorTaxProfile.findMany({ where: { gstin: { equals: gstin, mode: 'insensitive' }, ...(ex ? { vendorId: { not: ex } } : {}) }, select: { vendorId: true }, take: TAKE });
    return rows.map((r) => r.vendorId);
  }

  async byHosts(hosts: string[], ex: string | null): Promise<HostHit[]> {
    const out: HostHit[] = [];
    const doms = await this.prisma.v3Domain.findMany({ where: { hostname: { in: hosts }, removedAt: null, ...(ex ? { vendorId: { not: ex } } : {}) }, select: { vendorId: true }, take: TAKE });
    for (const d of doms) out.push({ vendorId: d.vendorId, via: 'WEBSITE' });
    const withWww = hosts.flatMap((h) => [h, `www.${h}`]);
    const vs = await this.prisma.vendor.findMany({ where: { customDomain: { in: withWww, mode: 'insensitive' }, ...(ex ? { id: { not: ex } } : {}) }, select: { id: true }, take: TAKE });
    for (const v of vs) out.push({ vendorId: v.id, via: 'CUSTOM_DOMAIN' });
    return out;
  }

  async nameCandidates(q: NameQuery): Promise<NameCandidate[]> {
    const trgm = await this.hasTrigram();
    const area = normaliseArea(q.area); const wantCat = q.category ?? '';
    const ownerKey = normaliseBusinessName(q.ownerName ?? '');
    const out: NameCandidate[] = [];

    // 1. directory listings (they carry the pincode, the area and the category); a vendor with a listing is judged here, once
    const near = trgm
      ? Prisma.sql`b."name" % ${q.name}`   // uses the existing GIN trigram index
      : Prisma.sql`(${q.pincode ? Prisma.sql`b."pincode" = ${q.pincode}` : Prisma.sql`FALSE`} OR ${area ? Prisma.sql`lower(b."addressJson"->>'line2') = ${area}` : Prisma.sql`FALSE`})`;
    const listings = await this.prisma.$queryRaw<ListingRow[]>`
      SELECT b."id", b."vendorId", b."status"::text AS "status", b."pincode", b."addressJson"->>'line1' AS "line1", b."addressJson"->>'line2' AS "line2", b."name",
             c."slug" AS "cat", c."themeCategoryId" AS "kit", v."name" AS "owner", ${trgm ? Prisma.sql`similarity(b."name", ${q.name})` : Prisma.sql`NULL::float8`} AS "sim"
      FROM "g4d_directory_businesses" b
      JOIN "g4d_directory_categories" c ON c."id" = b."categoryId"
      LEFT JOIN "Vendor" v ON v."id" = b."vendorId"
      WHERE b."status" <> 'REMOVED' AND ${near} ${q.excludeVendorId ? Prisma.sql`AND (b."vendorId" IS NULL OR b."vendorId" <> ${q.excludeVendorId})` : Prisma.empty}
        AND (v."id" IS NULL OR v."isSandbox" = false OR v."expiresAt" IS NULL)
      ORDER BY 1 LIMIT ${TAKE}`;
    for (const l of listings) {
      const sim = l.sim ?? trigramSimilarity(normaliseBusinessName(l.name), normaliseBusinessName(q.name));
      if (sim < NAME_FLOOR) continue;
      out.push({
        vendorId: l.vendorId, businessId: l.id, attachable: l.vendorId === null && l.status === 'UNCLAIMED', similarity: sim,
        locationMatch: (!!q.pincode && l.pincode === q.pincode) || (!!area && normaliseArea(l.line2) === area),
        categoryMatch: wantCat !== '' && (l.cat === wantCat || l.kit === wantCat),
        ownerMatch: !!ownerKey && !!l.owner && normaliseBusinessName(l.owner) === ownerKey,
        addressMatch: !!q.address && !!l.line1 && trigramSimilarity(l.line1, q.address) >= 0.5,
      });
    }

    // 2. vendors that have NO listing: judged on the address the vendor typed (VendorCMS) and the industry
    const vNear = trgm ? Prisma.sql`v."businessName" % ${q.name}` : Prisma.sql`(${q.pincode ? Prisma.sql`cms."address" LIKE ${`%${q.pincode}%`}` : Prisma.sql`FALSE`} OR ${area ? Prisma.sql`lower(cms."address") LIKE ${`%${area}%`}` : Prisma.sql`FALSE`})`;
    const vendors = await this.prisma.$queryRaw<VendorRow[]>`
      SELECT v."id", v."name" AS "owner", v."businessName", v."industry", cms."address", ${trgm ? Prisma.sql`similarity(v."businessName", ${q.name})` : Prisma.sql`NULL::float8`} AS "sim"
      FROM "Vendor" v
      LEFT JOIN "VendorCMS" cms ON cms."vendorId" = v."id"
      WHERE (v."isSandbox" = false OR v."expiresAt" IS NULL) AND ${vNear} ${q.excludeVendorId ? Prisma.sql`AND v."id" <> ${q.excludeVendorId}` : Prisma.empty}
        AND NOT EXISTS (SELECT 1 FROM "g4d_directory_businesses" d WHERE d."vendorId" = v."id")
      ORDER BY 1 LIMIT ${TAKE}`;
    for (const v of vendors) {
      const sim = v.sim ?? trigramSimilarity(normaliseBusinessName(v.businessName), normaliseBusinessName(q.name));
      if (sim < NAME_FLOOR) continue;
      const addr = (v.address ?? '').toLowerCase();
      out.push({
        vendorId: v.id, businessId: null, attachable: false, similarity: sim,
        locationMatch: (!!q.pincode && addr.includes(q.pincode)) || (!!area && normaliseArea(addr).includes(area)),
        categoryMatch: wantCat !== '' && (v.industry ?? '') === wantCat,
        ownerMatch: !!ownerKey && normaliseBusinessName(v.owner) === ownerKey,
        addressMatch: !!q.address && addr !== '' && trigramSimilarity(addr, q.address) >= 0.5,
      });
    }
    return out;
  }

  async subdomainsNear(slug: string): Promise<string[]> {
    const trgm = await this.hasTrigram();
    // a look-alike changes one letter, so it still shares one half of the name: the fallback looks for either half. The look-alike rule itself is applied by the caller (similarSubdomain).
    const half = Math.max(3, Math.ceil(slug.length / 2));
    const rows = trgm
      ? await this.prisma.$queryRaw<Array<{ subdomain: string }>>`SELECT "subdomain" FROM "Vendor" WHERE "subdomain" IS NOT NULL AND similarity("subdomain", ${slug}) > 0.3 ORDER BY similarity("subdomain", ${slug}) DESC LIMIT 50`
      : await this.prisma.vendor.findMany({ where: { OR: [{ subdomain: { contains: slug.slice(0, half) } }, { subdomain: { contains: slug.slice(-half) } }] }, select: { subdomain: true }, take: 200 });
    return rows.flatMap((r) => (r.subdomain ? [r.subdomain] : []));
  }

  async publicListings(businessIds: string[], vendorIds: string[]): Promise<PublicListing[]> {
    if (businessIds.length === 0 && vendorIds.length === 0) return [];
    const rows = await this.prisma.v3DirectoryBusiness.findMany({
      where: { status: { in: ['CLAIMED', 'UNCLAIMED'] }, OR: [...(businessIds.length ? [{ id: { in: businessIds } }] : []), ...(vendorIds.length ? [{ vendorId: { in: vendorIds } }] : [])] },
      select: { id: true, slug: true, name: true, status: true, addressJson: true, category: { select: { name: true } } }, take: 10,
    });
    return rows.map((r) => {
      const a = (r.addressJson ?? {}) as { city?: string; line2?: string };
      return { businessId: r.id, slug: r.slug, name: r.name, category: r.category.name, city: a.city ?? null, area: a.line2 ?? null, claimable: r.status === 'UNCLAIMED' };
    });
  }

  async vendorBasics(vendorIds: string[]): Promise<VendorBasics[]> {
    if (vendorIds.length === 0) return [];
    return this.prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, businessName: true, subdomain: true, industry: true, createdAt: true }, take: 200 });
  }

  async recordOverride(o: OverrideRecord): Promise<{ id: string }> {
    const first = o.matches[0];
    return this.prisma.v3DuplicateOverride.create({
      data: { path: o.path, staffId: o.staffId, staffRole: o.staffRole, reason: o.reason, outcome: o.outcome, matchedVendorId: first?.vendorId ?? null, matchedBusinessId: first?.businessId ?? null, matchedSignals: [...new Set(o.matches.map((m) => m.signal))], newVendorId: o.newVendorId },
      select: { id: true },
    });
  }

  async isHeld(vendorId: string): Promise<boolean> {
    return (await this.prisma.v3DuplicateReview.count({ where: { vendorId, status: { not: 'CLEARED' } } })) > 0;
  }

  async listReviews(status: string | null, skip: number, take: number): Promise<{ items: ReviewRow[]; total: number }> {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([this.prisma.v3DuplicateReview.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }), this.prisma.v3DuplicateReview.count({ where })]);
    return { items, total };
  }

  getReview(id: string): Promise<ReviewRow | null> { return this.prisma.v3DuplicateReview.findUnique({ where: { id } }); }

  async decideReview(id: string, d: { status: 'CLEARED' | 'REJECTED'; staffId: string; reason: string; now: Date }): Promise<boolean> {
    // the decision and its audit row are one transaction: a decision is never unlogged (B3.2)
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.v3DuplicateReview.updateMany({ where: { id, status: 'PENDING' }, data: { status: d.status, decidedByStaffId: d.staffId, decisionReason: d.reason, decidedAt: d.now } });
      if (r.count !== 1) return false;
      await tx.v3AuditLog.create({ data: { actorType: 'STAFF', actorId: d.staffId, action: d.status === 'CLEARED' ? 'duplicate.review.clear' : 'duplicate.review.reject', entityType: 'duplicate_review', entityId: id, beforeJson: { status: 'PENDING' }, afterJson: { status: d.status, reason: d.reason }, ip: null } });
      return true;
    });
  }
}
