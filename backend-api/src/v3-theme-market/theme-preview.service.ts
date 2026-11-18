import { Inject, Injectable, Optional } from '@nestjs/common';
import { PACK_KIT_FALLBACK } from '../directory/core/listable-categories';
import { Kit, KIT, KitTheme, loadKit } from '../site-publish/renderer/renderer-loader';
import { packDemo } from '../v3-packs/pack-demo/pack-demo';
import { PAGE_NAME, PREVIEW_ENTITLEMENTS, previewContent, previewDocument } from './core/theme-preview-core';
import { themeError } from './theme-market.errors';

/**
 * Draws a theme with the sample business of a pack and returns the finished page (TM1 M5). It never touches a vendor, a database row or a price: the real renderer, the pack's invented sample business, every price
 * emptied. The caller sends it with PREVIEW_HEADERS (strict content security policy, no cookie). A theme is drawn with the closest kit category it was designed for, so it is never asked to draw content it has no design for.
 */
@Injectable()
export class ThemePreviewService {
  private readonly kit: Kit;
  constructor(@Optional() @Inject(KIT) kit?: Kit) { this.kit = kit ?? loadKit(); }

  render(theme: KitTheme, packKey: string, page: string): string {
    const demo = packDemo(String(packKey));
    const fallback = PACK_KIT_FALLBACK[String(packKey)];
    if (!demo || !fallback || !this.kit.hasCategory(fallback)) throw themeError(404, 'THEME_NOT_AVAILABLE', 'There is no sample business for that pack.');
    if (!PAGE_NAME.test(page) || !(page in theme.templates)) throw themeError(404, 'THEME_NOT_AVAILABLE', 'That page does not exist in this theme.');
    const cats = theme.manifest.categories;
    const track = this.kit.categoryById(fallback).track;
    const own = cats.includes(fallback) ? fallback : (cats.find((c) => this.kit.hasCategory(c) && this.kit.categoryById(c).track === track) ?? cats[0]);
    try {
      const content = previewContent(this.kit.sampleContent(own, { lang: 'en' }), demo);
      const siteUrl = (content.host as { siteUrl: string }).siteUrl;
      const item = (content.items as unknown[])[0];
      const r = this.kit.renderPage({ theme, page: page === 'item' ? { slug: 'item', item } : { slug: page }, content, settings: {}, vendor: { id: 'preview' }, host: { siteUrl }, entitlements: { ...PREVIEW_ENTITLEMENTS } });
      return previewDocument({ html: r.html, lang: r.lang ?? 'en', themeName: theme.manifest.name, css: theme.css });
    } catch (e) {
      if (e instanceof Error && 'getStatus' in e) throw e;
      throw themeError(422, 'THEME_PREVIEW_FAILED', 'This theme could not be drawn with the sample business.');
    }
  }
}
