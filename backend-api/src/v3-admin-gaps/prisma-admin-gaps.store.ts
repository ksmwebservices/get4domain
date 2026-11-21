import { Injectable } from '@nestjs/common';
import { Prisma, VendorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListingStateWord, listingStateWhere, VendorFilter } from './core/admin-gaps-core';
import { AdminGapsStore, AdminVendorRow, NoteRow } from './admin-gaps.store';

/** The listing state words, from the stored lifecycle and whether a site is published now (the same rule as listingStateOf in the seeded core). */
function stateOf(lifecycle: string, published: boolean): ListingStateWord {
  if (lifecycle === 'REMOVED') return 'REMOVED';
  if (lifecycle === 'PRO') return 'LIVE';
  if (lifecycle === 'CLAIMED_FREE') return published ? 'LIVE' : 'CLAIMED';
  return published ? 'UNCLAIMED_LISTING' : 'DRAFT_SITE';
}

@Injectable()
export class PrismaAdminGapsStore extends AdminGapsStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async listVendors(f: VendorFilter): Promise<{ items: AdminVendorRow[]; total: number }> {
    const and: Prisma.VendorWhereInput[] = [{ isSandbox: false, role: 'VENDOR' }];
    if (f.q) and.push({ OR: [{ name: { contains: f.q, mode: 'insensitive' } }, { businessName: { contains: f.q, mode: 'insensitive' } }, { email: { contains: f.q, mode: 'insensitive' } }, { phone: { contains: f.q } }, { subdomain: { contains: f.q.toLowerCase() } }] });
    if (f.status) and.push({ status: f.status as VendorStatus });
    if (f.industry) and.push({ industry: f.industry });
    if (f.planLevel || f.planKey) and.push({ v3Subscriptions: { some: { currentVendorId: { not: null }, plan: { ...(f.planLevel ? { level: f.planLevel } : {}), ...(f.planKey ? { key: f.planKey } : {}) } } } });
    if (f.listingState) {
      const w = listingStateWhere(f.listingState);
      and.push({ v3SeededSite: { is: { lifecycle: { in: w.lifecycle as Prisma.EnumV3SeededLifecycleFilter['in'] } } } });
      if (w.published !== null) and.push(w.published ? { v3SitePublications: { some: { currentVendorId: { not: null } } } } : { v3SitePublications: { none: { currentVendorId: { not: null } } } });
    }
    const where: Prisma.VendorWhereInput = { AND: and };
    const [rows, total] = await Promise.all([
      this.prisma.vendor.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: f.skip, take: f.take, select: { id: true, name: true, businessName: true, email: true, phone: true, industry: true, status: true, subdomain: true, createdAt: true } }),
      this.prisma.vendor.count({ where }),
    ]);
    const ids = rows.map((r) => r.id);
    const [subs, seeded, live] = ids.length === 0 ? [[], [], []] : await Promise.all([
      this.prisma.v3PlanSubscription.findMany({ where: { vendorId: { in: ids }, currentVendorId: { not: null } }, select: { vendorId: true, status: true, plan: { select: { key: true, name: true, level: true, track: true } } } }),
      this.prisma.v3SeededSite.findMany({ where: { vendorId: { in: ids } }, select: { vendorId: true, lifecycle: true } }),
      this.prisma.v3SitePublication.findMany({ where: { vendorId: { in: ids }, currentVendorId: { not: null } }, select: { vendorId: true } }),
    ]);
    const subBy = new Map(subs.map((s) => [s.vendorId, s])); const seedBy = new Map(seeded.map((s) => [s.vendorId, s.lifecycle as string])); const liveSet = new Set(live.map((l) => l.vendorId));
    return {
      total,
      items: rows.map((r) => {
        const s = subBy.get(r.id); const lc = seedBy.get(r.id);
        return { ...r, plan: s ? { key: s.plan.key, name: s.plan.name, level: s.plan.level, track: s.plan.track, status: s.status } : null, listingState: lc ? stateOf(lc, liveSet.has(r.id)) : null };
      }),
    };
  }

  async vendorExists(vendorId: string): Promise<boolean> { return (await this.prisma.vendor.count({ where: { id: vendorId } })) > 0; }
  async heldCount(vendorId: string): Promise<number> { return this.prisma.v3InboxMessage.count({ where: { vendorId, state: 'HELD' } }); }

  async listNotes(vendorId: string, skip: number, take: number): Promise<{ items: NoteRow[]; total: number }> {
    const [items, total] = await Promise.all([this.prisma.v3VendorNote.findMany({ where: { vendorId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }), this.prisma.v3VendorNote.count({ where: { vendorId } })]);
    return { items, total };
  }
  async addNote(vendorId: string, body: string, by: { id: string | null; name: string }): Promise<NoteRow> {
    return this.prisma.v3VendorNote.create({ data: { vendorId, body, byStaffId: by.id, byName: by.name.slice(0, 120) } });
  }
  async staffName(staffId: string): Promise<string | null> {
    const m = await this.prisma.adminTeamMember.findUnique({ where: { id: staffId }, select: { name: true } });
    if (m) return m.name;
    const v = await this.prisma.vendor.findUnique({ where: { id: staffId }, select: { name: true } });
    return v?.name ?? null;
  }
}
