import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { SiteSettingsService } from '../site-publish/publish/site-settings.service';
import { ThemeRenderService } from '../site-publish/renderer/theme-render.service';
import { ThemeSwitchService } from '../v3-theme-switch/theme-switch.service';
import { packNotFound } from './theme-catalog.errors';
import { accessOf, applyState, feeLine, PackThemes, themesForPack, ThemeAccess, ThemeLite } from './core/theme-catalog-core';

export interface PackThemeItem { id: string; name: string; tier: string; tracks: string[]; access: ThemeAccess; categories: string[] }
export interface PackCatalogue { pack: { key: string; name: string }; matchedBy: PackThemes['matchedBy']; items: PackThemeItem[] }

/**
 * The theme catalogue per pack and a business's own view of it (Wave 3 Part H). It READS the theme library, the pack tables and the existing theme switch fee; it writes nothing and charges nothing: choosing
 * a theme stays PUT /v3/me/site/theme (a Free plan is refused there with FEATURE_LOCKED), previewing stays the site build, and a later switch is charged from wallet credit by the Theme Switch Service.
 * The other services are found through ModuleRef (like the seeded-site publisher does), so this module imports neither the site nor the theme-switch module and no import cycle exists.
 */
@Injectable()
export class ThemeCatalogV3Service {
  constructor(private readonly prisma: PrismaService, private readonly modules: ModuleRef) {}

  private themes(): ThemeLite[] { return this.modules.get(ThemeRenderService, { strict: false }).listThemes().map((t) => ({ id: t.id, name: t.name, tier: t.tier, tracks: t.tracks, categories: t.categories })); }

  /** The themes for one pack, public: no vendor, no price, no personal data. */
  async forPack(packKey: string): Promise<PackCatalogue> {
    const pack = typeof packKey === 'string' && /^[A-Z0-9_]{2,60}$/.test(packKey) ? await this.prisma.v3Pack.findUnique({ where: { key: packKey }, select: { key: true, name: true, enabled: true } }) : null;
    if (!pack || !pack.enabled) throw packNotFound();
    const cats = await this.prisma.v3PackCategory.findMany({ where: { packKey: pack.key, active: true }, select: { categoryKey: true, minTier: true } });
    const render = this.modules.get(ThemeRenderService, { strict: false });
    const found = themesForPack(this.themes(), cats.map((c) => c.categoryKey), [...new Set(cats.map((c) => c.minTier))]);
    const defaults = new Set(cats.map((c) => render.defaultThemeFor(c.categoryKey)).filter((x): x is string => !!x));
    return { pack: { key: pack.key, name: pack.name }, matchedBy: found.matchedBy, items: found.themes.map((t) => ({ id: t.id, name: t.name, tier: t.tier, tracks: t.tracks, access: accessOf(t.id, defaults), categories: t.categories.filter((c) => cats.some((x) => x.categoryKey === c)) })) };
  }

  /** One business's view: what it uses, what it may apply and why not, and the switch fee (a PENDING fee is no number). */
  async forVendor(vendorId: string) {
    const settings = this.modules.get(SiteSettingsService, { strict: false });
    const status = await settings.status(vendorId);
    const render = this.modules.get(ThemeRenderService, { strict: false });
    const all = this.themes();
    const allowedIds = new Set(status.allowedThemes);
    const selected = all.find((t) => t.id === status.themeId) ?? null;
    const track = selected?.tracks[0] ?? (await this.trackOf(vendorId));
    const onLibrary = allowedIds.size > 1;   // the default alone on a Free plan; the whole library for the track on a paid plan
    const feeSvc = this.modules.get(ThemeSwitchService, { strict: false });
    const fee = feeLine(await feeSvc.fee());
    const defaults = new Set(all.filter((t) => t.categories.some((c) => render.defaultThemeFor(c) === t.id)).map((t) => t.id));
    return {
      selectedThemeId: status.themeId, library: onLibrary, fee,
      items: all.filter((t) => allowedIds.has(t.id) || (track !== null && t.tracks.some((x) => x.toLowerCase() === track.toLowerCase()))).map((t) => ({ id: t.id, name: t.name, tier: t.tier, tracks: t.tracks, access: accessOf(t.id, defaults), selected: t.id === status.themeId, ...applyState(t, { allowedIds, track, onLibrary }) })).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    };
  }

  private async trackOf(vendorId: string): Promise<string | null> {
    const sub = await this.prisma.v3PlanSubscription.findFirst({ where: { vendorId, currentVendorId: vendorId }, select: { plan: { select: { track: true } } } });
    return sub ? String(sub.plan.track).toLowerCase() : null;
  }
}
