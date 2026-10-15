// Industry designs (15 Oct 2026): offline guards that need no server.
//   [feat:industry-designs.contrast]    every design's theme passes WCAG AA for the colours the sections use
//   [feat:industry-designs.no-hardcode] no business text of any category lives in the page code, and no stock picture host is used
//   [feat:industry-designs.editable]    the vocabulary lists agree, every section has 3+ layouts, and the editor offers an input for everything the page reads
// Needs the built API for the category list: cd backend-api && npx nest build
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FE = path.join(here, '..');
const BE = path.join(FE, '..', 'backend-api');
const require = createRequire(import.meta.url);
const rd = (...p) => fs.readFileSync(path.join(FE, ...p), 'utf8');
let fail = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) { pass++; console.log(`  PASS  ${name}`); } else { fail++; console.log(`  FAIL  ${name} ${detail}`); } };

const seedsFile = path.join(BE, 'dist', 'src', 'site-doc', 'industry-seeds.js');
if (!fs.existsSync(seedsFile)) { console.log('SKIP  the API is not built (cd backend-api && npx nest build): design guards not run'); process.exit(0); }
const { CATEGORY_SEEDS, starterDesignPacks } = require(seedsFile);
const packs = starterDesignPacks();
const themes = JSON.parse(rd('src', 'engine', 'kit', 'site-themes.json'));
const themeById = Object.fromEntries(themes.map((t) => [t.id, t]));
const vocab = JSON.parse(rd('src', 'engine', 'sitedoc', 'design-vocab.json'));

// ── contrast ──
console.log('== [feat:industry-designs.contrast] Every design theme passes AA contrast for the colours its sections use');
const lum = (hex) => { const h = hex.replace('#', ''); const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
let designs = 0; const bad = [];
for (const p of packs) for (const d of p.config.designs) {
  designs += 1;
  const t = themeById[d.themeKey];
  if (!t) { bad.push(`${p.key}/${d.key}: unknown theme ${d.themeKey}`); continue; }
  const rows = [['text on page', t.fg, t.bg], ['text on cards', t.fg, t.surface], ['muted on page', t.muted, t.bg], ['muted on cards', t.muted, t.surface], ['button text', t.accentFg, t.accent], ['accent on page', t.accent, t.bg], ['accent on cards', t.accent, t.surface]];
  for (const [what, a, b] of rows) if (ratio(a, b) < 4.5) bad.push(`${p.key}/${d.key}: ${what} ${ratio(a, b).toFixed(2)}`);
}
check(`all ${designs} designs use a theme that passes AA (4.5:1) for text, muted text, buttons and accent text`, bad.length === 0, bad.slice(0, 4).join(' | '));
check('every design font, radius, button, navigation, footer and action bar is one the page code knows', packs.every((p) => p.config.designs.every((d) => vocab.fonts.includes(d.font) && vocab.radius.includes(d.radius) && vocab.buttons.includes(d.button) && vocab.nav.includes(d.nav) && vocab.footer.includes(d.footer) && vocab.actionBar.includes(d.actionBar))));
const dark = packs.flatMap((p) => p.config.designs).filter((d) => themeById[d.themeKey].mode === 'dark').length;
check(`the designs mix light and dark themes (${dark} of ${designs} are dark)`, dark > 10 && dark < designs - 10);

// ── no hard-coded business text ──
console.log('\n== [feat:industry-designs.no-hardcode] No business text of any category outside the starter content; no stock pictures');
const codeFiles = [['src', 'engine', 'sitedoc', 'design-build.ts'], ['src', 'engine', 'sitedoc', 'build.ts'], ['src', 'engine', 'kit', 'design-sections.tsx'], ['src', 'engine', 'kit', 'design-client.tsx'], ['src', 'engine', 'kit', 'sections.tsx'], ['src', 'app', 'dashboard', 'my-website', 'SiteContentTabs.tsx']];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const code = codeFiles.map((f) => [f.at(-1), strip(rd(...f))]);
const BANNED = /\b(clinic|salon|doctor|dental|restaurant|biryani|dosa|thali|hotel|gym|trainer|advocate|lawyer|real estate|property|bhk|tour package|travel agency|photograph|wedding|haircut|facial|plumb|electrician|tutor|diagnostic|pathology)\b/i;
const hits = code.flatMap(([n, s]) => (s.match(new RegExp(BANNED, 'gi')) ?? []).map((w) => `${n}: ${w}`));
check('the page code (builder, sections, editor tabs) contains no category-specific business words', hits.length === 0, hits.slice(0, 5).join(' | '));
const texts = [];
for (const s of CATEGORY_SEEDS.filter((c) => c.key !== 'general')) { texts.push(s.headline.replace('{business}', '').trim(), s.subline, s.tagline, ...s.items.map((i) => i[0]), ...s.faq.map((f) => f[0])); }
const leaked = code.flatMap(([n, src]) => texts.filter((t) => t.length > 12 && src.includes(t)).map((t) => `${n}: ${t}`));
check('none of the starter headlines, items or questions of the 24 categories appears in the page code', leaked.length === 0, leaked.slice(0, 3).join(' | '));
check('no stock-photo host (unsplash, pexels, pixabay) is referenced by the design code or the starter content', !code.some(([, s]) => /unsplash|pexels|pixabay|shutterstock|gettyimages/i.test(s)) && !/unsplash|pexels|pixabay|shutterstock|gettyimages/i.test(JSON.stringify(packs)));
const imgs = packs.flatMap((p) => [p.config.seed.images.hero, ...p.config.seed.images.gallery]);
const licence = fs.existsSync(path.join(FE, 'public', 'starter', 'LICENCE.md'));
check('every starter picture is our own file in the website\'s own storage, and its licence is written down', imgs.every((u) => u.startsWith('/starter/') && fs.existsSync(path.join(FE, 'public', u))) && licence, imgs.filter((u) => !fs.existsSync(path.join(FE, 'public', u))).slice(0, 3).join(' '));

// ── editable (static) ──
console.log('\n== [feat:industry-designs.editable] The lists agree, every section has 3+ layouts, and the editor has an input for everything the page reads');
const backendVocab = fs.readFileSync(path.join(BE, 'src', 'site-doc', 'design-vocab.json'), 'utf8');
check('the design vocabulary is the same file on the server and in the website', backendVocab.replace(/\r\n/g, '\n') === rd('src', 'engine', 'sitedoc', 'design-vocab.json').replace(/\r\n/g, '\n'));
const short = Object.entries(vocab.sections).filter(([, v]) => v.length < 3).map(([k]) => k);
check(`every one of the ${Object.keys(vocab.sections).length} section types has at least 3 layouts`, short.length === 0, short.join(','));
check('there are 8 flow families and 16 or more section types', vocab.families.length === 8 && Object.keys(vocab.sections).length >= 16);
const builder = strip(rd('src', 'engine', 'sitedoc', 'design-build.ts'));
const cmsRead = [...new Set([...builder.matchAll(/\bcms\??\.([a-zA-Z]+)/g)].map((m) => m[1]))];
const editorMain = rd('src', 'app', 'dashboard', 'my-website', 'SiteEditorV2.tsx');
const editorLists = [...editorMain.matchAll(/const (TEXT_FIELDS|JSON_FIELDS) = \[([^\]]*)\]/g)].flatMap((m) => [...m[2].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1]));
const missingCms = cmsRead.filter((k) => !editorLists.includes(k));
check('every site field the design builder reads (name, tagline, About, logo, banner, contact, hours, social, gallery, quotes, pages, layout, extras) is in the editor\'s field list', missingCms.length === 0, missingCms.join(','));
const extrasRead = [...new Set([...builder.matchAll(/\bex\.([a-zA-Z]+)/g)].map((m) => m[1]))].filter((k) => k !== 'sample');
const editorTabs = rd('src', 'app', 'dashboard', 'my-website', 'SiteContentTabs.tsx');
const noInput = extrasRead.filter((k) => !new RegExp(`(txt\\('${k}'|upd\\(\\{ ${k}:)`).test(editorTabs));
check(`every one of the ${extrasRead.length} fields of "extras" the page reads has an input in Website Manager (Page content)`, noInput.length === 0, noInput.join(','));
const listed = [...editorTabs.matchAll(/EDITOR_EXTRAS_FIELDS = \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1]));
check('the editor\'s own list of those fields is complete', extrasRead.every((k) => listed.includes(k)), extrasRead.filter((k) => !listed.includes(k)).join(','));
const be = fs.readFileSync(path.join(BE, 'src', 'site-doc', 'site-doc.constants.ts'), 'utf8');
const serverExtras = [...be.matchAll(/SITE_EXTRAS_(?:TEXT|LISTS) = \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1]));
check('the server accepts exactly the extras fields the editor and the page use', JSON.stringify([...serverExtras].sort()) === JSON.stringify([...listed].sort()), `${serverExtras.join(',')} vs ${listed.join(',')}`);
const renderer = rd('src', 'engine', 'kit', 'KitRenderer.tsx');
const modelTypes = [...strip(rd('src', 'engine', 'kit', 'model.ts')).matchAll(/type: '([a-zA-Z]+)'/g)].map((m) => m[1]);
const unhandled = [...new Set(modelTypes)].filter((t) => !new RegExp(`case '${t}'`).test(renderer));
check('the renderer handles every section type in the model', unhandled.length === 0, unhandled.join(','));

console.log(fail ? `\nFAIL: ${fail} check(s) failed, ${pass} passed` : `\n${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
