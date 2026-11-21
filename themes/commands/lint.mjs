import fs from 'node:fs';
import path from 'node:path';
import { THEMES_ROOT } from '../cli.mjs';
import { lintTheme, lintThemeBrowser, formatReport, RULE_IDS } from '../lib/lint.mjs';
import { loadTheme, listThemeIds } from '../lib/theme.mjs';
import { CATEGORY_IDS, hasCategory } from '../lib/categories.mjs';
import { openBrowser } from '../lib/browser.mjs';

/**
 * node themes/cli.mjs lint [theme-id | --all] [--category id | --all-categories] [--json file] [--browser] [--accent #rrggbb]
 * Prints a readable report, writes a JSON report (default themes/.reports/lint.json) and exits 1 when any rule fails.
 */
export async function run({ flags, positional }) {
  const ids = flags.all || positional.length === 0 ? listThemeIds() : positional;
  if (!ids.length) { console.error('No themes found in themes/library'); return 2; }
  let categories;
  if (flags['all-categories']) categories = CATEGORY_IDS;
  else if (flags.category && flags.category !== true) {
    categories = String(flags.category).split(',');
    const bad = categories.filter((c) => !hasCategory(c));
    if (bad.length) { console.error(`Unknown category: ${bad.join(', ')}`); return 2; }
  }
  let browser = null;
  if (flags.browser) {
    const b = await openBrowser();
    if (!b.available) { console.error(`--browser requested but not available: ${b.reason}`); return 2; }
    browser = b;
  }
  const reports = [];
  let failed = false;
  try {
    for (const id of ids) {
      const theme = loadTheme(id);
      const opts = { categories, vendorAccent: typeof flags.accent === 'string' ? flags.accent : undefined };
      const result = browser ? await lintThemeBrowser(theme, { ...opts, browser: browser.browser }) : lintTheme(theme, opts);
      console.log(formatReport(result));
      if (!result.ok) failed = true;
      reports.push({ ...result, theme: id, browser: Boolean(browser) });
    }
  } finally { if (browser) await browser.close(); }
  const file = typeof flags.json === 'string' ? path.resolve(flags.json) : path.join(THEMES_ROOT, '.reports', 'lint.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ rules: RULE_IDS, ok: !failed, reports }, null, 2) + '\n');
  console.log(`\nJSON report: ${file}`);
  console.log(failed ? 'RESULT: FAIL' : `RESULT: PASS (${reports.length} theme(s))`);
  return failed ? 1 : 0;
}
