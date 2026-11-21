// Screenshots for review: the home page of a theme for a category, at phone, tablet and desktop widths, as PNG files.
// Uses the one renderer and the Playwright already on this machine; scripts are switched off in the page, so what you see is HTML + CSS only.
// A category is shown in the theme that lists it (a "plan" is a list of { theme, categories }).
import fs from 'node:fs';
import path from 'node:path';
import { renderPage } from './render.mjs';
import { loadTheme, listThemeIds, listVendorThemeIds } from './theme.mjs';
import { pageDocument } from './document.mjs';
import { screenshot } from './browser.mjs';
import { sampleContent, ENTITLEMENTS_ON, ENTITLEMENTS_OFF } from '../fixtures/index.mjs';

export const SHOT_WIDTHS = [360, 768, 1280];

/**
 * @param {{all?:boolean, theme?:string, category?:string}} opts
 * @returns {{theme:string, categories:string[]}[]}
 */
export function shotPlan({ all = false, theme, category } = {}) {
  if (all) {
    const vendor = listVendorThemeIds();
    const ids = vendor.length ? vendor : listThemeIds();
    return ids.map((id) => ({ theme: id, categories: [...loadTheme(id).manifest.categories] }));
  }
  const id = theme ?? listVendorThemeIds()[0] ?? listThemeIds()[0];
  const cats = category ? String(category).split(',') : [...loadTheme(id).manifest.categories];
  return [{ theme: id, categories: cats }];
}

/** Three categories per theme (first, middle, last) for the Tamil sample. */
export function tamilSample(plan, n = 3) {
  return plan.map(({ theme, categories }) => {
    const idx = [...new Set([0, Math.floor((categories.length - 1) / 2), categories.length - 1])];
    for (let i = 0; idx.length < Math.min(n, categories.length); i++) if (!idx.includes(i)) idx.push(i);
    return { theme, categories: idx.slice(0, n).sort((a, b) => a - b).map((i) => categories[i]) };
  });
}

/** @returns {Promise<string[]>} the files written. Pass `plan`, or (older form) `themes` and `categories` for a cross product. */
export async function takeShots({ browser, plan, themes, categories, out, widths = SHOT_WIDTHS, lang = 'en', page = 'home', entitlements = 'none' }) {
  const todo = plan ?? themes.map((theme) => ({ theme, categories }));
  const files = [];
  for (const { theme: themeId, categories: cats } of todo) {
    const theme = loadTheme(themeId);
    for (const cat of cats) {
      const content = sampleContent(cat, { lang });
      const rendered = renderPage({ theme, page: page === 'item' ? { slug: 'item', item: content.items[0] } : { slug: page }, content, settings: {}, vendor: { id: 'shots' }, host: { siteUrl: content.host.siteUrl }, entitlements: entitlements === 'all' ? ENTITLEMENTS_ON : ENTITLEMENTS_OFF });
      const html = pageDocument({ theme, rendered });
      const dir = path.join(out, themeId, cat);
      fs.mkdirSync(dir, { recursive: true });
      for (const width of widths) {
        const file = path.join(dir, `${cat}-${lang}-${page}-${width}.png`);
        await screenshot(browser, html, file, { width });
        files.push(file);
      }
    }
  }
  return files;
}
