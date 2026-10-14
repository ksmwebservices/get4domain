// [feat:website-manager.themes] Every theme a vendor can pick passes the WCAG AA contrast check, and the list matches the server's list.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const themes = JSON.parse(fs.readFileSync(path.join(here, '..', 'src', 'engine', 'kit', 'site-themes.json'), 'utf8'));
const lum = (hex) => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
let fail = 0; let pass = 0;
const check = (name, ok, detail = '') => { if (ok) pass++; else { fail++; console.log(`  FAIL  ${name} ${detail}`); } };

console.log('== [feat:website-manager.themes] Every theme passes AA contrast and the lists agree');
console.log('themes:', themes.length);
check('at least 8 themes', themes.length >= 8, String(themes.length));
check('both light and dark themes exist', themes.some((t) => t.mode === 'light') && themes.some((t) => t.mode === 'dark'));
for (const t of themes) {
  const rows = [['text on page', t.fg, t.bg, 4.5], ['text on card', t.fg, t.surface, 4.5], ['muted text on page', t.muted, t.bg, 4.5], ['muted text on card', t.muted, t.surface, 4.5], ['button text on button', t.accentFg, t.accent, 4.5], ['accent text on page', t.accent, t.bg, 4.5], ['accent text on card', t.accent, t.surface, 4.5]];
  for (const [what, a, b, min] of rows) { const r = ratio(a, b); check(`${t.id}: ${what}`, r >= min, `${r.toFixed(2)} < ${min}`); }
}
// the server accepts exactly these themes
const server = fs.readFileSync(path.join(here, '..', '..', 'backend-api', 'src', 'site-doc', 'site-doc.constants.ts'), 'utf8');
const keys = [...server.match(/SITE_THEME_KEYS = \[([\s\S]*?)\] as const/)[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
check('the server list of theme keys equals the design list', JSON.stringify([...keys].sort()) === JSON.stringify(themes.map((t) => t.id).sort()), `${keys.join(',')}`);
console.log(fail ? `
FAIL: ${fail} check(s) failed, ${pass} passed` : `
${pass} passed, 0 failed: ${themes.length} themes pass AA contrast; server list matches.`);
process.exit(fail ? 1 : 0);
