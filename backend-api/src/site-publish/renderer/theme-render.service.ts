import { BadRequestException, HttpException, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ThemeChangeNotifier } from '../../v3-theme-market/theme-change-notifier';
import { ThemeMarketStore, ThemeRowWithBytes } from '../../v3-theme-market/theme-market.store';
import { siteError } from '../site.errors';
import { Kit, KIT, KitManifest, KitTheme, RenderInput, RenderResult, loadKit } from './renderer-loader';

export { KIT };

export type ThemeSource = 'LIBRARY' | 'MARKETPLACE';
export interface LoadedTheme { id: string; theme: KitTheme; hash: string; manifest: KitManifest; source: ThemeSource; /** marketplace only */ status?: 'PUBLISHED' | 'ARCHIVED'; visibility?: 'PUBLIC' | 'PRIVATE'; privateVendorId?: string | null; version?: number }
export interface ThemeSummary { id: string; name: string; description?: string | null; tier: string; tracks: string[]; categories: string[]; hash: string; source?: ThemeSource; visibility?: 'PUBLIC' | 'PRIVATE'; version?: number }

/** A marketplace theme that failed while drawing a page. The build catches it and draws the site with the vendor's previous or the default theme instead of failing. */
export class ThemeRenderError extends Error {
  constructor(readonly themeId: string, readonly reason: string) { super(`theme ${themeId} failed to render: ${reason}`); this.name = 'ThemeRenderError'; }
}

/** How long the marketplace themes are kept before they are read again when nothing told us they changed (another server published one). A publish or archive on this server drops it at once. */
export const DYNAMIC_THEME_TTL_MS = 30_000;

const summary = (t: LoadedTheme): ThemeSummary => ({ id: t.id, name: t.manifest.name, description: t.manifest.description ?? null, tier: t.manifest.tier, tracks: t.manifest.tracks, categories: t.manifest.categories, hash: t.hash, source: t.source, ...(t.visibility ? { visibility: t.visibility } : {}), ...(t.version ? { version: t.version } : {}) });

/**
 * The backend's one door to the theme kit's renderer. It loads the theme library read-only, validates every library theme with the kit's own lint at start and refuses to serve one that fails, caches by theme id and content hash,
 * and returns the renderer's output unchanged. The renderer itself is the kit's (built from themes/, never copied): pure, no network, no database, no clock, no randomness.
 *
 * TM1 M3: besides the library, themes PUBLISHED in the marketplace are loaded at run time from the database (the packages were validated at upload and again at publish). They are kept in a short cache that is
 * dropped the moment one is published or archived on this server and re-read every 30 seconds otherwise, so a new theme appears and renders with no rebuild and no restart. Rules:
 *  - the library's default theme of a category (`defaultThemeFor`) is NEVER a marketplace theme: Free sites keep the default;
 *  - `listThemes(vendorId)` offers a PUBLIC published theme to everyone and a PRIVATE one only to its own business;
 *  - an ARCHIVED theme is not offered, but `getTheme` still draws it and `listThemes(vendorId, keepId)` keeps it for the business that already uses it, until that business switches;
 *  - a marketplace theme that throws while drawing raises ThemeRenderError (the build falls back); a library theme behaves as before.
 */
@Injectable()
export class ThemeRenderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ThemeRenderService.name);
  private readonly kit: Kit;
  private readonly served = new Map<string, LoadedTheme>();
  private readonly invalid: Record<string, string[]> = {};
  private ready = false;
  /** marketplace themes by key: the newest PUBLISHED version, else the newest ARCHIVED one */
  private dynamic = new Map<string, LoadedTheme>();
  private dynamicAt = 0;
  private timer: NodeJS.Timeout | null = null;
  private refreshing: Promise<void> | null = null;
  clock: () => number = () => Date.now();

  constructor(@Optional() @Inject(KIT) kit?: Kit, @Optional() private readonly market?: ThemeMarketStore, @Optional() private readonly changes?: ThemeChangeNotifier) { this.kit = kit ?? loadKit(); }

  async onModuleInit(): Promise<void> {
    this.init();
    if (!this.market) return;
    this.changes?.subscribe(() => this.refreshDynamic());
    await this.refreshDynamic();
    this.timer = setInterval(() => { void this.refreshDynamic(); }, DYNAMIC_THEME_TTL_MS);
    this.timer.unref();
  }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }

  /** Loads and lints every library theme. Safe to call twice. */
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
        this.served.set(id, { id, theme, hash: this.kit.computeContentHash(files), manifest: theme.manifest, source: 'LIBRARY' });
      } catch (e) {
        this.invalid[id] = [e instanceof Error ? e.message.slice(0, 200) : 'could not be loaded'];
      }
    }
    for (const [id, why] of Object.entries(this.invalid)) this.logger.error(`theme ${id} failed validation and will not be served: ${why[0]}`);
    this.logger.log(`themes served: ${[...this.served.keys()].join(', ') || 'none'}`);
    this.ready = true;
  }

  /**
   * (Re)reads the marketplace themes. Never throws: when the database cannot be read the previous set stays (a theme that was working keeps working). A stored package that no longer validates is skipped and logged,
   * so the businesses that use it fall back instead of getting an error page.
   */
  async refreshDynamic(): Promise<void> {
    if (!this.market) return;
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      try {
        const rows = await this.market!.loadServable();
        const next = new Map<string, LoadedTheme>();
        for (const row of rows) {   // newest version first, PUBLISHED before ARCHIVED within a key
          const cur = next.get(row.key);
          if (cur && !(cur.status === 'ARCHIVED' && row.status === 'PUBLISHED')) continue;
          const loaded = this.loadRow(row);
          if (loaded) next.set(row.key, loaded);
        }
        this.dynamic = next; this.dynamicAt = this.clock();
      } catch (e) {
        this.logger.error(`marketplace themes could not be read; keeping the previous set: ${e instanceof Error ? e.message.slice(0, 160) : 'unknown error'}`);
      } finally { this.refreshing = null; }
    })();
    return this.refreshing;
  }

  private loadRow(row: ThemeRowWithBytes): LoadedTheme | null {
    if (this.served.has(row.key)) { this.logger.error(`marketplace theme ${row.key} uses a library key and is not served`); return null; }
    try {
      const r = this.kit.validatePackage(row.bytes);
      if (!r.ok || !r.manifest) { this.logger.error(`marketplace theme ${row.key} v${row.version} no longer validates and is not served: ${r.errors[0]?.code ?? 'unknown'}`); return null; }
      const theme = this.kit.themeFromFiles(r.files, null);
      return { id: row.key, theme, hash: row.contentHash, manifest: r.manifest, source: 'MARKETPLACE', status: row.status === 'PUBLISHED' ? 'PUBLISHED' : 'ARCHIVED', visibility: row.visibility, privateVendorId: row.privateVendorId, version: row.version };
    } catch (e) {
      this.logger.error(`marketplace theme ${row.key} could not be loaded: ${e instanceof Error ? e.message.slice(0, 160) : 'unknown error'}`);
      return null;
    }
  }

  /** True when the marketplace cache is older than its time to live (a caller may then ask for a refresh; reads never wait for it). */
  get dynamicStale(): boolean { return !!this.market && this.clock() - this.dynamicAt > DYNAMIC_THEME_TTL_MS; }

  /** Themes that failed validation at start, with the first findings (staff only). */
  invalidThemes(): Record<string, string[]> { return { ...this.invalid }; }

  /**
   * The themes a business may be offered. The library, plus the marketplace themes that are PUBLISHED and public, plus the business's own private ones. `keepId` is the theme the business already uses: it stays
   * in the list even when archived (and only then), so its site keeps drawing until it switches. With no vendor only the library and the public published themes are returned.
   */
  listThemes(vendorId?: string | null, keepId?: string | null): ThemeSummary[] {
    const lib = [...this.served.values()].map(summary);
    const dyn = [...this.dynamic.values()].filter((t) => {
      if (t.visibility === 'PRIVATE' && (!vendorId || t.privateVendorId !== vendorId)) return false;
      return t.status === 'PUBLISHED' || (!!keepId && t.id === keepId);
    }).map(summary);
    return [...lib, ...dyn];
  }

  /** The theme to render with, or THEME_INVALID for an unknown id, an internal theme or one that failed validation. An archived marketplace theme is still drawn (only businesses that already use it reach it). */
  getTheme(id: string): LoadedTheme {
    this.init();
    const t = this.served.get(id) ?? this.dynamic.get(id);
    if (!t) throw new BadRequestException(siteError('THEME_INVALID', 'That theme is not available.'));
    return t;
  }

  /** The Standard theme assigned to a category: the one whose LIBRARY manifest lists it (the five library themes list disjoint categories covering all 41). A marketplace theme is never a default. */
  defaultThemeFor(categoryId: string): string | null {
    this.init();
    return [...this.served.values()].find((t) => t.manifest.categories.includes(categoryId))?.id ?? null;
  }

  isMarketplace(id: string): boolean { return !this.served.has(id) && this.dynamic.has(id); }

  render(themeId: string, input: Omit<RenderInput, 'theme'>): RenderResult {
    const loaded = this.getTheme(themeId);
    if (loaded.source === 'LIBRARY') return this.kit.renderPage({ ...input, theme: loaded.theme });
    try { return this.kit.renderPage({ ...input, theme: loaded.theme }); }
    catch (e) {
      if (e instanceof HttpException) throw e;
      throw new ThemeRenderError(themeId, e instanceof Error ? e.message.slice(0, 200) : 'unknown error');
    }
  }

  get kitApi(): Kit { return this.kit; }
}
