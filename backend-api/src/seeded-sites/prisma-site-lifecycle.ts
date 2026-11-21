import { Global, Injectable, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { SeededLifecycle as SiteSeeded, SiteLifecycle } from '../site-publish/publish/site-lifecycle';
import { deriveLifecycle, seededSiteQuality } from './core/seeded';

/**
 * What the site build needs to know about seeding (the SiteLifecycle port of slice 5.4b), read straight from the seeded tables so the site build does not depend on this module's services.
 * A vendor that was never seeded gives null. The lifecycle is derived from the stored value and the facts (claimed profile, running paid plan, removal) every time.
 */
@Injectable()
export class PrismaSiteLifecycle extends SiteLifecycle {
  constructor(private readonly prisma: PrismaService) { super(); }

  private async load(vendorId: string) {
    const row = await this.prisma.v3SeededSite.findUnique({ where: { vendorId }, include: { business: true } });
    if (!row) return null;
    const sub = await this.prisma.v3PlanSubscription.findFirst({ where: { currentVendorId: vendorId, plan: { level: 'PRO' } }, select: { endsAt: true } });
    const proActive = !!sub && (sub.endsAt === null || sub.endsAt.getTime() > Date.now());
    return { row, proActive };
  }

  async lifecycleOf(vendorId: string): Promise<SiteSeeded | null> {
    const l = await this.load(vendorId);
    return l ? deriveLifecycle({ stored: l.row.lifecycle as never, businessStatus: l.row.business?.status ?? null, proActive: l.proActive }) : null;
  }

  async qualityOk(vendorId: string): Promise<boolean> {
    const l = await this.load(vendorId);
    if (!l) return false;
    const b = l.row.business; const addr = (b?.addressJson && typeof b.addressJson === 'object' && !Array.isArray(b.addressJson) ? b.addressJson : {}) as Record<string, unknown>;
    const onRegister = (await this.prisma.v3DncRegister.count({ where: { phoneHash: l.row.phoneHash } })) > 0;
    return seededSiteQuality({
      businessName: b?.name ?? null, categoryKnown: !!b?.categoryId, city: typeof addr.city === 'string' ? addr.city : null, area: typeof addr.line2 === 'string' ? addr.line2 : null, phoneE164: b?.phoneE164 ?? null,
      sourceKind: l.row.sourceKind, publicFactsConfirmed: l.row.publicFactsConfirmed, onRegister, lifecycle: l.row.lifecycle as never,
    }).pass;
  }
}

@Global()
@Module({ imports: [PrismaModule], providers: [{ provide: SiteLifecycle, useClass: PrismaSiteLifecycle }], exports: [SiteLifecycle] })
export class SiteLifecycleModule {}
