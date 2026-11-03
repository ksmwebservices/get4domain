import { BadRequestException, Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { siteError } from '../site.errors';
import { Kit, KitManifest, KitTheme, RenderInput, RenderResult, loadKit } from './renderer-loader';

export const KIT = Symbol('THEME_KIT');

export interface LoadedTheme { id: string; theme: KitTheme; hash: string; manifest: KitManifest }
export interface ThemeSummary { id: string; name: string; tier: string; tracks: string[]; categories: string[]; hash: string }

/**
 * The backend's one door to the theme kit's renderer. It loads the theme library read-only (no theme file is ever user supplied in this slice),
 * validates every vendor theme with the kit's own lint at start and refuses to serve one that fails, caches by theme id and content hash, and returns the
 * renderer's output unchanged. The renderer itself is the kit's (built from themes/, never copied): pure, no network, no database, no clock, no randomness.
 */
@Injectable()
export class ThemeRenderService implements OnModuleInit {
  private readonly logger = new Logger(ThemeRenderService.name);
  private readonly kit: Kit;
  private readonly served = new Map<string, LoadedTheme>();
  private readonly invalid: Record<string, string[]> = {};
  private ready = false;

  constructor(@Optional() @Inject(KIT) kit?: Kit) { this.kit = kit ?? loadKit(); }

  onModuleInit(): void { this.init(); }

  /** Loads and lints every vendor theme. Safe to call twice. */
  init(): void {
    if (this.ready) return;
    this.served.clear();
    for (const k of Object.keys(this.invalid)) delete this.invalid[k];
    for (const id of this.kit.listVendorThemeIds()) {
      try {
        const theme = this.kit.loadTheme(id);
        const result = this.kit.lintTheme(theme, {});
        if (!result.ok) { this.invalid[id] = result.findings.slice(0, 5).map((f) => `${f.rule}${f.message ? `: ${f.message}` : ''}`); continue; }
        const files = theme.dir ? this.kit.readThemeDir(theme.dir) : {};
        this.served.set(id, { id, theme, hash: this.kit.computeContentHash(files), manifest: theme.manifest });
      } catch (e) {
        this.invalid[id] = [e instanceof Error ? e.message.slice(0, 200) : 'could not be loaded'];
      }
    }
    for (const [id, why] of Object.entries(this.invalid)) this.logger.error(`theme ${id} failed validation and will not be served: ${why[0]}`);
    this.logger.log(`themes served: ${[...this.served.keys()].join(', ') || 'none'}`);
    this.ready = true;
  }

  /** Themes that failed validation at start, with the first findings (staff only). */
  invalidThemes(): Record<string, string[]> { return { ...this.invalid }; }

  listThemes(): ThemeSummary[] {
    return [...this.served.values()].map((t) => ({ id: t.id, name: t.manifest.name, tier: t.manifest.tier, tracks: t.manifest.tracks, categories: t.manifest.categories, hash: t.hash }));
  }

  /** The theme to render with, or THEME_INVALID for an unknown id, an internal theme or one that failed validation. */
  getTheme(id: string): LoadedTheme {
    this.init();
    const t = this.served.get(id);
    if (!t) throw new BadRequestException(siteError('THEME_INVALID', 'That theme is not available.'));
    return t;
  }

  /** The Standard theme assigned to a category: the one whose manifest lists it (the five themes list disjoint categories covering all 41). */
  defaultThemeFor(categoryId: string): string | null {
    this.init();
    return [...this.served.values()].find((t) => t.manifest.categories.includes(categoryId))?.id ?? null;
  }

  render(themeId: string, input: Omit<RenderInput, 'theme'>): RenderResult {
    return this.kit.renderPage({ ...input, theme: this.getTheme(themeId).theme });
  }

  get kitApi(): Kit { return this.kit; }
}
