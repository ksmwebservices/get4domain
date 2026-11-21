import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { SiteSettingsService } from '../site-publish/publish/site-settings.service';
import { ThemeRenderService } from '../site-publish/renderer/theme-render.service';
import { ThemeSwitchService } from '../v3-theme-switch/theme-switch.service';
import { packNotFound } from './theme-catalog.errors';
import { KIT_ONLY_PACK, PACK_KIT_FALLBACK } from '../directory/core/listable-categories';
import { accessOf, applyState, feeLine, isPremium, PackThemes, packCategoriesWithKit, previewRef, themesForPack, ThemeAccess, ThemeLite, ThemePreviewRef } from './core/theme-catalog-core';

export interface PackThemeItem { id: string; name: string; description: string | null; tier: string; premium: boolean; tracks: string[]; access: ThemeAccess; categories: string[]; preview: ThemePreviewRef }
export interface PackCatalogue { pack: { key: string; name: string }; matchedBy: PackThemes['matchedBy']; /** false when no theme was designed for a category of this pack and the list is a neighbouring trade's design */ dedicated: boolean; items: PackThemeItem[] }

/**
 * The theme catalogue per pack and a business's own view of it (Wave 3 Part H). It READS the theme library, the pack tables and the existing theme switch fee; it writes nothing and charges nothing: choosing
 * a theme stays PUT /v3/me/site/theme (a Free plan is refused there with FEATURE_LOCKED), previewing stays the site build, and a later switch is charged from wallet credit by the Theme Switch Service.
 * The other services are found through ModuleRef (like the seeded-site publisher does), so this module imports neither the site nor the theme-switch module and no import cycle exists.
 */
@Injectable()
export class ThemeCatalogV3Service {
  constructor(private readonly prisma: PrismaService, private readonly modules: ModuleRef) {}

  private themes(vendorId?: string, keepId?: string | null): ThemeLite[] { return this.modules.get(ThemeRenderService, { strict: false }).listThemes(vendorId, keepId).map((t) => ({ id: t.id, name: t.name, tier: t.tier, tracks: t.tracks, categories: t.categories, description: t.description ?? null })); }

  /** The themes for one pack, public: no vendor, no price, no personal data. */
  async forPack(packKey: string): Promise<PackCatalogue> {
    const pack = typeof packKey === 'string' && /^[A-Z0-9_]{2,60}$/.test(packKey) ? await this.prisma.v3Pack.findUnique({ where: { key: packKey }, select: { key: true, name: true, enabled: true } }) : null;
    if (!pack || !pack.enabled) throw packNotFound();
    const cats = await this.prisma.v3PackCategory.findMany({ where: { packKey: pack.key, active: true }, select: { categoryKey: true, minTier: true } });
    const render = this.modules.get(ThemeRenderService, { strict: false });
    const keys = packCategoriesWithKit(cats.map((c) => c.categoryKey), pack.key, KIT_ONLY_PACK);
    const found = themesForPack(this.themes(), keys, [...new Set(cats.map((c) => c.minTier))], PACK_KIT_FALLBACK[pack.key] ?? null);
    const defaults = new Set(keys.map((k) => render.defaultThemeFor(k)).filter((x): x is string => !!x));
    return {
      pack: { key: pack.key, name: pack.name }, matchedBy: found.matchedBy, dedicated: found.matchedBy === 'CATEGORY',
      items: found.themes.map((t) => ({ id: t.id, name: t.name, description: t.description ?? null, tier: t.tier, premium: isPremium(t.tier), tracks: t.tracks, access: accessOf(t.id, defaults), categories: t.categories.filter((c) => keys.includes(c)), preview: previewRef(t.id, pack.key) })),
    };
  }

  /**
   * A generated preview: the real renderer draws the theme with the sample business of the pack (the kit's sample content for the kit category that pack uses). PUBLIC and pure: no vendor, no database row, no
   * price (every price field of the sample is emptied, a preview never shows a number the owner did not choose). Answers a plain 404 for an unknown theme, pack or page.
   */
  previewHtml(themeId: string, packKey: string, page: string): string {
    const render = this.modules.get(ThemeRenderService, { strict: false });
    const theme = render.listThemes().find((t) => t.id === themeId);
    const category = PACK_KIT_FALLBACK[packKey];
    if (!theme || !category || !/^[a-z0-9-]{1,30}$/.test(page)) throw new NotFoundException('Not found');
    const kit = render.kitApi;
    // a theme designed for the pack's own category is drawn with that category; any other theme is drawn with the closest category it was designed for in the same track, so no theme is ever drawn with content it has no preset for
    const own = theme.categories.includes(category) ? category : (theme.categories.find((c) => kit.categoryById(c).track === kit.categoryById(category).track) ?? theme.categories[0]);
    const content = stripPrices(kit.sampleContent(own, { lang: 'en' }));
    try {
      const r = render.render(themeId, { page: page === 'item' ? { slug: 'item', item: (content.items as unknown[])[0] } : { slug: page }, content, settings: {}, vendor: { id: 'preview' }, host: { siteUrl: (content.host as { siteUrl: string }).siteUrl }, entitlements: { video: false, cart: false, booking: false, customDomain: false, callsToAction: true } });
      const css = render.getTheme(themeId).theme.css; const esc = (x: string): string => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return `<!doctype html>
<html lang="${r.lang?.slice(0, 2) === 'ta' ? 'ta' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(`${theme.name} preview`)}</title>
<style>html,body{margin:0}
${[css.tokens, css.base, css.motion, css.print].filter(Boolean).join(NEWLINE)}</style>
</head>
<body>${r.html}</body>
</html>
`;
    } catch (e) { if (e instanceof BadRequestException) throw new NotFoundException('Not found'); throw e; }
  }

  /** One business's view: what it uses, what it may apply and why not, and the switch fee (a PENDING fee is no number). */
  async forVendor(vendorId: string) {
    const settings = this.modules.get(SiteSettingsService, { strict: false });
    const status = await settings.status(vendorId);
    const render = this.modules.get(ThemeRenderService, { strict: false });
    const all = this.themes(vendorId, status.themeId);
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

const NEWLINE = String.fromCharCode(10);
/** Empties every price of a sample content tree (items, groups, blocks, products, offers): a preview never shows a number the owner did not choose. */
export function stripPrices(content: Record<string, unknown>): Record<string, unknown> {
  const walk = (v: unknown): unknown => Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, k === 'price' || k === 'priceFrom' || k === 'oldPrice' ? '' : walk(x)])) : v;
  return walk(content) as Record<string, unknown>;
}
