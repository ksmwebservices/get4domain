import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Which theme a vendor's site may use right now. The rules in one place:
 *  - a design key "t:<key>" names an imported theme; any other key is a built-in design
 *  - a theme works only for the categories it declares (and an admin allows)
 *  - a free-default theme is for everyone in its categories; a marketplace theme needs an active yearly entitlement (a preview needs none)
 *  - a site that is only a prospect (DRAFT or UNCLAIMED) always uses a free design
 *  - when a theme cannot be used (expired, retired, wrong category) the site falls back to the category's default free design; nothing the vendor wrote changes
 */
export const THEME_PREFIX = 't:';
export const GST_RATE = 0.18;

export interface ThemeRef { id: string; key: string; version: number; name: string }
export type ThemeNoticeKind = 'expired' | 'retired' | 'not-owned' | 'incompatible' | 'unavailable' | 'prospect';
export interface ThemeNotice { kind: ThemeNoticeKind; themeKey: string; themeName: string; message: string }
export interface Resolved { ref: ThemeRef | null; notice: ThemeNotice | null }

export interface ThemeCard {
  id: string; key: string; version: number; name: string; role: string; replacesDesign: string | null; priceYearlyPaise: number | null; previewPath: string | null; categories: string[]; families: string[]; author: string; description: string | null;
}

@Injectable()
export class ThemeCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** The newest usable row of a theme: the live version, else (for an owner) the newest retired one. */
  async rowsOf(key: string) { return this.prisma.themePackage.findMany({ where: { key }, orderBy: { version: 'desc' } }); }

  async activeEntitlement(vendorId: string, key: string, now = new Date()) {
    return this.prisma.themeEntitlement.findFirst({ where: { vendorId, themeKey: key, status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { endsAt: 'desc' } });
  }

  async hadEntitlement(vendorId: string, key: string): Promise<boolean> {
    return (await this.prisma.themeEntitlement.count({ where: { vendorId, themeKey: key } })) > 0;
  }

  private card(r: { id: string; key: string; version: number; name: string; role: string; replacesDesign: string | null; priceYearlyPaise: number | null; previewPath: string | null; categories: unknown; families: unknown; manifest: unknown }): ThemeCard {
    const m = (r.manifest ?? {}) as { author?: string; description?: string };
    return { id: r.id, key: r.key, version: r.version, name: r.name, role: r.role, replacesDesign: r.replacesDesign, priceYearlyPaise: r.priceYearlyPaise, previewPath: r.previewPath, categories: (r.categories as string[]) ?? [], families: (r.families as string[]) ?? [], author: m.author ?? '', description: m.description ?? null };
  }

  /** Every live theme for a category (the newest live version of each key). */
  async liveForCategory(categoryKey: string): Promise<ThemeCard[]> {
    const rows = await this.prisma.themePackage.findMany({ where: { status: 'LIVE' }, orderBy: [{ key: 'asc' }, { version: 'desc' }] });
    const seen = new Set<string>(); const out: ThemeCard[] = [];
    for (const r of rows) {
      if (seen.has(r.key)) continue; seen.add(r.key);
      if (!((r.categories as string[]) ?? []).includes(categoryKey)) continue;
      out.push(this.card(r));
    }
    return out;
  }

  /** The free-default themes of a category by the built-in design slot they replace. */
  async freeSlots(categoryKey: string): Promise<Record<string, ThemeCard>> {
    const out: Record<string, ThemeCard> = {};
    for (const t of await this.liveForCategory(categoryKey)) if (t.role === 'FREE_DEFAULT' && t.replacesDesign && !out[t.replacesDesign]) out[t.replacesDesign] = t;
    return out;
  }

  /** The category's default free design: the pack's default design, or the theme that replaced its slot. */
  async defaultFreeDesign(categoryKey: string, packDefault: string | undefined): Promise<string | undefined> {
    const slots = await this.freeSlots(categoryKey);
    return packDefault && slots[packDefault] ? `${THEME_PREFIX}${slots[packDefault].key}` : packDefault;
  }

  /** Decides which theme (if any) a site renders. `preview` opens any live compatible theme, owned or not, because previewing is free. */
  async resolve(vendorId: string | null, designKey: string | null | undefined, ctx: { categoryKey: string | null; siteStatus: string; preview?: boolean }): Promise<Resolved> {
    if (!designKey || !designKey.startsWith(THEME_PREFIX)) return { ref: null, notice: null };
    const key = designKey.slice(THEME_PREFIX.length);
    const rows = await this.rowsOf(key);
    const name = rows[0]?.name ?? key;
    const no = (kind: ThemeNoticeKind, message: string): Resolved => ({ ref: null, notice: { kind, themeKey: key, themeName: name, message } });
    if (!rows.length) return no('unavailable', 'The theme you chose is no longer available. Your site is showing the standard design for your category and none of your content has changed.');
    const live = rows.find((r) => r.status === 'LIVE');
    const ent = vendorId ? await this.activeEntitlement(vendorId, key) : null;
    const chosen = live ?? (ent ? rows[0] : undefined);
    if (!chosen) return no('retired', `The theme "${name}" has been withdrawn. Your site is showing the standard design for your category and none of your content has changed.`);
    if (ctx.categoryKey && !((chosen.categories as string[]) ?? []).includes(ctx.categoryKey)) return no('incompatible', `The theme "${name}" is not made for your kind of business. Your site is showing the standard design for your category.`);
    const ref: ThemeRef = { id: chosen.id, key: chosen.key, version: chosen.version, name: chosen.name };
    if (chosen.role === 'FREE_DEFAULT') return { ref, notice: null };
    if (ctx.preview) return { ref, notice: null };
    if (ctx.siteStatus !== 'LIVE') return no('prospect', 'A site that is not live yet always uses a free design.');
    if (ent) return { ref, notice: null };
    if (vendorId && (await this.hadEntitlement(vendorId, key))) return no('expired', `Your yearly licence for "${name}" has ended, so your site is showing the standard design for your category. Nothing you wrote was changed. Renew the theme to bring it back.`);
    return no('not-owned', `"${name}" is a paid theme. Buy it to use it on your site.`);
  }
}
