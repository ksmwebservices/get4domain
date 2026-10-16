import { unzipSync, zipSync } from 'fflate';
import { CONTRACT, THEME_ID_RE, templateFile } from './contract';
import { sanitiseCss } from './css';
import { sanitiseHtml, HtmlResult } from './html';

/**
 * The package door. Takes the files of a theme (a zip, or a folder read into memory), checks the manifest, makes every page template and the stylesheet safe, checks the
 * pictures and fonts, and either returns a clean package or says in plain sentences why not. The same function runs in the admin upload and in the lint command.
 */
export interface PackageFile { path: string; data: Uint8Array }
export interface ManifestPage { slug: string; template: string; title: string; nav?: boolean; navLabel?: string }
export interface Manifest {
  id: string; name: string; version: number; author: string; description?: string;
  families: string[]; categories: string[];
  pages: ManifestPage[];
  itemsPage?: string;
  cssVars?: Record<string, string>;
  colors?: { bg?: string; fg?: string; muted?: string; accent?: string; accentFg?: string };
  googleFonts?: string[];
}
export interface AssetFile { path: string; mime: string; bytes: number; data: Uint8Array }
export interface TemplateAnalysis { slots: string[]; tags: string[]; each: string[]; ifs: string[]; h1: number; imgNoAlt: number; externalLinks: number; usesBody: boolean }
export interface SanitisedPackage {
  manifest: Manifest;
  pages: Record<string, string>;
  css: string;
  assets: AssetFile[];
  preview?: AssetFile;
  googleFonts: string[];
  analysis: Record<string, TemplateAnalysis>;
}
export interface SanitiseResult {
  ok: boolean; errors: string[]; warnings: string[]; stripped: string[];
  package?: SanitisedPackage;
  reactProject: boolean;
  unusedAssets: string[];
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', woff2: 'font/woff2', woff: 'font/woff' };
const SCRIPT_EXT = /\.(js|mjs|cjs|ts|tsx|jsx|map|vue|svelte)$/i;

const startsWith = (b: Uint8Array, sig: number[]): boolean => sig.every((v, i) => b[i] === v);
function sniff(data: Uint8Array): string | null {
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (startsWith(data, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(data, [0x52, 0x49, 0x46, 0x46]) && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) return 'webp';
  if (startsWith(data, [0x77, 0x4f, 0x46, 0x32])) return 'woff2';
  if (startsWith(data, [0x77, 0x4f, 0x46, 0x46])) return 'woff';
  const head = Buffer.from(data.slice(0, 400)).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'svg';
  return null;
}

/** A picture drawn as SVG is allowed only when it holds no script and no outside reference. */
export function svgProblem(text: string): string | null {
  if (/<script|<foreignobject|<iframe|<object|<embed|<!entity|<!doctype[^>]*\[/i.test(text)) return 'it contains a script, a frame or an embedded object';
  if (/\son\w+\s*=/i.test(text)) return 'it contains an event handler';
  if (/javascript:|vbscript:/i.test(text)) return 'it contains a script address';
  if (/(?:href|src)\s*=\s*["']?\s*(?:https?:)?\/\//i.test(text) || /url\(\s*["']?\s*(?:https?:)?\/\//i.test(text)) return 'it refers to something outside the package';
  if (/<(?:animate|set)\b/i.test(text)) return 'it contains an animation element that can change links';
  return null;
}

export function normalisePath(p: string): string | null {
  const q = p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
  if (q.startsWith('/') || q.split('/').some((s) => s === '..')) return null;
  return q;
}

/** Reads a zip into files. A zip that holds everything inside one top folder is unwrapped. */
export function readZip(buf: Uint8Array): { files: PackageFile[]; error?: string } {
  let raw: Record<string, Uint8Array>;
  try { raw = unzipSync(buf); } catch { return { files: [], error: 'This file is not a readable zip. Make the zip from the theme folder itself (theme.json, home.html and theme.css at the top).' }; }
  let files: PackageFile[] = [];
  for (const [name, data] of Object.entries(raw)) {
    if (name.endsWith('/')) continue;
    const p = normalisePath(name);
    if (!p) return { files: [], error: `The zip contains a path that is not allowed (${name}). Remove it and zip again.` };
    if (/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)(\/|$)/.test(p)) continue;
    files.push({ path: p, data });
  }
  files = unwrapFolder(files);
  return { files };
}

export function unwrapFolder(files: PackageFile[]): PackageFile[] {
  if (files.some((f) => f.path === 'theme.json' || f.path === 'home.html' || f.path === 'index.html')) return files;
  const tops = new Set(files.map((f) => f.path.split('/')[0]));
  if (tops.size === 1 && files.every((f) => f.path.includes('/'))) { const t = [...tops][0]; return files.map((f) => ({ path: f.path.slice(t.length + 1), data: f.data })); }
  return files;
}

export function makeZip(files: PackageFile[]): Uint8Array {
  const o: Record<string, Uint8Array> = {};
  for (const f of files) o[f.path] = f.data;
  return zipSync(o, { level: 6 });
}

const text = (d: Uint8Array): string => Buffer.from(d).toString('utf8');
const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Checks theme.json. Plain sentences. */
export function validateManifest(raw: unknown, templates: string[]): { manifest?: Manifest; errors: string[]; warnings: string[] } {
  const errors: string[] = []; const warnings: string[] = [];
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null) as Record<string, unknown> | null;
  if (!o) return { errors: ['theme.json is not a JSON object.'], warnings };
  const str = (k: string, max: number): string => { const v = o[k]; return typeof v === 'string' ? v.trim().slice(0, max) : ''; };
  const id = str('id', 40);
  if (!THEME_ID_RE.test(id) || id.length < 3) errors.push('theme.json "id" must be 3 to 40 letters, numbers and dashes, in lower case (for example "clinic-calm").');
  const name = str('name', 80); if (name.length < 2) errors.push('theme.json "name" is missing (the name vendors will see).');
  const author = str('author', 80); if (!author) errors.push('theme.json "author" is missing.');
  const version = typeof o.version === 'number' && Number.isInteger(o.version) && o.version >= 1 ? o.version : null;
  if (version === null) errors.push('theme.json "version" must be a whole number from 1 (raise it each time you upload a new version of the same theme).');
  const families = Array.isArray(o.families) ? o.families.filter((f): f is string => typeof f === 'string') : [];
  if (!families.length || !families.every((f) => CONTRACT.families.includes(f))) errors.push(`theme.json "families" must list at least one of: ${CONTRACT.families.join(', ')}.`);
  const categories = Array.isArray(o.categories) ? o.categories.filter((c): c is string => typeof c === 'string' && THEME_ID_RE.test(c)) : [];
  if (!categories.length) errors.push('theme.json "categories" must list the categories this theme is for (for example ["clinic", "diagnostics"]). A theme works only for the categories it declares.');
  let pages: ManifestPage[] = [];
  if (Array.isArray(o.pages)) {
    for (const p of o.pages as Record<string, unknown>[]) {
      const template = typeof p?.template === 'string' ? p.template.replace(/\.html$/, '') : '';
      const slug = typeof p?.slug === 'string' ? p.slug.trim().replace(/^\/+|\/+$/g, '') : '';
      if (!CONTRACT.pageTemplates.includes(template) || template === 'item' || template === 'page' || template === 'home') { errors.push(`theme.json lists a page template "${String(p?.template)}" that is not one of the standard ones (${CONTRACT.pageTemplates.filter((t) => !['home', 'item', 'page'].includes(t)).join(', ')}).`); continue; }
      if (!templates.includes(template)) { errors.push(`theme.json lists the page "${template}" but ${templateFile(template)} is not in the package.`); continue; }
      pages.push({ slug: slug || CONTRACT.standardSlugs[template] || template, template, title: typeof p.title === 'string' ? p.title.slice(0, 60) : titleCase(template), nav: p.nav !== false, navLabel: typeof p.navLabel === 'string' ? p.navLabel.slice(0, 24) : undefined });
    }
  } else {
    pages = templates.filter((t) => !['home', 'item', 'page'].includes(t)).map((t) => ({ slug: CONTRACT.standardSlugs[t] || t, template: t, title: titleCase(t), nav: true }));
    if (pages.length) warnings.push('theme.json has no "pages" list, so the pages were taken from the files that are in the package.');
  }
  const slugs = pages.map((p) => p.slug);
  if (new Set(slugs).size !== slugs.length) errors.push('Two pages in theme.json use the same address (slug).');
  if (pages.some((p) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug) || ['book', 'enquire', 'order', 'legal', 'p', 'api'].includes(p.slug))) errors.push('A page address (slug) in theme.json is not allowed. Use lower-case letters, numbers and dashes; book, enquire, order, legal and p are used by the engine.');
  if (pages.length + 1 > CONTRACT.limits.maxPages) errors.push(`A theme can have at most ${CONTRACT.limits.maxPages} pages.`);
  const itemsPage = typeof o.itemsPage === 'string' ? o.itemsPage : pages.find((p) => CONTRACT.itemPages.includes(p.template))?.slug;
  if (itemsPage && !pages.some((p) => p.slug === itemsPage)) errors.push(`theme.json "itemsPage" (${itemsPage}) is not one of the pages.`);
  const googleFonts = Array.isArray(o.googleFonts) ? o.googleFonts.filter((u): u is string => typeof u === 'string') : [];
  if (googleFonts.some((u) => !u.startsWith(CONTRACT.googleFontsPrefix))) errors.push(`theme.json "googleFonts" may only hold addresses that start with ${CONTRACT.googleFontsPrefix}.`);
  const cssVars: Record<string, string> = {};
  if (o.cssVars && typeof o.cssVars === 'object') for (const [k, v] of Object.entries(o.cssVars as Record<string, unknown>)) { if (/^--[\w-]+$/.test(k) && typeof v === 'string' && v.length < 200 && !/[<>{};]|url\(|expression/i.test(v)) cssVars[k] = v; else warnings.push(`theme.json cssVars: "${k}" was left out (use names like --g4d-accent and plain values).`); }
  const colors = o.colors && typeof o.colors === 'object' ? (o.colors as Manifest['colors']) : undefined;
  if (errors.length) return { errors, warnings };
  return { manifest: { id, name, version: version as number, author, description: str('description', 300) || undefined, families, categories, pages, itemsPage, cssVars, colors, googleFonts: googleFonts.length ? googleFonts : undefined }, errors, warnings };
}

/** Looks for the signs of a React, Vite or Next project. */
export function looksLikeReactProject(files: PackageFile[]): boolean {
  if (files.some((f) => /(^|\/)(package\.json|vite\.config\.\w+|next\.config\.\w+|tsconfig\.json)$/.test(f.path))) return true;
  if (files.some((f) => /\.(tsx|jsx)$/.test(f.path) || /(^|\/)node_modules\//.test(f.path))) return true;
  const idx = files.find((f) => /(^|\/)index\.html$/.test(f.path));
  return !!idx && /<div[^>]+id=["']root["']|<script[^>]+type=["']module["']/i.test(text(idx.data));
}

export const REACT_ADVICE = 'This looks like a React, Vite or Next.js project. Themes must be plain HTML and CSS, because a theme is filled with each vendor\'s own content on the server and cannot run scripts. Ask your design tool again, for example: "Export this as static HTML and CSS only: one .html file per page, one theme.css, an assets folder, no JavaScript, no framework, no build step." Then follow the contract in docs/v2/THEME_PROMPTS.md.';

export function sanitisePackage(input: PackageFile[]): SanitiseResult {
  const result: SanitiseResult = { ok: false, errors: [], warnings: [], stripped: [], reactProject: false, unusedAssets: [] };
  const files = unwrapFolder(input);
  const L = CONTRACT.limits;
  const total = files.reduce((n, f) => n + f.data.byteLength, 0);
  if (files.length > L.maxFiles) { result.errors.push(`The package has ${files.length} files; the limit is ${L.maxFiles}.`); return result; }
  if (total > L.packageBytes) { result.errors.push(`The package is ${(total / 1048576).toFixed(1)} MB; the limit is ${(L.packageBytes / 1048576).toFixed(0)} MB. Shrink the pictures (WebP at 1600 px wide is usually plenty).`); return result; }
  if (looksLikeReactProject(files)) { result.reactProject = true; result.errors.push(REACT_ADVICE); return result; }

  const byPath = new Map(files.map((f) => [f.path, f]));
  // pictures and fonts
  const assets: AssetFile[] = []; let preview: AssetFile | undefined;
  for (const f of files) {
    const isAsset = f.path.startsWith('assets/');
    const isPreview = /^preview\.(png|jpg|jpeg|webp)$/i.test(f.path);
    if (!isAsset && !isPreview) continue;
    const ext = (f.path.split('.').pop() ?? '').toLowerCase();
    if (SCRIPT_EXT.test(f.path)) { result.stripped.push(`${f.path} (a script file: themes cannot run scripts)`); continue; }
    const kind = sniff(f.data);
    if (!MIME[ext] || !kind || (kind !== (ext === 'jpeg' ? 'jpg' : ext))) { result.errors.push(`${f.path} is not an allowed picture or font. Allowed: PNG, JPG, WebP, SVG without scripts, and WOFF2 or WOFF fonts. Convert it (a GIF or AVIF becomes a WebP).`); continue; }
    const max = kind === 'woff2' || kind === 'woff' ? L.fontBytes : L.imageBytes;
    if (f.data.byteLength > max) { result.errors.push(`${f.path} is ${(f.data.byteLength / 1024).toFixed(0)} KB; the limit is ${Math.round(max / 1024)} KB. Resize or compress it.`); continue; }
    if (kind === 'svg') { const why = svgProblem(text(f.data)); if (why) { result.errors.push(`${f.path} is rejected: ${why}. Export the SVG again as plain shapes.`); continue; } }
    const a: AssetFile = { path: f.path, mime: MIME[kind], bytes: f.data.byteLength, data: f.data };
    if (isPreview) preview = a; else assets.push(a);
  }
  const assetPaths = new Set(assets.map((a) => a.path));

  // templates
  const templateFiles = files.filter((f) => /^[a-z0-9-]+\.html$/i.test(f.path));
  const templates: string[] = [];
  for (const f of templateFiles) {
    const t = f.path.replace(/\.html$/i, '').toLowerCase();
    if (t === 'index' && !byPath.has('home.html')) { result.errors.push('index.html found but there is no home.html. Rename index.html to home.html (the lint command can do it: --fix).'); continue; }
    if (!CONTRACT.pageTemplates.includes(t)) { result.warnings.push(`${f.path} is not a page template the engine uses and was left out. Page templates: ${CONTRACT.pageTemplates.map(templateFile).join(', ')}.`); continue; }
    templates.push(t);
  }
  if (!templates.includes('home')) { if (!result.errors.some((e) => e.includes('index.html'))) result.errors.push('home.html is missing. Every theme needs a home page.'); }

  // manifest
  let manifestRaw: unknown = null;
  const mf = byPath.get('theme.json');
  if (!mf) result.errors.push('theme.json is missing. It names the theme, its version, the families and categories it is for and its pages. See docs/v2/THEME_CONTRACT.md (the lint command can write a first one: --fix).');
  else { try { manifestRaw = JSON.parse(text(mf.data)); } catch (e) { result.errors.push(`theme.json is not valid JSON: ${(e as Error).message}.`); } }
  const vm = manifestRaw ? validateManifest(manifestRaw, templates) : { errors: [] as string[], warnings: [] as string[], manifest: undefined as Manifest | undefined };
  result.errors.push(...vm.errors); result.warnings.push(...vm.warnings);
  const manifest = vm.manifest;
  if (!manifest) return result;
  if (!templates.includes('page')) result.warnings.push('There is no page.html. Vendors add their own pages (offers, policies, careers); without page.html those pages use a plain page in your colours.');
  if (!templates.includes('item')) result.warnings.push('There is no item.html. Each service, product, package or property then has no page of its own, which costs search traffic.');
  if (templates.filter((t) => !['page', 'item'].includes(t)).length <= 1) result.warnings.push('The theme has only a home page. A multi-page theme (about, the main list, gallery, contact) gives vendors a real website; a home-only theme works but is thin.');

  // stylesheet
  const scope = `.g4d-theme-${manifest.id}`;
  const cssFile = byPath.get('theme.css');
  let css = ''; const usedAssets = new Set<string>(); let fontsUsed: string[] = [];
  if (!cssFile) result.warnings.push('theme.css is missing; the theme will have no styling.');
  else {
    const c = sanitiseCss(text(cssFile.data), { scope, assetPaths, googleFonts: manifest.googleFonts ?? [], file: 'theme.css' });
    result.errors.push(...c.errors); result.warnings.push(...c.warnings); result.stripped.push(...c.stripped.map((s) => `theme.css: ${s}`));
    css = c.css; c.usedAssets.forEach((a) => usedAssets.add(a)); fontsUsed = c.googleFontsUsed;
  }
  for (const f of files) if (/\.css$/i.test(f.path) && f.path !== 'theme.css') result.warnings.push(`${f.path} was left out. Put all styles in theme.css.`);
  for (const f of files) if (SCRIPT_EXT.test(f.path) && !f.path.startsWith('assets/')) result.stripped.push(`${f.path} (a script file: themes cannot run scripts)`);

  const pages: Record<string, string> = {}; const analysis: Record<string, TemplateAnalysis> = {};
  for (const t of templates) {
    const f = byPath.get(templateFile(t));
    if (!f) continue;
    const h: HtmlResult = sanitiseHtml(text(f.data), { file: templateFile(t), assetPaths });
    result.errors.push(...h.errors); result.warnings.push(...h.warnings); result.stripped.push(...h.stripped);
    h.usedAssets.forEach((a) => usedAssets.add(a));
    pages[t] = h.html;
    analysis[t] = { slots: [...h.slots], tags: [...h.tags], each: [...h.each], ifs: [...h.ifs], h1: h.h1, imgNoAlt: h.imgNoAlt, externalLinks: h.externalLinks, usesBody: h.hasBody };
  }
  // pictures nobody refers to are dropped
  const kept = assets.filter((a) => usedAssets.has(a.path) || /^assets\/fonts\//.test(a.path) || usedAssets.size === 0);
  result.unusedAssets = assets.filter((a) => !kept.includes(a)).map((a) => a.path);
  if (result.unusedAssets.length) result.warnings.push(`${result.unusedAssets.length} file(s) in assets/ are not used by any page or by theme.css and were left out: ${result.unusedAssets.slice(0, 4).join(', ')}.`);
  if (result.errors.length) return result;
  result.package = { manifest, pages, css, assets: kept, preview, googleFonts: fontsUsed, analysis };
  result.ok = true;
  return result;
}
