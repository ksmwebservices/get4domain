import path from 'node:path';
import { THEMES_ROOT } from '../cli.mjs';
import { takeShots, SHOT_WIDTHS } from '../lib/shots.mjs';
import { openBrowser } from '../lib/browser.mjs';
import { listThemeIds } from '../lib/theme.mjs';
import { CATEGORY_IDS, hasCategory } from '../lib/categories.mjs';

/**
 * node themes/cli.mjs shots --theme id --category id [--lang en|ta] [--page home] [--entitlements all] [--out dir]
 * node themes/cli.mjs shots --all            every theme x every one of the 41 categories
 * Writes PNGs at 360, 768 and 1280 px into themes/.shots/ (git-ignored) and prints every path.
 */
export async function run({ flags }) {
  const themes = flags.all ? listThemeIds() : flags.theme && flags.theme !== true ? [String(flags.theme)] : listThemeIds().slice(0, 1);
  const categories = flags.all ? CATEGORY_IDS : flags.category && flags.category !== true ? String(flags.category).split(',') : null;
  if (!categories) { console.error('Usage: node themes/cli.mjs shots --theme <id> --category <id> | --all'); return 2; }
  const unknown = categories.filter((c) => !hasCategory(c));
  if (unknown.length) { console.error(`Unknown category: ${unknown.join(', ')}`); return 2; }
  const known = listThemeIds();
  const missing = themes.filter((t) => !known.includes(t));
  if (missing.length) { console.error(`Unknown theme: ${missing.join(', ')} (found: ${known.join(', ') || 'none'})`); return 2; }
  const b = await openBrowser();
  if (!b.available) { console.error(`Screenshots need the Playwright already installed on this machine: ${b.reason}`); return 2; }
  const out = flags.out && flags.out !== true ? path.resolve(flags.out) : path.join(THEMES_ROOT, '.shots');
  try {
    const files = await takeShots({ browser: b.browser, themes, categories, out, widths: SHOT_WIDTHS, lang: flags.lang === 'ta' ? 'ta' : 'en', page: typeof flags.page === 'string' ? flags.page : 'home', entitlements: flags.entitlements === 'all' ? 'all' : 'none' });
    for (const f of files) console.log(f);
    console.log(`\n${files.length} screenshot(s) written under ${out}`);
  } finally { await b.close(); }
  return 0;
}
