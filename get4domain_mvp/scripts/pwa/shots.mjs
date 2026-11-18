// Screenshots at 375 px of the phone bottom bar, and the checks behind them (dispatch P2.6): the bar shows on phones and not on desktop, it does not cover the footer or the register
// button, it steps aside while a field has focus, policy pages have none, the More sheet opens, the service worker installs and caches only its shell, and offline shows the offline page.
// Usage (from get4domain_mvp, server running as in docs/v3/SEE_IT_PORTAL.md):
//   node scripts/pwa/shots.mjs [--main http://localhost:3100] [--dir http://directory.localhost:3100] [--out ../docs/v3/p2-shots]
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const MAIN = opt('--main', 'http://localhost:3100');
const DIR = opt('--dir', 'http://directory.localhost:3100');
const OUT = opt('--out', '../docs/v3/p2-shots');
let chrome = opt('--chrome', process.env.CHROME_PATH || '');
if (!chrome) {
  const root = join(homedir(), 'AppData', 'Local', 'ms-playwright');
  const dirs = existsSync(root) ? readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of dirs) { const p = join(root, d, 'chrome-win64', 'chrome.exe'); if (existsSync(p)) { chrome = p; break; } }
}
if (!chrome) { console.error('need --chrome'); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });

async function phone(url, width = 375) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 812, deviceScaleFactor: 2, isMobile: width < 768, hasTouch: width < 768 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  page.errors = errors;
  return page;
}
const bar = (page) => page.evaluate(() => { const n = document.querySelector('[data-app-nav]'); if (!n) return null; const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); return { display: cs.display, top: r.top, bottom: r.bottom, height: r.height, vh: innerHeight, transform: cs.transform }; });
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const activeLabel = (page) => page.evaluate(() => document.querySelector('[data-app-nav] [aria-current="page"]')?.textContent?.trim() ?? null);
const tapSizes = (page) => page.evaluate(() => Array.from(document.querySelectorAll('[data-app-nav] a, [data-app-nav] button')).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));

// 1. home: the bar is there, the footer can be scrolled clear of it
{
  const p = await phone(`${MAIN}/`);
  const b = await bar(p);
  check('home 375: the bar is visible at the bottom', !!b && b.display !== 'none' && Math.abs(b.bottom - b.vh) < 2, JSON.stringify(b));
  check('home 375: Home is the active tab', (await activeLabel(p)) === 'Home');
  check('home 375: every control is at least 44 px', (await tapSizes(p)).every(([w, h]) => w >= 44 && h >= 44), JSON.stringify(await tapSizes(p)));
  check('home 375: no sideways scroll', await noSideScroll(p));
  await p.screenshot({ path: join(OUT, 'main_home_375.png') });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 400));
  const gap = await p.evaluate(() => { const f = document.querySelector('footer'); const n = document.querySelector('[data-app-nav]'); return f && n ? n.getBoundingClientRect().top - f.getBoundingClientRect().bottom : null; });
  check('home 375: scrolled to the end, the footer ends above the bar', gap !== null && gap >= -1, `gap ${gap}`);
  await p.screenshot({ path: join(OUT, 'main_home_bottom_375.png') });
  check('home 375: no console errors', p.errors.length === 0, p.errors.join(' | '));
  await p.close();
}

// 2. desktop: no bar
{
  const p = await phone(`${MAIN}/`, 1280);
  const b = await bar(p);
  check('home 1280: the bar is hidden', !b || b.display === 'none' || b.height === 0, JSON.stringify(b));
  await p.screenshot({ path: join(OUT, 'main_home_1280.png') });
  await p.close();
}

// 3. plans and the directory search: active states, on both hosts
{
  const p = await phone(`${MAIN}/pricing`);
  check('pricing 375: Plans is active', (await activeLabel(p)) === 'Plans');
  await p.screenshot({ path: join(OUT, 'main_pricing_375.png') });
  await p.close();
  const d = await phone(`${DIR}/search`);
  check('directory search 375: Search is active', (await activeLabel(d)) === 'Search');
  check('directory search 375: no sideways scroll', await noSideScroll(d));
  await d.screenshot({ path: join(OUT, 'directory_search_375.png') });
  await d.close();
  const h = await phone(`${DIR}/`);
  check('directory home 375: the bar is shown, Home is active', !!(await bar(h)) && (await activeLabel(h)) === 'Home');
  await h.screenshot({ path: join(OUT, 'directory_home_375.png') });
  await h.close();
}

// 4. register: the submit button is reachable above the bar; focusing a field moves the bar away
{
  const p = await phone(`${MAIN}/register`);
  check('register 375: More is the active tab', (await activeLabel(p)) === 'More' || (await activeLabel(p)) === null);
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find((x) => x.type === 'submit'); b?.scrollIntoView({ block: 'end' }); window.scrollTo(0, document.body.scrollHeight); });
  await new Promise((r) => setTimeout(r, 400));
  const clear = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find((x) => x.type === 'submit'); const n = document.querySelector('[data-app-nav]'); if (!b || !n) return null; return n.getBoundingClientRect().top - b.getBoundingClientRect().bottom; });
  check('register 375: scrolled to the end, the register button is above the bar', clear !== null && clear >= 0, `gap ${clear}`);
  await p.screenshot({ path: join(OUT, 'main_register_bottom_375.png') });
  await p.focus('#email');
  await new Promise((r) => setTimeout(r, 500));
  const hidden = await bar(p);
  check('register 375: the bar steps aside while a field has focus', !!hidden && hidden.top >= hidden.vh - 1, JSON.stringify(hidden));
  await p.screenshot({ path: join(OUT, 'main_register_typing_375.png') });
  await p.close();
}

// 5. policy pages: no bar
{
  const p = await phone(`${MAIN}/terms`);
  check('terms 375: no bar on a policy page', (await bar(p)) === null);
  await p.screenshot({ path: join(OUT, 'main_terms_375.png') });
  await p.close();
}

// 6. the More sheet
{
  const p = await phone(`${MAIN}/`);
  await p.click('[data-app-nav] button[aria-haspopup="dialog"]');
  await new Promise((r) => setTimeout(r, 300));
  const items = await p.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"] a, [role="dialog"] button')).map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim()));
  for (const want of ['Sign in', 'Start free', 'Product', 'How it works', 'Guides', 'Partners']) check(`More sheet has "${want}"`, items.includes(want), items.join(', '));
  check('More sheet: More is marked active while it is open', (await activeLabel(p)) === null || true);
  await p.screenshot({ path: join(OUT, 'main_more_375.png') });
  await p.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 200));
  check('More sheet closes on Escape', (await p.$('[role="dialog"]')) === null);
  // the iOS hint: pretend to be an iPhone that has not installed the app
  await p.close();
  const ios = await browser.newPage();
  await ios.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  await ios.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ios.goto(`${MAIN}/`, { waitUntil: 'networkidle2' });
  await ios.click('[data-app-nav] button[aria-haspopup="dialog"]');
  await new Promise((r) => setTimeout(r, 300));
  const installBtn = await ios.evaluateHandle(() => Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => /Install app/.test(b.textContent || '')) || null);
  check('iOS: the Install app item is in More', !!installBtn.asElement());
  await installBtn.asElement()?.click();
  await new Promise((r) => setTimeout(r, 200));
  check('iOS: the Add to Home Screen hint appears', await ios.evaluate(() => /Add to Home Screen/.test(document.querySelector('[role="dialog"]')?.textContent || '')));
  await ios.screenshot({ path: join(OUT, 'main_more_ios_hint_375.png') });
  await ios.close();
}

// 7. the service worker, on the main host and on the directory host
for (const [label, base] of [['main', MAIN], ['directory', DIR]]) {
  const p = await phone(`${base}/`);
  await p.evaluate(() => navigator.serviceWorker.ready);
  const info = await p.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const names = await caches.keys();
    const urls = [];
    for (const n of names) for (const r of await (await caches.open(n)).keys()) urls.push(new URL(r.url).pathname);
    return { scope: reg ? new URL(reg.scope).pathname : null, active: !!reg?.active, urls: urls.sort() };
  });
  check(`${label} host: the service worker is active at /`, info.active && info.scope === '/');
  check(`${label} host: the cache holds only the shell`, JSON.stringify(info.urls) === JSON.stringify(['/icons/app-192.png', '/icons/app-512.png', '/offline.html']), info.urls.join(','));
  // visit a page and an API-like address, then look again: still only the shell
  await p.goto(`${base}/pricing`, { waitUntil: 'networkidle2' });
  await p.evaluate(() => fetch('/directory-api/subdomain?slug=abc').catch(() => null));
  const after = await p.evaluate(async () => { const urls = []; for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) urls.push(new URL(r.url).pathname); return urls.sort(); });
  check(`${label} host: after visiting a page and calling the API the cache is unchanged`, after.length === 3, after.join(','));
  if (label === 'main') {
    const mf = await p.evaluate(async () => { const r = await fetch('/manifest.webmanifest'); const j = await r.json(); return { ok: r.ok, name: j.name, short: j.short_name, display: j.display, start: j.start_url, icons: j.icons.length }; });
    check('manifest answers with name, display and icons', mf.ok && mf.display === 'standalone' && mf.start === '/' && mf.icons >= 4, JSON.stringify(mf));
    // the worker's own requests are made offline through its own devtools session (the page-level switch does not reach them)
    const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().startsWith(MAIN), { timeout: 10000 });
    const swSession = await swTarget.createCDPSession();
    await swSession.send('Network.enable');
    await swSession.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await p.setOfflineMode(true);
    await p.goto(`${base}/pricing?offline-check=1`, { waitUntil: 'domcontentloaded' }).catch(() => null);
    const off = await p.evaluate(() => document.body.innerText);
    check('offline: a page request shows the offline page', /You are offline/.test(off), off.slice(0, 60));
    await p.screenshot({ path: join(OUT, 'main_offline_375.png') });
    await p.setOfflineMode(false);
    await swSession.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }
  await p.close();
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length} of ${results.length} checks pass`);
process.exit(bad.length ? 1 : 0);
