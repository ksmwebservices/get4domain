import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ThemeCatalogService, GST_RATE } from '../themes/theme-catalog.service';
import { StarterService } from './starter.service';

/** The vendor's marketplace tab (inside Template): the paid themes that suit the vendor's category, what each costs for a year with GST, and what the vendor already owns. */
@Injectable()
export class ThemeVendorService {
  constructor(private readonly prisma: PrismaService, private readonly themes: ThemeCatalogService, private readonly starter: StarterService) {}

  async categoryOf(vendorId: string): Promise<string | null> {
    const [row, vendor] = await Promise.all([this.prisma.vendorCMS.findUnique({ where: { vendorId }, select: { packKey: true } }), this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { industry: true } })]);
    const pack = await this.starter.packFor(row?.packKey, vendor?.industry);
    return pack?.key ?? null;
  }

  async tab(vendorId: string) {
    const category = await this.categoryOf(vendorId);
    if (!category) return { category: null, themes: [] as unknown[] };
    const now = new Date();
    const cards = (await this.themes.liveForCategory(category)).filter((t) => t.role === 'MARKETPLACE');
    const themes = [];
    for (const t of cards) {
      const ent = await this.themes.activeEntitlement(vendorId, t.key, now);
      const had = !ent && (await this.themes.hadEntitlement(vendorId, t.key));
      const base = t.priceYearlyPaise ?? 0; const gst = Math.round(base * GST_RATE);
      themes.push({
        key: t.key, name: t.name, version: t.version, author: t.author, description: t.description, previewPath: t.previewPath, id: t.id,
        priceYearlyPaise: base, gstPaise: gst, totalPaise: base + gst,
        owned: ent ? { endsAt: ent.endsAt, daysLeft: Math.ceil((ent.endsAt.getTime() - now.getTime()) / 86_400_000) } : null,
        expired: had,
      });
    }
    return { category, themes };
  }
}
