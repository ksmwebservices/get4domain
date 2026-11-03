// Screenshots for review: the home page of a theme for a category, at phone, tablet and desktop widths, as PNG files.
// Uses the one renderer and the Playwright already on this machine; scripts are switched off in the page, so what you see is HTML + CSS only.
import fs from 'node:fs';
import path from 'node:path';
import { renderPage } from './render.mjs';
import { loadTheme } from './theme.mjs';
import { pageDocument } from './document.mjs';
import { screenshot } from './browser.mjs';
import { sampleContent, ENTITLEMENTS_ON, ENTITLEMENTS_OFF } from '../fixtures/index.mjs';

export const SHOT_WIDTHS = [360, 768, 1280];

/** @returns {Promise<string[]>} the files written */
export async function takeShots({ browser, themes, categories, out, widths = SHOT_WIDTHS, lang = 'en', page = 'home', entitlements = 'none' }) {
  const files = [];
  for (const themeId of themes) {
    const theme = loadTheme(themeId);
    for (const cat of categories) {
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
