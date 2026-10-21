// Theme packages (industry designs round 2): offline guards that need no server.
//   [feat:industry-designs.contrast]    the reference themes pass AA contrast and the admin screen shows the contrast table
//   [feat:industry-designs.no-hardcode] theme templates and the shell/theme code carry no business text, price, phone number, e-mail address or stock picture host
//   [feat:industry-designs.editable]    every slot a theme can show has an input in the editor (or is a word set in Admin); the lists the website and the API share agree
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FE = path.join(here, '..');
const ROOT = path.join(FE, '..');
const BE = path.join(ROOT, 'backend-api');
let fail = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) { pass++; console.log(`  PASS  ${name}`); } else { fail++; console.log(`  FAIL  ${name} ${detail}`); } };
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const walk = (dir, filter) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), filter) : filter(e.name) ? [path.join(dir, e.name)] : []));

const contract = JSON.parse(read(BE, 'src', 'themes', 'core', 'theme-contract.json'));
const feContract = read(FE, 'src', 'engine', 'themepack', 'theme-contract.json');
const themesDir = path.join(ROOT, 'themes', 'reference');
const themeNames = fs.readdirSync(themesDir).filter((n) => fs.existsSync(path.join(themesDir, n, 'theme.json')));

// ── contrast ──
console.log('== [feat:industry-designs.contrast] The reference themes pass AA contrast; the admin screen shows the table');
const lum = (hex) => { const h = hex.replace('#', ''); const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const bad = [];
for (const n of themeNames) {
  const m = JSON.parse(read(themesDir, n, 'theme.json'));
  const c = m.colors ?? {};
  for (const [what, a, b] of [['text on page', c.fg, c.bg], ['muted text on page', c.muted, c.bg], ['button text on button', c.accentFg, c.accent], ['accent text on page', c.accent, c.bg]]) {
    if (!a || !b) { bad.push(`${n}: ${what} has no colour`); continue; }
    if (ratio(a, b) < 4.5) bad.push(`${n}: ${what} ${ratio(a, b).toFixed(2)}`);
  }
  const css = read(themesDir, n, 'theme.css');
  for (const [v, key] of [['--g4d-bg', 'bg'], ['--g4d-fg', 'fg'], ['--g4d-muted', 'muted'], ['--g4d-accent', 'accent'], ['--g4d-accent-fg', 'accentFg']]) {
    const mm = new RegExp(`${v}\\s*:\\s*(#[0-9a-fA-F]{3,6})`).exec(css);
    if (!mm || mm[1].toLowerCase() !== String(c[key]).toLowerCase()) bad.push(`${n}: theme.json ${key} and ${v} in theme.css disagree`);
  }
}
check(`${themeNames.length} reference themes: text, muted text, buttons and accent text pass 4.5 to 1, and theme.json agrees with theme.css`, themeNames.length >= 2 && bad.length === 0, bad.join(' | '));
const adminScreen = read(FE, 'src', 'themes-admin', 'ThemesAdmin.tsx');
check('the admin Theme marketplace screen shows the contrast table recorded at import', /Colour contrast/.test(adminScreen) && /lint\?\.contrast/.test(adminScreen));
check('the website and the API read the same contract file', read(BE, 'src', 'themes', 'core', 'theme-contract.json') === feContract);

// ── no hard-coded text ──
console.log('== [feat:industry-designs.no-hardcode] Themes and the theme/shell code carry no business text');
const hard = [];
for (const n of themeNames) for (const f of walk(path.join(themesDir, n), (x) => /\.(html|css)$/.test(x))) {
  const t = fs.readFileSync(f, 'utf8').replace(/\{\{[^}]*\}\}/g, '');
  const body = f.endsWith('.css') ? t.replace(/\/\*[\s\S]*?\*\//g, '') : t;
  if (f.endsWith('.html') && /₹|\bRs\.?\s?\d|\b\d{10}\b|@[a-z0-9-]+\.(com|in|org)|lorem ipsum|\b(Dr|Mr|Mrs|Ms)\.? [A-Z]/i.test(body)) hard.push(path.relative(themesDir, f));
  if (/unsplash|pexels|pixabay|shutterstock|placeholder\.com|picsum/i.test(body)) hard.push(`${path.relative(themesDir, f)} (stock picture host)`);
  if (/https?:\/\/(?!fonts\.googleapis\.com|www\.w3\.org)/i.test(body)) hard.push(`${path.relative(themesDir, f)} (outside address)`);
}
check('no reference theme file holds a price, phone number, e-mail address, person\'s name, stock picture host or outside address of its own', hard.length === 0, hard.join(' | '));
const code = [...walk(path.join(FE, 'src', 'engine', 'shell'), (x) => /\.tsx?$/.test(x)), ...walk(path.join(FE, 'src', 'engine', 'themepack'), (x) => /\.tsx?$/.test(x))];
const codeBad = [];
for (const f of code) {
  const t = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (/unsplash|pexels|pixabay|shutterstock/i.test(t)) codeBad.push(`${path.basename(f)}: stock picture host`);
  if (/₹\s?\d|\b[6-9]\d{9}\b|@[a-z0-9-]+\.(com|in|org)/i.test(t.replace(/₹\$\{|\[₹\$\]|\^\[₹|₹'|'₹|`₹|₹\\s|"₹/g, ''))) codeBad.push(`${path.basename(f)}: a price, phone number or e-mail address`);
}
check(`the ${code.length} shell and theme code files hold no price, phone number, e-mail address or stock picture host`, codeBad.length === 0, codeBad.join(' | '));
const render = read(FE, 'src', 'engine', 'themepack', 'render.tsx') + read(FE, 'src', 'engine', 'themepack', 'context.ts');
check('the renderer has no fallback business text: a slot with nothing behind it renders as an empty string', render.includes("const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')") && render.includes('const interp = (s: string'));
check('sample customer quotes are filtered out of the data a theme receives', /!\(t as \{ sample\?: boolean \}\)\.sample/.test(read(FE, 'src', 'engine', 'themepack', 'context.ts')));
check('a starter price is shown as "Contact for price" in item data, never as a price', /Contact for price/.test(read(FE, 'src', 'engine', 'themepack', 'data.ts')) && /Contact for price/.test(read(FE, 'src', 'engine', 'shell', 'build-shell.ts')));

// ── editable ──
console.log('== [feat:industry-designs.editable] Every slot a theme can show has an input in the editor');
const editor = ['SiteEditorV2.tsx', 'SiteContentTabs.tsx', 'SiteShellTabs.tsx'].map((f) => read(FE, 'src', 'app', 'dashboard', 'my-website', f)).join('\n');
// slot -> where the vendor edits it. 'admin' means a word set once per category in Admin, Category packs.
const WHERE = {
  'site.name': ['businessName'], 'site.tagline': ['tagline'], 'site.logo': ['logo'], 'site.favicon': ['favicon'], 'site.year': 'auto', 'site.url': 'auto',
  'hero.title': ['headline'], 'hero.subtitle': ['subline'], 'hero.image': ['banner'], 'hero.cta': ['primaryLabel', 'ctaLabel'],
  'about.title': 'auto', 'about.text': ['about'], 'about.image': ['portfolio'],
  'contact.phone': ['phone'], 'contact.phoneHref': 'auto', 'contact.whatsapp': ['whatsapp'], 'contact.email': ['email'], 'contact.address': ['address'], 'contact.mapUrl': ['googleMaps'],
  hours: ['businessHours'],
  'social.instagram': ['instagram'], 'social.facebook': ['facebook'], 'social.youtube': ['youtube'], 'social.linkedin': ['linkedin'], 'social.x': ['customLabel', "x'"], 'social.whatsapp': ['whatsapp'], 'social.maps': ['googleMaps'], 'social.custom': ['customUrl'], 'social.customLabel': ['customLabel'],
  'page.title': ['pages'], 'page.body': ['pages'], 'page.slug': 'auto',
  'terms.team': 'admin', 'terms.teamOne': 'admin', 'terms.items': 'admin', 'terms.itemOne': 'admin', 'terms.groups': 'admin', 'cta.label': ['primaryLabel'],
};
const unmapped = contract.slots.filter((s) => !(s in WHERE));
check(`every one of the ${contract.slots.length} slots in the contract is accounted for (an input in the editor, a word set in Admin, or filled in by the engine)`, unmapped.length === 0, unmapped.join(','));
const noInput = Object.entries(WHERE).filter(([, w]) => Array.isArray(w) && !w.some((k) => editor.includes(`'${k}'`) || editor.includes(`"${k}"`) || editor.includes(k.replace(/'$/, '')) )).map(([s]) => s);
check('every slot that comes from the vendor has an input in the Website Manager', noInput.length === 0, noInput.join(','));
const REPEATER_WHERE = { items: 'ItemsTab', groups: 'ItemsTab', team: 'team', testimonials: 'testimonials', faqs: 'faq', gallery: 'portfolio', steps: 'steps', trust: 'trust', stats: 'stats', pages: 'pages' };
const missingRep = Object.keys(contract.repeaters).filter((r) => !(r in REPEATER_WHERE) || !editor.includes(REPEATER_WHERE[r]));
check('every list a theme can repeat (items, groups, team, quotes, questions, pictures, steps, trust points, numbers, pages) is editable', missingRep.length === 0, missingRep.join(','));
const shellExtras = ['navigation', 'popup', 'social', 'primaryLabel', 'notifyPhone', 'notifyEmail', 'confirm'];
check('the shell settings (header items, phone-bar labels, main button, popup fields, thank-you message, notice contact, X and custom link) have inputs', shellExtras.every((k) => editor.includes(k)), shellExtras.filter((k) => !editor.includes(k)).join(','));
const serverConst = read(BE, 'src', 'site-doc', 'site-doc.constants.ts');
check('the server accepts the shell settings (navigation, popup, social, pagePlan)', ['navigation', 'popup', 'social', 'pagePlan'].every((k) => new RegExp(`'${k}'`).test(serverConst)));
const bnIcons = read(FE, 'src', 'engine', 'shell', 'ShellBottomNav.tsx');
const beShell = read(BE, 'src', 'site-doc', 'shell.ts');
const icons = [...(/SHELL_ICONS = \[([^\]]*)\]/.exec(beShell)?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
check(`the ${icons.length} phone-bar icons the API accepts all exist in the website`, icons.length > 10 && icons.every((i) => new RegExp(`\\b${i}:`).test(bnIcons)), icons.filter((i) => !new RegExp(`\\b${i}:`).test(bnIcons)).join(','));
const adminShell = read(FE, 'src', 'packs-admin', 'ShellAdmin.tsx');
check('the Category packs screen edits the words, the five phone-bar buttons and the popup steps (a new category needs no code)', /terms/.test(adminShell) && /bottomNav/.test(adminShell) && /popup/.test(adminShell) && /PopupStepKind/.test(adminShell));
check('every popup step kind the API accepts is one the popup draws', ['choose', 'when', 'dates', 'count', 'mode', 'cart', 'details', 'confirm'].every((k) => new RegExp(`'${k}'`).test(beShell) && (k === 'cart' || new RegExp(`kind === '${k}'`).test(read(FE, 'src', 'engine', 'shell', 'ShellProvider.tsx')))));

console.log(fail ? `\nFAIL: ${fail} check(s) failed, ${pass} passed` : `\n${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
