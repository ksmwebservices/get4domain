// Screenshots of the P4 pages (pricing, growth, home growth section, footer) at 375, 768 and 1280 px, and the checks behind them.
// Usage (from get4domain_mvp, `next start -p 3110` running with V3_PUBLIC_ENABLED=true and sample data):
//   node scripts/v3-public/p4-shots.mjs [--base http://localhost:3110] [--out ../docs/v3/p4-shots]
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('--base', 'http://localhost:3110');
const OUT = opt('--out', '../docs/v3/p4-shots');
let chrome = opt('--chrome', process.env.CHROME_PATH || '');
if (!chrome) {
  const root = join(homedir(), 'AppData', 'Local', 'ms-playwright');
  const dirs = existsSync(root) ? readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of dirs) { const p = join(root, d, 'chrome-win64', 'chrome.exe'); if (existsSync(p)) { chrome = p; break; } }
}
if (!chrome) { console.error('need --chrome'); process.exit(2); }
mkdirSync(OUT, { recursive: true });

let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });

const pages = [['home', '/v3-site'], ['pricing', '/v3-site/pricing'], ['growth', '/v3-site/growth']];
for (const width of [375, 768, 1280]) {
  for (const [name, path] of pages) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 60000 });
    const tag = `${name} ${width}`;
    check(`${tag}: no sideways scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    check(`${tag}: no page error`, errors.length === 0, errors.join(' | '));
    const text = await page.evaluate(() => document.body.innerText);
    check(`${tag}: no trial wording and no "leads"`, !/free trial|trial site|\bleads?\b/i.test(text));
    check(`${tag}: footer has the Growth services column`, /Growth services/.test(text) && /Compare Free and paid/.test(text));
    if (name === 'pricing') {
      const sel = await page.$('select#portal-term');
      check(`${tag}: the term control is a real select`, !!sel);
      check(`${tag}: annual is the default`, (await page.evaluate(() => document.querySelector('select#portal-term')?.selectedOptions[0]?.textContent ?? '')).startsWith('Annual'));
      check(`${tag}: no price is typed in the page when none came from the route`, /billed annually|Prices are being set/.test(text));
      check(`${tag}: the growth rows and status labels are in the comparison`, /Local-area Google SEO/.test(text) && /Included, done by our team/.test(text) && /Launching soon/.test(text));
      if (width === 375) {
        await page.select('select#portal-term', '3');
        check(`${tag}: choosing Quarterly shows a quarterly billed line`, /billed quarterly/.test(await page.evaluate(() => document.body.innerText)) || /Prices are being set/.test(text));
      }
    }
    if (name === 'growth') check(`${tag}: all five groups and the status labels`, ['Website and tools', 'Google presence', 'Content', 'Campaigns', 'Social'].every((g) => text.includes(g)) && /Launching soon/.test(text));
    if (name === 'home') check(`${tag}: Get found and get enquiries section`, /Get found and get enquiries/.test(text) && /Website, business tools and promotion in one plan/.test(text));
    await page.screenshot({ path: join(OUT, `${name}-${width}.png`), fullPage: true });
    await page.close();
  }
}
await browser.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
