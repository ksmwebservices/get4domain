import path from 'node:path';
import { THEMES_ROOT } from '../cli.mjs';
import { takeShots, shotPlan, tamilSample, SHOT_WIDTHS } from '../lib/shots.mjs';
import { openBrowser } from '../lib/browser.mjs';
import { listThemeIds, loadTheme } from '../lib/theme.mjs';
import { hasCategory } from '../lib/categories.mjs';

/**
 * node themes/cli.mjs shots --theme id --category id[,id] [--lang en|ta] [--page home] [--entitlements all] [--out dir]
 * node themes/cli.mjs shots --all [--tamil]     every Standard theme with the categories it lists, in English; --tamil adds three categories per theme in Tamil
 * Writes PNGs at 360, 768 and 1280 px into themes/.shots/ (git-ignored) and prints every path.
 */
export async function run({ flags }) {
  const known = listThemeIds();
  if (flags.theme && flags.theme !== true && !known.includes(String(flags.theme))) { console.error(`Unknown theme: ${flags.theme} (found: ${known.join(', ') || 'none'})`); return 2; }
  if (!flags.all && !(flags.category && flags.category !== true)) { console.error('Usage: node themes/cli.mjs shots --theme <id> --category <id> | --all [--tamil]'); return 2; }
  const plan = shotPlan({ all: Boolean(flags.all), theme: flags.theme && flags.theme !== true ? String(flags.theme) : undefined, category: flags.category && flags.category !== true ? String(flags.category) : undefined });
  const unknown = plan.flatMap((p) => p.categories.filter((c) => !hasCategory(c) || !loadTheme(p.theme).manifest.categories.includes(c)).map((c) => `${c} (not in ${p.theme})`));
  if (unknown.length) { console.error(`Cannot shoot: ${unknown.join(', ')}`); return 2; }
  const b = await openBrowser();
  if (!b.available) { console.error(`Screenshots need the Playwright already installed on this machine: ${b.reason}`); return 2; }
  const out = flags.out && flags.out !== true ? path.resolve(flags.out) : path.join(THEMES_ROOT, '.shots');
  const entitlements = flags.entitlements === 'all' ? 'all' : 'none';
  try {
    const lang = flags.lang === 'ta' ? 'ta' : 'en';
    const files = await takeShots({ browser: b.browser, plan, out, widths: SHOT_WIDTHS, lang, page: typeof flags.page === 'string' ? flags.page : 'home', entitlements });
    if (flags.all && flags.tamil) files.push(...await takeShots({ browser: b.browser, plan: tamilSample(plan), out, widths: SHOT_WIDTHS, lang: 'ta', page: 'home', entitlements }));
    for (const f of files) console.log(f);
    console.log(`\n${files.length} screenshot(s) written under ${out}`);
  } finally { await b.close(); }
  return 0;
}
