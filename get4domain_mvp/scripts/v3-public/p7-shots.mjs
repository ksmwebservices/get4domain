// Browser checks and screenshots for the P7 register form at 375, 768 and 1280 px: Continue waits for a category (with the reason), the category picker open,
// the starter service chips, the real site address (<name>.<base domain>, never v3site), the Free "being created" screen, and an unknown category refused by the server.
// Usage (from get4domain_mvp, with `next start -p 3112` running: V3_PUBLIC_ENABLED=true V3_PUBLIC_USE_MOCKS=true NEXT_PUBLIC_API_URL=http://127.0.0.1:1
//   MAIN_HOST=localhost DIRECTORY_HOST=directory.localhost NEXT_PUBLIC_SITE_BASE_DOMAIN=get4domain.com NEXT_PUBLIC_VENDOR_APP_URL=https://vendor.example.invalid):
//   node scripts/v3-public/p7-shots.mjs [--base http://localhost:3112] [--out ../docs/v3/p7-shots]
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('--base', 'http://localhost:3112');
const OUT = opt('--out', '../docs/v3/p7-shots');
const BASE_DOMAIN = opt('--base-domain', 'get4domain.com');
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const noScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const shot = (page, name, width, full = false) => page.screenshot({ path: join(OUT, `${name}-${width}.png`), fullPage: full });

async function open(width, url, errors) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  return page;
}
const clickText = (page, sel, re) => page.evaluate((s, r) => Array.from(document.querySelectorAll(s)).find((b) => new RegExp(r).test(b.textContent))?.click(), sel, re.source);

for (const width of [375, 768, 1280]) {
  const errors = [];
  const page = await open(width, `${BASE}/register`, errors);

  // Continue is disabled until a real category is chosen, and the page says why
  let st = await page.evaluate(() => ({ disabled: document.querySelector('button[type=submit]')?.disabled === true, why: document.querySelector('[data-testid=category-why]')?.innerText ?? '' }));
  check(`register ${width}: Continue is disabled with no category and says why`, st.disabled && /Choose your business category from the list/.test(st.why), st.why);
  await shot(page, 'register-no-category', width, true);

  // the picker open: family, then category; search narrows
  await page.click('button#category');
  await page.waitForSelector('[role=dialog]');
  let t = await page.evaluate(() => document.querySelector('[role=dialog]').innerText);
  check(`picker ${width}: families then categories, with a search box`, /FIELD SERVICE/i.test(t) && /Plumber/.test(t) && /Dental clinic/.test(t) && !!(await page.$('[role=dialog] input[type=search]')));
  await page.type('[role=dialog] input[type=search]', 'plum', { delay: 20 });
  t = await page.evaluate(() => document.querySelector('[role=dialog]').innerText);
  check(`picker ${width}: search narrows to the match`, /Plumber/.test(t) && !/Dental clinic/.test(t));
  check(`picker ${width}: no free text can be entered as a category (no text input except search)`, (await page.$$('[role=dialog] input:not([type=search])')).length === 0);
  await shot(page, 'register-picker-open', width);
  await clickText(page, '[role=dialog] button', /Plumber/);
  await page.waitForFunction(() => !document.querySelector('[role=dialog]'));

  // chips from the category's real services, and Continue is now enabled
  await page.waitForSelector('[data-testid=category-services]', { timeout: 8000 }).catch(() => null);
  st = await page.evaluate(() => ({ chips: document.querySelector('[data-testid=category-services]')?.innerText ?? '', disabled: document.querySelector('button[type=submit]')?.disabled === true, why: !!document.querySelector('[data-testid=category-why]') }));
  check(`register ${width}: starter service chips appear for the chosen category`, /Pipe repair/.test(st.chips), st.chips.replace(/\n/g, ' | '));
  check(`register ${width}: Continue is enabled after a category is chosen and the reason is gone`, !st.disabled && !st.why);

  // the real site address
  await page.type('#subdomain', 'adyar-fixers', { delay: 15 });
  await page.waitForFunction(() => /available/i.test(document.querySelector('#subdomain-status')?.innerText ?? ''), { timeout: 8000 }).catch(() => null);
  const addr = await page.evaluate(() => ({ suffix: document.querySelector('[data-testid=address-suffix]')?.innerText ?? '', full: document.querySelector('[data-testid=address-full]')?.innerText ?? '', status: document.querySelector('#subdomain-status')?.innerText ?? '', all: document.body.innerText }));
  check(`register ${width}: the suffix is the real base domain`, addr.suffix === `.${BASE_DOMAIN}`, addr.suffix);
  check(`register ${width}: the full address is <name>.${BASE_DOMAIN}`, addr.full.includes(`adyar-fixers.${BASE_DOMAIN}`), addr.full);
  check(`register ${width}: the page never says v3site`, !/v3site/i.test(addr.all));
  check(`register ${width}: the availability check still answers`, /available/i.test(addr.status), addr.status);
  check(`register ${width}: no sideways scroll`, await noScroll(page));
  await shot(page, 'register-address-chips', width, true);

  // submit the Free form: "being created", the address as text, a sign-in link
  await page.type('#businessName', 'Adyar Fixers', { delay: 5 });
  await page.type('#city', 'Chennai');
  await page.type('#area', 'Adyar');
  await page.type('#pincode', '600020');
  await page.type('#name', 'Asha');
  await page.type('#email', 'asha@example.com');
  await page.type('#password', 'StrongPass1');
  await page.click('#terms');
  await page.click('button[type=submit]');
  await page.waitForSelector('#done-title', { timeout: 10000 });
  const done = await page.evaluate(() => ({ h1: document.querySelector('#done-title').innerText, body: document.querySelector('section[role=status]').innerText, host: document.querySelector('[data-testid=done-host]')?.innerText ?? '', hostIsLink: !!document.querySelector('[data-testid=done-host] a, a[data-testid=done-host]') || Array.from(document.querySelectorAll('a')).some((a) => /adyar-fixers\.get4domain\.com/.test(a.textContent + a.getAttribute('href'))), links: Array.from(document.querySelectorAll('section[role=status] a')).map((a) => a.getAttribute('href')) }));
  check(`done ${width}: "Your free site is being created"`, done.h1 === 'Your free site is being created', done.h1);
  check(`done ${width}: the real address is text, not a link`, done.host === `adyar-fixers.${BASE_DOMAIN}` && !done.hostIsLink, done.host);
  check(`done ${width}: links to the vendor app sign-in`, done.links.some((h) => /vendor\.example\.invalid\/login/.test(h ?? '')), done.links.join(' '));
  check(`done ${width}: no live claim, no payment claim`, !/\b(is live|now live|paid|payment (received|made))\b/i.test(done.body.replace(/we do not say the site is live until it is/i, '')), done.body.slice(0, 120).replace(/\n/g, ' '));
  check(`done ${width}: no sideways scroll`, await noScroll(page));
  await shot(page, 'register-free-created', width, true);
  await page.close();

  // an unknown category (the live incident's text) is refused by the server and never reaches the API
  const p2 = await open(width, `${BASE}/register`, errors);
  const bad = await p2.evaluate(async () => {
    const res = await fetch('/directory-api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessName: 'Adyar Fixers', categoryKey: 'Home repair and trades', industry: 'Home repair and trades', subdomain: 'adyar-fixers', name: 'Asha', email: 'asha@example.com', password: 'StrongPass1', acceptedTerms: true, plan: 'free', city: 'Chennai', area: 'Adyar', pincode: '600020' }) });
    return res.json();
  });
  check(`server ${width}: "Home repair and trades" as a category is refused`, bad.ok === false && bad.fields?.category === 'category' && !bad.handoff, JSON.stringify(bad).slice(0, 100));
  await p2.close();

  check(`page errors ${width}: none`, errors.length === 0, errors.join(' | ').slice(0, 200));
}

await browser.close();
console.log(fails === 0 ? 'ALL PASSED' : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
