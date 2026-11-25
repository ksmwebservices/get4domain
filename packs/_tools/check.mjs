// Builds and verifies one pack, step by step (never two heavy commands at once):
//   1 generate the pack folder from pack.mjs    2 check content.json    3 palette contrast    4 look signature
//   5 lint on a clean staged copy (no content.json), with the real-browser overflow check at 360 to 1536
//   6 preview pages + screenshots at 360, 768 and 1280, preview images into assets/previews
//   7 pack to a zip and run validate-package on it
// Usage: node packs/_tools/check.mjs <family>/<type> [--no-browser] [--skip-shots]
import fs from 'node:fs';
import path from 'node:path';
import { PACKS_ROOT, loadSpec, writePack, buildThemeFiles, PREVIEW_FILES } from './gen.mjs';
import { contentToModel } from './model.mjs';
import { ratio } from '../../themes/lib/contrast.mjs';
import { themeFromFiles } from '../../themes/lib/theme.mjs';
import { lintTheme, lintThemeBrowser, formatReport } from '../../themes/lib/lint.mjs';
import { renderPage } from '../../themes/lib/render.mjs';
import { pageDocument } from '../../themes/lib/document.mjs';
import { openBrowser, screenshot } from '../../themes/lib/browser.mjs';
import { packFiles, validatePackage, readThemeDir } from '../../themes/lib/pack.mjs';
import { ENTITLEMENTS_OFF } from '../../themes/fixtures/index.mjs';

const rel = process.argv[2];
const flag = (f) => process.argv.includes(f);
if (!rel) { console.error('Usage: node packs/_tools/check.mjs <family>/<type> [--no-browser] [--skip-shots]'); process.exit(2); }
const dir = path.join(PACKS_ROOT, rel);
const fail = (m) => { console.error(`FAIL ${m}`); process.exit(1); };
const step = (m) => console.log(`\n== ${m}`);

// 1 ---------------------------------------------------------------
step('1 generate');
const spec = await loadSpec(rel);
writePack(dir, spec);
const themeFiles = () => Object.fromEntries(Object.entries(readThemeDir(dir)).filter(([p]) => !['content.json', 'pack.mjs', 'content.mjs'].includes(p)));

// 2 ---------------------------------------------------------------
step('2 content.json');
const problems = [];
const c = JSON.parse(fs.readFileSync(path.join(dir, 'content.json'), 'utf8'));
const variantsOk = (v, where, min = 3) => { if (!Array.isArray(v) || new Set(v).size < min) problems.push(`${where}: needs at least ${min} different wording variants`); };
if (c.schema !== 'g4d-pack-content/1') problems.push('schema must be g4d-pack-content/1');
for (const k of ['title', 'description']) variantsOk(c.seo?.[k], `seo.${k}`);
for (const k of ['title', 'subtitle', 'bannerText']) variantsOk(c.hero?.[k], `hero.${k}`);
variantsOk(c.about?.text, 'about.text');
const slugs = new Set(c.items.map((i) => i.slug));
for (const s of c.hero.serviceLinks ?? []) if (!slugs.has(s)) problems.push(`hero.serviceLinks: unknown item ${s}`);
const groupSlugs = new Set(c.groups.map((g) => g.slug));
for (const it of c.items) {
  const w = `item ${it.slug}`;
  variantsOk(it.summary, `${w} summary`); variantsOk(it.description, `${w} description`);
  if (!groupSlugs.has(it.group)) problems.push(`${w}: unknown group ${it.group}`);
  if ((it.highlights ?? []).length < 2) problems.push(`${w}: needs at least 2 highlights`);
  if ((it.details ?? []).length < 2) problems.push(`${w}: needs at least 2 details`);
  if ((it.faqs ?? []).length < 2) problems.push(`${w}: needs at least 2 FAQs`);
  for (const f of it.faqs ?? []) variantsOk(f.a, `${w} FAQ "${f.q}"`);
  if (it.priceFrom && it.priceFrom.indicative !== true) problems.push(`${w}: price must be marked indicative`);
  for (const r of it.related ?? []) if (!slugs.has(r)) problems.push(`${w}: unknown related item ${r}`);
}
for (const f of c.faqs) variantsOk(f.a, `FAQ "${f.q}"`);
if (c.faqs.length < 5) problems.push('needs at least 5 page-level FAQs');
const raw = JSON.stringify(c);
if (/\{\{|\}\}/.test(raw)) problems.push('content.json must not contain {{ }} (use [[placeholder]])');
if (/testimonial|award|licen[cs]e no/i.test(Object.keys(c).join(' '))) problems.push('no testimonial, award or licence-number fields');
for (const need of ['vendor_name', 'owner', 'town', 'area', 'branches']) if (!(need in c.placeholders)) problems.push(`placeholders.${need} missing`);
for (const m of raw.matchAll(/\[\[(\w+)\]\]/g)) if (!(m[1] in c.placeholders)) problems.push(`unknown placeholder [[${m[1]}]]`);
if (!/\[\[vendor_name\]\]/.test(JSON.stringify(c.hero.title)) || !/\[\[town\]\]/.test(JSON.stringify(c.hero.title))) problems.push('every hero title variant should carry vendor name and town');
for (const t of c.hero.title) if (!t.includes('[[vendor_name]]') || !t.includes('[[town]]') && !t.includes('[[area]]')) problems.push(`hero.title variant lacks vendor name or town: "${t}"`);
if (problems.length) fail(`content.json:\n  ${problems.join('\n  ')}`);
console.log('ok');

// 3 ---------------------------------------------------------------
step('3 palette contrast (kit AA 4.5:1)');
for (const mode of ['light', 'dark']) {
  const p = spec.palette[mode];
  const pairs = [['text on bg', p.text, p.bg], ['text on surface', p.text, p.surface], ['muted on bg', p.muted, p.bg], ['muted on surface', p.muted, p.surface], ['muted on tint', p.muted, p.tint], ['accent on bg', p.accent, p.bg], ['accent on surface', p.accent, p.surface], ['primary-contrast on primary', p.primaryContrast, p.primary], ['on-accent on accent', p.onAccent, p.accent], ['primary on bg', p.primary, p.bg], ['primary on surface', p.primary, p.surface], ['warm on deep', p.warm, p.deep], ['text on tint', p.text, p.tint]];
  for (const [n, a, b] of pairs) { const r = ratio(a, b); if (r < 4.5) problems.push(`${mode} ${n}: ${r.toFixed(2)}`); }
}
if (problems.length) fail(`palette:\n  ${problems.join('\n  ')}`);
console.log('ok');

// 4 ---------------------------------------------------------------
step('4 look signature');
const mine = `${spec.look.hue}|${spec.look.hero}`;
for (const fam of fs.readdirSync(PACKS_ROOT, { withFileTypes: true })) {
  if (!fam.isDirectory() || fam.name.startsWith('_') || fam.name.startsWith('.')) continue;
  for (const t of fs.readdirSync(path.join(PACKS_ROOT, fam.name), { withFileTypes: true })) {
    if (!t.isDirectory() || `${fam.name}/${t.name}` === rel.replace(/\\/g, '/')) continue;
    const other = await loadSpec(`${fam.name}/${t.name}`).catch(() => null);
    if (other && `${other.look.hue}|${other.look.hero}` === mine) fail(`look signature "${mine}" is already used by ${fam.name}/${t.name}`);
  }
}
console.log(`ok (${mine})`);

// 5 ---------------------------------------------------------------
step('5 lint (categories this pack lists; no waivers)');
let theme = themeFromFiles(themeFiles());
let result;
if (flag('--no-browser')) result = lintTheme(theme);
else {
  const b = await openBrowser();
  if (!b.available) fail(`browser not available: ${b.reason}`);
  try { result = await lintThemeBrowser(theme, { browser: b.browser }); } finally { await b.close(); }
}
console.log(formatReport(result));
if (!result.ok) fail('lint');

// 6 ---------------------------------------------------------------
const outDir = path.join(PACKS_ROOT, '.preview', spec.id);
const shotDir = path.join(PACKS_ROOT, '.shots', spec.id);
if (!flag('--skip-shots')) {
  step('6 preview pages and screenshots');
  fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(shotDir, { recursive: true });
  const model = contentToModel(c, { listSlug: spec.listPage.slug });
  const ent = { video: true, cart: false, booking: true, customDomain: true, callsToAction: true };
  const pagesToRender = [['home', {}], ['services', {}], [spec.listPage.slug, {}], ['item', { item: model.items[0], parent: spec.listPage.slug }], ['about', {}], ['gallery', {}], ['contact', {}], ['page', {}]];
  const titles = { services: spec.labels.itemsSection, about: spec.labels.aboutSection, gallery: 'Gallery', contact: 'Contact us', page: 'Offers and notices', [spec.listPage.slug]: spec.listPage.title };
  theme = themeFromFiles(themeFiles());
  const docs = {};
  for (const [slug, extra] of pagesToRender) {
    const content = { ...model, page: { ...model.page, title: titles[slug] ?? model.page.title } };
    const rendered = renderPage({ theme, page: { slug, ...extra }, content, settings: {}, vendor: { id: 'preview' }, host: { siteUrl: model.site.url }, entitlements: ent });
    if (rendered.warnings?.length) console.log(`  warnings on ${slug}: ${rendered.warnings.join('; ')}`);
    docs[slug] = pageDocument({ theme, rendered });
    fs.writeFileSync(path.join(outDir, `${slug}.html`), docs[slug]);
  }
  fs.writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${spec.name} preview</title><style>body{font:16px system-ui;margin:32px auto;max-width:640px;padding:0 16px}li{margin:10px 0}</style><h1>${spec.name}</h1><p>Preview pages for this pack, filled from its default content with a fictional sample company. Menu and button links inside the pages point at a live site and do not work in this static preview.</p><ul>${Object.keys(docs).map((s) => `<li><a href="${s}.html">${s}</a></li>`).join('')}</ul>`);
  const b = await openBrowser();
  if (!b.available) fail(`browser not available: ${b.reason}`);
  try {
    for (const w of [360, 768, 1280]) for (const s of ['home', 'item', spec.listPage.slug, 'contact']) await screenshot(b.browser, docs[s], path.join(shotDir, `${s}-${w}.png`), { width: w, reducedMotion: 'reduce' });
    const pv = (name, s, width, height) => screenshot(b.browser, docs[s], path.join(dir, 'assets', 'previews', name), { width, height, fullPage: false, reducedMotion: 'reduce' });
    fs.mkdirSync(path.join(dir, 'assets', 'previews'), { recursive: true });
    await pv('home-1280.png', 'home', 1280, 800); await pv('home-360.png', 'home', 360, 740); await pv('item-1280.png', 'item', 1280, 800);
  } finally { await b.close(); }
  console.log(`screenshots: ${shotDir}`);
}

// 7 ---------------------------------------------------------------
step('7 pack and validate-package');
const files = themeFiles();
for (const p of PREVIEW_FILES) if (!files[p.path]) fail(`missing preview image ${p.path}`);
const packed = packFiles(files);
const dist = path.join(PACKS_ROOT, '.dist');
fs.mkdirSync(dist, { recursive: true });
const zipPath = path.join(dist, `${spec.id}-${spec.version ?? 1}.zip`);
fs.writeFileSync(zipPath, packed.zip);
const v = validatePackage(packed.zip);
if (!v.ok) fail(`validate-package:\n  ${v.errors.map((e) => `[${e.code}] ${e.path}: ${e.message}`).join('\n  ')}`);
const sizeKb = (b) => (b / 1024).toFixed(1);
const css = (n) => sizeKb(files[`css/${n}.css`].length);
console.log(`valid: ${v.manifest.id} v${v.manifest.version}, hash ${v.manifest.contentHash.slice(0, 12)}, zip ${sizeKb(packed.zip.length)} KB`);
console.log(`css: base ${css('base')} KB, tokens ${css('tokens')} KB, motion ${css('motion')} KB, print ${css('print')} KB; warnings: ${v.warnings.length ? v.warnings.join('; ') : 'none'}`);
console.log(`ZIP ${zipPath}`);
console.log(`PREVIEW ${outDir}`);
console.log('PASS');
