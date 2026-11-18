// Drives the portal in a real browser: the category mega menu, the shared search with suggestions, the domain tab, the phone drawer, and keyboard focus.
// Usage (from get4domain_mvp, with the server of SEE_IT_PORTAL.md running on port 3000, or pass --base http://localhost:3100):
//   node scripts/j1-interact.mjs [--base http://localhost:3000] [--chrome "<path to chrome.exe>"]
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
let base = 'http://localhost:3000';
let dirBase = '';
let chrome = process.env.CHROME_PATH || '';
for (let i = 0; i < args.length; i++) { if (args[i] === '--base') base = args[++i]; else if (args[i] === '--chrome') chrome = args[++i]; }
dirBase = base.replace('//localhost', '//directory.localhost');
if (!chrome) {
  const root = join(homedir(), 'AppData', 'Local', 'ms-playwright');
  if (existsSync(root)) for (const d of readdirSync(root).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()) { const p = join(root, d, 'chrome-win64', 'chrome.exe'); if (existsSync(p)) { chrome = p; break; } }
}
if (!chrome) { console.error('need --chrome'); process.exit(2); }

let failed = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });

// desktop
let page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`${base}/`, { waitUntil: 'networkidle2' });
await page.click('button[aria-controls="portal-mega"]');
await sleep(200);
ok(await page.$eval('#portal-mega', (el) => el.querySelectorAll('a').length >= 3).catch(() => false), 'mega menu opens and lists categories');
await page.keyboard.press('Escape');
ok(!(await page.$('#portal-mega')), 'Escape closes the mega menu');

ok(await page.$eval('#hero-panel-business', (el) => /\/search$/.test(el.getAttribute('action') ?? '')), 'the home search form goes to the directory search page');
await page.close();

// the same search on the directory host: suggestions, picked filters, results
page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`${dirBase}/`, { waitUntil: 'networkidle2' });
await page.click('#dir-what');
await page.type('#dir-what', 'plu');
await sleep(500);
ok(await page.$eval('#dir-what-list', (el) => /Plumbers/.test(el.textContent)).catch(() => false), 'typing "plu" suggests the category Plumbers');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
ok((await page.$eval('#dir-what', (el) => el.value)) === 'Plumbers', 'Enter picks the suggestion');
await page.click('#dir-where');
await page.type('#dir-where', 'chen');
await sleep(300);
ok(await page.$eval('#dir-where-list', (el) => /Chennai/.test(el.textContent)).catch(() => false), 'typing "chen" suggests the place Chennai');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click('#dir-panel-business button[type="submit"]')]);
const url = new URL(page.url());
ok(url.pathname === '/search' && url.searchParams.get('c') === 'plumbers' && url.searchParams.get('l') === 'tamil-nadu/chennai', `the search goes to the results page with the picked filters (${url.pathname}${url.search})`);
ok(/4 businesses found/.test(await page.$eval('main', (el) => el.textContent)), 'the results page shows the matching businesses (sample data)');
await page.close();

page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
// the domain tab on the home page
await page.goto(`${base}/`, { waitUntil: 'networkidle2' });
await page.click('#domain-tab-domain');
await page.type('#domain-sub', 'zz');
await sleep(300);
ok(/too short/.test(await page.$eval('#domain-sub-status', (el) => el.textContent)), 'a short website name is said to be too short');
await page.type('#domain-sub', 'zzshop');
await sleep(1200);
const st = await page.$eval('#domain-sub-status', (el) => el.textContent);
ok(st.length > 0 && !/checking/i.test(st), `the website name gets an answer from the availability route (${st.trim()})`);
ok(/Registering new domain names opens soon/.test(await page.$eval('#domain-panel-domain', (el) => el.textContent)), 'a custom domain gets the honest note, never a made-up "available"');
await page.keyboard.press('Tab');
const focusRing = await page.evaluate(() => { const a = document.activeElement; return a ? getComputedStyle(a).boxShadow !== 'none' || getComputedStyle(a).outlineStyle !== 'none' : false; });
ok(focusRing, 'the focused control shows a focus ring');
await page.close();

// phone
page = await browser.newPage();
await page.setViewport({ width: 375, height: 800 });
await page.goto(`${base}/`, { waitUntil: 'networkidle2' });
await page.click('button[aria-controls="portal-drawer"]');
await sleep(200);
ok(!!(await page.$('#portal-drawer')), 'the Menu button opens the drawer');
ok(await page.evaluate(() => document.body.style.overflow === 'hidden'), 'the page does not scroll behind the drawer');
await page.keyboard.press('Escape');
await sleep(200);
ok(!(await page.$('#portal-drawer')), 'Escape closes the drawer');
await page.close();

await browser.close();
process.exit(failed ? 1 : 0);
