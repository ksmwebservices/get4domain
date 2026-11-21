// Screenshots of the portal pages at 375, 768 and 1280 px, plus the checks that matter on phones (no sideways scroll, no console errors).
// Usage (from get4domain_mvp, with the dev server of SEE_IT_PORTAL.md running):
//   node scripts/j1-shots.mjs [--chrome "<path to chrome.exe>"] [--out ../docs/v3/j1-shots] <url> [<url> ...]
// puppeteer-core is already a dev dependency; the browser is the Chromium that Playwright installs (or any Chrome through --chrome).
import { mkdirSync, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
let out = '../docs/v3/j1-shots';
let chrome = process.env.CHROME_PATH || '';
const urls = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') out = args[++i];
  else if (args[i] === '--chrome') chrome = args[++i];
  else urls.push(args[i]);
}
if (!chrome) {
  const root = join(homedir(), 'AppData', 'Local', 'ms-playwright');
  if (existsSync(root)) {
    const dirs = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const d of dirs) { const p = join(root, d, 'chrome-win64', 'chrome.exe'); if (existsSync(p)) { chrome = p; break; } }
  }
}
if (!chrome || urls.length === 0) { console.error('need --chrome (or Playwright chromium installed) and at least one url'); process.exit(2); }
mkdirSync(out, { recursive: true });

const WIDTHS = [375, 768, 1280];
const slug = (u) => u.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80);
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
let bad = 0;
for (const url of urls) {
  for (const w of WIDTHS) {
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
    let status = 0;
    try {
      const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
      status = res ? res.status() : 0;
      await new Promise((r) => setTimeout(r, 400));
      const over = await page.evaluate(() => {
        const iw = window.innerWidth;
        // the shell clips sideways overflow, so also look for elements that stick out past the window (full-width bands are exactly the window wide and are fine)
        const out = [];
        for (const el of document.body.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > iw + 2 && !el.closest('[aria-hidden="true"]')) out.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 40));
          if (out.length >= 3) break;
        }
        return { sw: document.documentElement.scrollWidth, iw, out };
      });
      const file = join(out, `${slug(url)}_${w}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const sideways = over.sw > over.iw + 1 || over.out.length > 0;
      if (sideways && w === 375) bad++;
      console.log(`${status} ${w}px ${sideways ? 'SIDEWAYS(' + over.sw + '>' + over.iw + ' ' + over.out.join(' | ') + ')' : 'ok'} ${errors.length ? 'console-errors=' + errors.length : ''} ${url}`);
      for (const e of errors.slice(0, 3)) console.log('   ' + e.slice(0, 200));
    } catch (e) {
      bad++;
      console.log(`FAIL ${w}px ${url}: ${String(e).slice(0, 160)}`);
    }
    await page.close();
  }
}
await browser.close();
process.exit(bad ? 1 : 0);
