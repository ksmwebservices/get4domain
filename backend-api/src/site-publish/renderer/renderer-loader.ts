/* eslint-disable @typescript-eslint/no-require-imports */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Loads the theme kit's renderer for the backend. The kit lives in themes/ (plain ESM, one source of truth); scripts/build-renderer.js turns it into
 * CommonJS at build time (dist/renderer). See docs/v3/V3_S4_RENDERER_PUBLISH.md section 2. Nothing here renders anything itself.
 *
 * Where the build is looked for: RENDERER_DIR, else <backend>/dist/renderer. In development and tests (never in production) a missing build is made on the
 * fly in a cache folder named after the hash of the kit sources, so the unit tests use the real renderer. In production a missing build is an error.
 */
export interface KitCategory { id: string; label: string; track: string; family: string; schemaType: string; ctaPrimary: string; flow?: string; packKey?: string }
export interface KitManifest { id: string; name: string; tier: string; tracks: string[]; families: string[]; categories: string[]; internal?: boolean; version: number; fonts?: string[] }
export interface KitTheme { manifest: KitManifest; templates: Record<string, string>; css: { base?: string; tokens?: string; motion?: string; print?: string }; presets?: Record<string, unknown>; dir: string | null }
export interface RenderInput {
  theme?: KitTheme; page: string | { slug: string; template?: string; item?: unknown; parent?: string };
  content: Record<string, unknown>; settings?: Record<string, unknown>; vendor?: Record<string, unknown>; host?: Record<string, unknown>;
  entitlements?: { video?: boolean; cart?: boolean; booking?: boolean; customDomain?: boolean; callsToAction?: boolean };
}
export interface RenderSeo { title: string; description: string; canonical: string; structuredData: Record<string, unknown>; hreflang: Array<{ lang: string; href: string }> }
export interface RenderResult { html: string; lang: string; seo: RenderSeo; slots: Array<{ name: string; rendered: boolean }>; warnings: string[]; template: string; variant?: { id: string } | null }
export interface LintResult { ok: boolean; findings: Array<{ rule: string; message?: string; severity?: string }>; categories?: unknown[] }

export interface Kit {
  renderPage(input: RenderInput): RenderResult;
  /** makes an already rendered page listing-only (strips every call to action, adds the platform lines); used when the plan lapses or the vendor is suspended after publishing */
  listingOnlyHtml(html: string, texts: Record<string, string>): string;
  loadTheme(idOrDir: string): KitTheme;
  lintTheme(theme: KitTheme, opts?: Record<string, unknown>): LintResult;
  listVendorThemeIds(): string[];
  readThemeDir(dir: string): Record<string, Buffer>;
  computeContentHash(files: Record<string, Buffer>): string;
  categoryById(id: string): KitCategory;
  hasCategory(id: string): boolean;
  variantFor(categoryId: string): { id: string; motion?: string } | string;
  sampleContent(categoryId: string, opts?: { lang?: 'en' | 'ta' }): Record<string, unknown>;
  /** the kit's category map (legacy pack key -> kit categories); read from the build, never edited here */
  categoryMap(): { packs: Record<string, string[]> };
  CATEGORIES: KitCategory[];
}

function backendRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'prisma'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('renderer-loader: could not find the backend root');
}

const MARKER = '.g4d-renderer-build.json';
const hasBuild = (dir: string): boolean => fs.existsSync(path.join(dir, MARKER)) && fs.existsSync(path.join(dir, 'lib', 'render.cjs'));

/** The folder holding the built renderer, building a cache copy first when allowed and needed. */
export function rendererDir(): string {
  const root = backendRoot();
  const fromEnv = process.env.RENDERER_DIR;
  if (fromEnv) {
    if (!hasBuild(fromEnv)) throw new Error(`RENDERER_DIR ${fromEnv} does not hold a renderer build`);
    return fromEnv;
  }
  const dist = path.join(root, 'dist', 'renderer');
  if (hasBuild(dist)) return dist;
  if (process.env.NODE_ENV === 'production') throw new Error('The theme renderer build (dist/renderer) is missing. Run npm run build.');
  const builder = require(path.join(root, 'scripts', 'build-renderer.js')) as { build(out: string): unknown; sourceHash(): string };
  const cache = path.join(os.tmpdir(), `g4d-renderer-${builder.sourceHash().slice(0, 16)}`);
  if (!hasBuild(cache)) builder.build(cache);
  return cache;
}

let cached: { dir: string; kit: Kit } | null = null;

export function loadKit(): Kit {
  const dir = rendererDir();
  if (cached && cached.dir === dir) return cached.kit;
  const at = (rel: string): Record<string, unknown> => require(path.join(dir, rel)) as Record<string, unknown>;
  const render = at('lib/render.cjs'); const theme = at('lib/theme.cjs'); const lint = at('lib/lint.cjs'); const pack = at('lib/pack.cjs');
  const cats = at('lib/categories.cjs'); const fixtures = at('fixtures/index.cjs');
  const kit = {
    renderPage: render.renderPage, listingOnlyHtml: render.listingOnlyHtml, loadTheme: theme.loadTheme, listVendorThemeIds: theme.listVendorThemeIds, lintTheme: lint.lintTheme,
    readThemeDir: pack.readThemeDir, computeContentHash: pack.computeContentHash,
    categoryById: cats.categoryById, hasCategory: cats.hasCategory, variantFor: cats.variantFor, CATEGORIES: cats.CATEGORIES, sampleContent: fixtures.sampleContent,
    categoryMap: () => JSON.parse(fs.readFileSync(path.join(dir, 'data', 'category-map.json'), 'utf8')) as { packs: Record<string, string[]> },
  } as unknown as Kit;
  cached = { dir, kit };
  return kit;
}
