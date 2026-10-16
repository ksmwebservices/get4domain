import { CONTRACT, CONTRAST_PAIRS, contrast } from './contract';
import { PackageFile, SanitiseResult, TemplateAnalysis, sanitisePackage, REACT_ADVICE, validateManifest } from './sanitise';
import { sanitiseCss } from './css';
import { sanitiseHtml } from './html';

/**
 * The lint: what the admin upload and KSM's command line both say about a theme, in plain sentences. It never needs a server. A "problem" blocks the upload; a "warning"
 * does not, but the theme will look thinner or behave worse than it could.
 */
export interface LintLine { level: 'pass' | 'warn' | 'error' | 'info'; text: string }
export interface LintReport { lines: LintLine[]; errors: number; warnings: number; ok: boolean; result: SanitiseResult; contrast: { what: string; ratio: number | null; ok: boolean }[] }

const text = (d: Uint8Array): string => Buffer.from(d).toString('utf8');
const COLOR_KEYS: Record<string, string> = { bg: '--g4d-bg', fg: '--g4d-fg', muted: '--g4d-muted', accent: '--g4d-accent', accentFg: '--g4d-accent-fg' };

/** Colours of the theme: the manifest's "colors", else --g4d-* variables written in theme.css. */
export function themeColors(files: PackageFile[], manifest?: { colors?: Record<string, string | undefined>; cssVars?: Record<string, string> }): Record<string, string> {
  const out: Record<string, string> = {};
  const css = files.find((f) => f.path === 'theme.css');
  const src = css ? text(css.data) : '';
  for (const [k, v] of Object.entries(COLOR_KEYS)) {
    const fromManifest = manifest?.colors?.[k] ?? manifest?.cssVars?.[v];
    const m = new RegExp(`${v}\\s*:\\s*(#[0-9a-fA-F]{3,6})`).exec(src);
    const c = fromManifest ?? m?.[1];
    if (c) out[k] = c;
  }
  return out;
}

/** Which of a family's signature items the templates actually have. */
function covers(an: Record<string, TemplateAnalysis>, token: string): boolean {
  const all = Object.values(an);
  if (token === 'hero.title') return all.some((a) => a.slots.includes('hero.title'));
  if (token === 'hero.cta') return all.some((a) => a.tags.includes('g4d-action') || a.slots.includes('cta.label'));
  if (token === 'hours') return all.some((a) => a.slots.includes('hours') || a.tags.includes('g4d-hours'));
  if (token === 'groups') return all.some((a) => a.each.some((e) => e === 'groups') || a.tags.includes('g4d-tabs'));
  return all.some((a) => a.each.includes(token));
}

export function lintPackage(files: PackageFile[]): LintReport {
  const lines: LintLine[] = [];
  const result = sanitisePackage(files);
  const push = (level: LintLine['level'], t: string): void => { lines.push({ level, text: t }); };
  const contrastOut: LintReport['contrast'] = [];

  for (const e of result.errors) push('error', e);
  if (result.reactProject) push('info', 'To continue: ' + REACT_ADVICE);
  if (!result.ok || !result.package) {
    for (const s of result.stripped) push('warn', `Would be removed: ${s}`);
    for (const w of result.warnings) push('warn', w);
    return { lines, errors: lines.filter((l) => l.level === 'error').length, warnings: lines.filter((l) => l.level === 'warn').length, ok: false, result, contrast: contrastOut };
  }
  const pkg = result.package;
  const m = pkg.manifest;
  push('pass', `theme.json is valid: "${m.name}" (${m.id}) version ${m.version}, for ${m.families.join(', ')}; categories ${m.categories.join(', ')}.`);
  push('pass', `${Object.keys(pkg.pages).length} page template(s): ${Object.keys(pkg.pages).join(', ')}.`);
  if (pkg.assets.length) push('pass', `${pkg.assets.length} picture(s) and font(s) are inside the package and within the size limits.`);
  push('pass', 'The stylesheet was read and scoped to this theme (it cannot style any other site or the dashboard).');

  for (const s of result.stripped) push('warn', `Stripped on import: ${s}`);
  for (const w of result.warnings) push('warn', w);

  // slots and tags per declared family
  const an = pkg.analysis;
  for (const fam of m.families) {
    const sig = CONTRACT.familyPages[fam];
    if (!sig) continue;
    const missingPages = sig.pages.filter((p) => !pkg.pages[p]);
    if (missingPages.length) push('warn', `For ${fam} themes the expected pages are ${sig.pages.map((p) => `${p}.html`).join(', ')}. Missing: ${missingPages.map((p) => `${p}.html`).join(', ')}.`);
    for (const tok of sig.home) if (!covers(an, tok)) push('warn', `${fam}: no page shows ${tok === 'hero.title' ? 'the hero title ({{hero.title}})' : tok === 'hero.cta' ? 'a main action (<g4d-action>)' : tok === 'hours' ? 'opening hours (<g4d-hours> or {{hours}})' : `the ${tok} list (data-g4d-each="${tok}")`}, which this kind of business is expected to have.`);
    for (const t of sig.tags) if (!Object.values(an).some((a) => a.tags.includes(t))) push('warn', `${fam}: <${t}> is not used anywhere. Place it where the engine should draw that part (see the contract).`);
  }
  for (const t of CONTRACT.requiredTags) if (!Object.values(an).some((a) => a.tags.includes(t))) push('info', `<${t}> is not placed in your pages. The engine adds it itself, because every site needs it.`);
  if (!Object.values(an).some((a) => a.slots.includes('site.name') || a.slots.includes('site.logo'))) push('warn', 'No page shows the business name or logo ({{site.name}}, {{site.logo}}).');
  for (const [t, a] of Object.entries(an)) {
    if (a.each.includes('testimonials') && !a.ifs.includes('testimonials')) push('warn', `${t}.html lists testimonials without data-g4d-if="testimonials". Wrap the block so it is hidden when there are none (sample reviews are never shown to the public).`);
    if (a.h1 === 0 && !['page'].includes(t)) push('warn', `${t}.html has no <h1>. Every page needs exactly one main heading.`);
    if (a.h1 > 1) push('warn', `${t}.html has ${a.h1} <h1> headings. Keep one; the engine turns the extra ones into <h2>.`);
    if (a.imgNoAlt > 0) push('warn', `${t}.html has ${a.imgNoAlt} picture(s) without alt text. Decorative pictures should say alt="".`);
  }

  // colours and contrast (AA 4.5:1)
  const colors = themeColors(files, m);
  for (const [what, a, b] of CONTRAST_PAIRS) {
    if (!colors[a] || !colors[b]) continue;
    const r = contrast(colors[a], colors[b]);
    const okc = r !== null && r >= 4.5;
    contrastOut.push({ what, ratio: r === null ? null : Math.round(r * 100) / 100, ok: okc });
    if (!okc) push('warn', `Contrast: ${what} is ${r === null ? 'not a plain hex colour' : `${r.toFixed(2)}:1`}; it must be at least 4.5:1 (WCAG AA).`);
  }
  if (!contrastOut.length) push('info', 'Contrast could not be checked. Add "colors": {"bg","fg","muted","accent","accentFg"} to theme.json (plain #hex values) so the admin screen can check it.');
  else if (contrastOut.every((c) => c.ok)) push('pass', `Colour contrast passes AA on ${contrastOut.length} pair(s).`);
  const errors = lines.filter((l) => l.level === 'error').length;
  return { lines, errors, warnings: lines.filter((l) => l.level === 'warn').length, ok: errors === 0, result, contrast: contrastOut };
}

export const formatReport = (r: LintReport): string => r.lines.map((l) => `${l.level === 'pass' ? 'PASS ' : l.level === 'warn' ? 'WARN ' : l.level === 'error' ? 'FAIL ' : 'NOTE '} ${l.text}`).join('\n');

/**
 * Safe automatic fixes (the lint command's --fix). It renames index.html to home.html, writes a first theme.json when there is none, removes scripts and event handlers from the
 * pages, writes the stylesheet already scoped, and turns very small pictures into inline data so there are fewer files. It never changes a picture's content or a page's text.
 */
export function fixPackage(input: PackageFile[], folderName: string): { files: PackageFile[]; notes: string[] } {
  const notes: string[] = [];
  let files = input.map((f) => ({ ...f }));
  const has = (p: string): boolean => files.some((f) => f.path === p);
  if (!has('home.html') && has('index.html')) { files = files.map((f) => (f.path === 'index.html' ? { ...f, path: 'home.html' } : f)); notes.push('Renamed index.html to home.html.'); }
  const templates = files.filter((f) => /^[a-z0-9-]+\.html$/.test(f.path)).map((f) => f.path.replace(/\.html$/, '')).filter((t) => CONTRACT.pageTemplates.includes(t));
  if (!has('theme.json')) {
    const id = folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'my-theme';
    const pages = templates.filter((t) => !['home', 'item', 'page'].includes(t)).map((t) => ({ slug: CONTRACT.standardSlugs[t] || t, template: t, title: t.charAt(0).toUpperCase() + t.slice(1) }));
    const manifest = { id: id.length < 3 ? `${id}-theme` : id, name: id.replace(/-/g, ' ').replace(/\w/g, (c) => c.toUpperCase()), version: 1, author: 'Unknown', families: ['enquiry'], categories: ['general'], pages };
    files.push({ path: 'theme.json', data: Buffer.from(JSON.stringify(manifest, null, 2)) });
    notes.push('Wrote a first theme.json. EDIT it: set the real families and categories, the author and the name.');
  }
  let manifestId = 'my-theme';
  try { manifestId = (JSON.parse(text(files.find((f) => f.path === 'theme.json')!.data)) as { id?: string }).id ?? manifestId; } catch { /* the lint will say so */ }
  // script files out
  const before = files.length;
  files = files.filter((f) => !/\.(js|mjs|cjs|map|ts|tsx|jsx)$/i.test(f.path));
  if (files.length < before) notes.push(`Removed ${before - files.length} script file(s).`);
  const assetPaths = new Set(files.filter((f) => f.path.startsWith('assets/')).map((f) => f.path));
  // pages: scripts, handlers and outside addresses out; very small pictures inline
  const smallInlined = new Set<string>();
  for (const f of files.filter((x) => /^[a-z0-9-]+\.html$/.test(x.path))) {
    const h = sanitiseHtml(text(f.data), { file: f.path, assetPaths });
    if (h.errors.length) continue;
    let html = h.html.replace(/asset:\/\//g, '');
    for (const a of files.filter((x) => assetPaths.has(x.path) && x.data.byteLength <= 4000 && /\.(png|webp|svg)$/i.test(x.path))) {
      const mime = a.path.endsWith('.svg') ? 'image/svg+xml' : a.path.endsWith('.png') ? 'image/png' : 'image/webp';
      const uri = `data:${mime};base64,${Buffer.from(a.data).toString('base64')}`;
      if (html.includes(`src="${a.path}"`)) { html = html.split(`src="${a.path}"`).join(`src="${uri}"`); smallInlined.add(a.path); }
    }
    const next = `<!doctype html>
<html lang="en"><body>
${html}
</body></html>
`;
    if (h.stripped.length || smallInlined.size) { f.data = Buffer.from(next); if (h.stripped.length) notes.push(`${f.path}: removed ${h.stripped.length} unsafe or outside item(s).`); }
  }
  if (smallInlined.size) notes.push(`Turned ${smallInlined.size} very small picture(s) into inline data (${[...smallInlined].join(', ')}).`);
  // stylesheet: every rule scoped to this theme (the import does the same; this just writes it down)
  const css = files.find((f) => f.path === 'theme.css');
  if (css) {
    const c = sanitiseCss(text(css.data), { scope: `.g4d-theme-${manifestId}`, assetPaths, googleFonts: [], file: 'theme.css' });
    if (!c.errors.length && c.css) {
      const back = c.css.replace(/asset:\/\//g, '');
      if (back !== text(css.data).trim()) { css.data = Buffer.from(`${back}\n`); notes.push('Wrote theme.css with every rule scoped to this theme.'); }
    }
  }
  return { files, notes };
}

export { validateManifest };
