import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SiteSettingsService } from '../site-publish/publish/site-settings.service';
import { ThemeRenderService } from '../site-publish/renderer/theme-render.service';
import { ThemeCatalogV3Service } from '../v3-theme-catalog/theme-catalog.service';
import { byName, isKnownCategory, libraryMeta, ListingFilter, MarketTheme, matches, previewPath, rowMeta } from './core/theme-listing-core';
import { ADDON_KEYS, CAPABILITY_KEYS, COMBINATION_TAGS, PACK_KEYS } from './core/theme-package-core';
import { themeError } from './theme-market.errors';
import { ThemePreviewService } from './theme-preview.service';
import { ThemeMarketStore } from './theme-market.store';

export interface ListQuery { pack?: string; category?: string; addon?: string; capability?: string; tag?: string; tier?: string; starter?: string; q?: string; page?: number; pageSize?: number }

/** A listing item as the public sees it: what the theme is designed for and where its preview is. No vendor, no price, no count, no source business. */
export function publicView(t: MarketTheme) {
  return {
    id: t.key, name: t.name, description: t.description, tier: t.tier, premium: t.premium, starter: t.starter, source: t.source, version: t.version, tracks: t.tracks,
    packs: t.packs, addons: t.addons, capabilities: t.capabilities, tags: t.tags, catalogueCategories: t.catalogueCategories,
    preview: { kind: 'GENERATED' as const, path: previewPath('public', t.key, t.packs[0]) },
  };
}

/**
 * The marketplace for businesses and for the public (TM1 M5). It READS: the themes the renderer serves, the marketplace metadata, and a business's own view of what it may apply (the existing theme catalogue answer,
 * so the plan gate and the entitlement checks are the SAME rules as the theme switch: a Free plan sees every theme locked with PLAN_REQUIRED and is refused by the switch route). It writes nothing and charges nothing:
 * choosing a theme stays POST /v3/me/site/theme/switch with its wallet-paid fee. Nothing here is a popularity, a count or a ranking: items are sorted by name.
 */
@Injectable()
export class ThemeMarketplaceService {
  constructor(private readonly store: ThemeMarketStore, private readonly modules: ModuleRef, private readonly previews: ThemePreviewService) {}

  private get render(): ThemeRenderService { return this.modules.get(ThemeRenderService, { strict: false }); }

  /** A filter value that is not real is a plain refusal, never an empty list that looks like "nothing there". */
  private filterOf(q: ListQuery): ListingFilter {
    const bad = (n: string): never => { throw themeError(400, 'THEME_FILTER_INVALID', `The filter "${n}" has a value that is not recognised.`); };
    if (q.pack && !PACK_KEYS.includes(q.pack)) bad('pack');
    if (q.addon && !ADDON_KEYS.includes(q.addon)) bad('addon');
    if (q.capability && !CAPABILITY_KEYS.includes(q.capability)) bad('capability');
    if (q.tag && !(q.tag in COMBINATION_TAGS)) bad('tag');
    if (q.tier && !['Standard', 'Premium'].includes(q.tier)) bad('tier');
    if (q.category && !isKnownCategory(q.category)) bad('category');
    if (q.starter !== undefined && !['true', 'false'].includes(q.starter)) bad('starter');
    return { pack: q.pack, category: q.category, addon: q.addon, capability: q.capability, tag: q.tag, tier: q.tier, ...(q.starter ? { starter: q.starter === 'true' } : {}), ...(q.q ? { q: q.q.slice(0, 80) } : {}) };
  }

  /** Every theme this audience may be offered, described one way. `keepId` keeps the archived theme a business already uses. */
  private async describe(vendorId: string | null, keepId?: string | null): Promise<MarketTheme[]> {
    const render = this.render; const rows = await this.store.servableMeta();
    const first = new Map<string, (typeof rows)[number]>(); for (const r of rows) if (!first.has(r.key)) first.set(r.key, r);   // rows come newest version first: the first of a key is the one drawn
    return render.listThemes(vendorId, keepId).map((t) => {
      const row = t.source === 'MARKETPLACE' ? first.get(t.id) : undefined;
      return row ? rowMeta(row) : libraryMeta(render.getTheme(t.id).manifest);
    }).sort(byName);
  }

  private page<T>(items: T[], page = 1, pageSize = 25): { items: T[]; total: number; page: number; pageSize: number } {
    const size = Math.min(Math.max(Math.floor(pageSize) || 25, 1), 100); const p = Math.max(Math.floor(page) || 1, 1);
    return { items: items.slice((p - 1) * size, p * size), total: items.length, page: p, pageSize: size };
  }

  // ------------------------------------------------------------------ public
  async publicList(q: ListQuery) { const f = this.filterOf(q); return this.page((await this.describe(null)).filter((t) => matches(t, f)).map(publicView), q.page, q.pageSize); }

  async publicDetail(key: string) {
    const t = (await this.describe(null)).find((x) => x.key === String(key).slice(0, 60));
    if (!t) throw themeError(404, 'THEME_NOT_AVAILABLE', 'That theme is not available.');
    const loaded = this.render.getTheme(t.key);
    return { ...publicView(t), pages: Object.keys(loaded.theme.templates).sort(), previews: t.packs.map((p) => ({ pack: p, path: previewPath('public', t.key, p) })) };
  }

  publicPreview(key: string, pack: string | undefined, page: string | undefined): Promise<string> {
    return this.previewOf(null, null, key, pack, page);
  }

  // ------------------------------------------------------------------ one business
  private async current(vendorId: string): Promise<string | null> { return (await this.modules.get(SiteSettingsService, { strict: false }).status(vendorId)).themeId; }

  /** The business's own marketplace view: each theme with whether it may apply it now and why not, the switch fee and what it uses. */
  async meList(vendorId: string, q: ListQuery) {
    const f = this.filterOf(q);
    const view = await this.modules.get(ThemeCatalogV3Service, { strict: false }).forVendor(vendorId);
    const meta = new Map((await this.describe(vendorId, view.selectedThemeId)).map((t) => [t.key, t] as const));
    const items = view.items.filter((i) => meta.has(i.id) && matches(meta.get(i.id)!, f)).map((i) => {
      const t = meta.get(i.id)!;
      return { ...publicView(t), allowed: i.allowed, reason: i.reason, selected: i.selected, access: i.access, preview: { kind: 'GENERATED' as const, path: previewPath('me', t.key, t.packs[0]) } };
    });
    const p = this.page(items, q.page, q.pageSize);
    return { selectedThemeId: view.selectedThemeId, library: view.library, fee: view.fee, ...p };
  }

  async meDetail(vendorId: string, key: string) {
    const k = String(key).slice(0, 60);
    const all = await this.meList(vendorId, { pageSize: 100 });
    // a business that has more than 100 offered themes still finds its theme: page on until it is found
    let item = all.items.find((i) => i.id === k); let pageNo = 1;
    while (!item && pageNo * 100 < all.total) { pageNo += 1; item = (await this.meList(vendorId, { page: pageNo, pageSize: 100 })).items.find((i) => i.id === k); }
    if (!item) throw themeError(404, 'THEME_NOT_AVAILABLE', 'That theme is not available.');
    const loaded = this.render.getTheme(k);
    return { ...item, fee: all.fee, pages: Object.keys(loaded.theme.templates).sort(), previews: item.packs.map((p) => ({ pack: p, path: previewPath('me', k, p) })) };
  }

  async mePreview(vendorId: string, key: string, pack: string | undefined, page: string | undefined): Promise<string> {
    return this.previewOf(vendorId, await this.current(vendorId), key, pack, page);
  }

  private async previewOf(vendorId: string | null, keepId: string | null, key: string, pack: string | undefined, page: string | undefined): Promise<string> {
    const k = String(key).slice(0, 60);
    const t = (await this.describe(vendorId, keepId)).find((x) => x.key === k);
    if (!t) throw themeError(404, 'THEME_NOT_AVAILABLE', 'That theme is not available.');
    const packKey = String(pack ?? t.packs[0] ?? '').toUpperCase().slice(0, 60);
    return this.previews.render(this.render.getTheme(k).theme, packKey, String(page ?? 'home'));
  }
}
