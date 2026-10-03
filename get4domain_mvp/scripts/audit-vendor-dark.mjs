// Guard for the vendor dashboard dark theme (globals.css `.vendor-ui` remap).
//
// The dashboard reuses light-theme utility classes; `.vendor-ui` remaps them to dark
// equivalents, but ONLY the exact class names listed in globals.css (Tailwind emits
// `hover:bg-red-50`, `bg-primary-50/60` etc. as separate classes). A light class that
// isn't remapped leaks a light surface / dark text onto the navy background — the
// "unreadable on hover" bug. This script lists every light-palette class used under the
// dashboard that has no remap. Exit code 1 if any are found.
//
//   node scripts/audit-vendor-dark.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });

const files = [
  ...walk(join(SRC, 'app/dashboard')),
  ...walk(join(SRC, 'components/ui')),
  ...walk(join(SRC, 'components/telecrm')),
  ...walk(join(SRC, 'components/vendor')),
  ...['UpgradeModal', 'AddOnMarketplace', 'DashboardChatBot', 'InstallPrompt'].map((n) => join(SRC, `components/${n}.tsx`)),
].filter(existsSync);

// 1. Every class the dark remap handles.
const css = readFileSync(join(SRC, 'app/globals.css'), 'utf8');
const remapped = new Set();
for (const m of css.matchAll(/\.vendor-ui\s+(?:\.group:hover\s+)?\.((?:\\.|[\w-])+)/g)) remapped.add(m[1].replace(/\\/g, ''));
// comma-continued selectors on following lines
for (const m of css.matchAll(/,\s*\n\s*\.vendor-ui\s+(?:\.group:hover\s+)?\.((?:\\.|[\w-])+)/g)) remapped.add(m[1].replace(/\\/g, ''));

// 2. Light-palette tokens (shade <= 300 surfaces/borders, >= 500 slate text, plus every
//    hover/focus/group-hover variant of a light colour).
const PAL = 'white|slate|gray|primary|blue|red|error|amber|warning|emerald|success|secondary|orange|violet|rose';
const TOKEN = new RegExp(
  `(?<![\\w\\-/:\\[])((?:(?:hover|focus|focus-visible|active|group-hover|disabled|placeholder):)+)?((?:bg|text|border|ring|divide)-(?:${PAL})(?:-(\\d{2,3}))?(?:/\\d+)?)(?![\\w\\-])`,
  'g',
);
const found = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(TOKEN)) {
    const variant = (m[1] ?? '').replace(/(sm|md|lg|xl):/g, '');
    const util = m[2];
    const shade = m[3] ? Number(m[3]) : null;
    const kind = util.split('-')[0];
    const color = util.split('-')[1].replace(/\/\d+$/, '');
    const opacity = /\/\d+$/.test(util);
    const solidDark = kind === 'bg' && shade !== null && shade >= 500 && !variant; // buttons/badges with white text
    const whiteOnDark = color === 'white' && (opacity || kind === 'text'); // text-white, bg-white/10 …
    const lightTextOk = kind === 'text' && shade !== null && shade <= 300; // already light on navy
    const darkSlateBg = color === 'slate' && shade !== null && shade >= 800;
    const lightSurface = (kind === 'bg' || kind === 'border' || kind === 'ring' || kind === 'divide') && (shade === null || shade <= 300 || color === 'white');
    const darkText = kind === 'text' && shade !== null && shade >= (color === 'slate' || color === 'gray' ? 400 : 500) && color !== 'white';
    const risky = variant ? true : lightSurface || darkText;
    if (!risky || solidDark || whiteOnDark || lightTextOk || darkSlateBg) continue;
    if (variant && kind === 'bg' && shade !== null && shade >= 500) continue; // hover:bg-primary-700 (white text stays)
    if (color === 'success' && shade === null) continue; // semantic `success` token is already a dark-theme colour
    const tok = variant + util;
    if (remapped.has(tok)) continue;
    if (!found.has(tok)) found.set(tok, new Set());
    found.get(tok).add(f.replace(SRC, '').replaceAll('\\', '/'));
  }
}

if (found.size === 0) {
  console.log('vendor dark audit: every light utility used under the dashboard is remapped.');
} else {
  console.log(`vendor dark audit: ${found.size} light class(es) used but NOT remapped in globals.css (.vendor-ui):`);
  for (const [tok, where] of [...found].sort()) console.log(`  ${tok}   ← ${[...where].slice(0, 2).join(', ')}`);
  process.exitCode = 1;
}
