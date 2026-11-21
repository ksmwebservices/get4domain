import { Injectable } from '@nestjs/common';
import { KeyedQueue } from '../common/keyed-queue';
import { AuditService } from '../plans/admin/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CanonicalStore, CanonicalSwitchRecord } from './canonical.store';

/** Prisma implementation. The per-vendor wait is in the KeyedQueue BEFORE the transaction opens (batch rule c). Pages are never touched here. */
@Injectable()
export class PrismaCanonicalStore extends CanonicalStore {
  private readonly queue = new KeyedQueue();
  constructor(private readonly prisma: PrismaService, private readonly audits: AuditService) { super(); }

  async storedCanonical(vendorId: string): Promise<string | null> {
    return (await this.prisma.v3SiteSettings.findUnique({ where: { vendorId }, select: { canonicalHost: true } }))?.canonicalHost ?? null;
  }

  async recordBaseline(vendorId: string, host: string): Promise<void> {
    await this.prisma.v3SiteSettings.upsert({ where: { vendorId }, create: { vendorId, canonicalHost: host }, update: { canonicalHost: host } });
  }

  async recordSwitch(r: CanonicalSwitchRecord): Promise<void> {
    await this.queue.run(`canonical:${r.vendorId}`, () => this.prisma.$transaction(async (tx) => {
      await tx.v3SiteSettings.upsert({ where: { vendorId: r.vendorId }, create: { vendorId: r.vendorId, canonicalHost: r.to }, update: { canonicalHost: r.to } });
      await tx.v3SiteEvent.create({ data: { vendorId: r.vendorId, type: 'CANONICAL_SWITCHED', actorType: r.actor.type, actorId: r.actor.id, detailJson: { before: r.from, after: r.to, reason: r.reason } } });
      await this.audits.record(tx, r.actor, 'site.canonical.switch', 'site', r.vendorId, { canonicalHost: r.from }, { canonicalHost: r.to, reason: r.reason });
    }, { maxWait: 15_000 }));
  }

  async vendorsWithStoredCanonical(limit: number): Promise<string[]> {
    return (await this.prisma.v3SiteSettings.findMany({ where: { canonicalHost: { not: null } }, select: { vendorId: true }, orderBy: { updatedAt: 'asc' }, take: limit })).map((r) => r.vendorId);
  }

  async activeAddonOverrideIds(vendorId: string, now: Date): Promise<string[]> {
    const rows = await this.prisma.v3EntitlementOverride.findMany({ where: { vendorId, featureKey: 'promotion.custom_domain_addon', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { id: true } });
    return rows.map((x) => x.id);
  }
}
