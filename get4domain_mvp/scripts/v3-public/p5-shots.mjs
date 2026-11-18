// Browser checks and screenshots for the P5 pages at 375, 768 and 1280 px: search suggestions, domain search, register (Free and by plan),
// the category picker by track with the plan switch, "Is this your business?", the Continue-to-payment screen, and the directory register redirect.
// Usage (from get4domain_mvp, with `next start -p 3112` running: V3_PUBLIC_ENABLED=true V3_PUBLIC_USE_MOCKS=true NEXT_PUBLIC_API_URL=http://127.0.0.1:1
//   MAIN_HOST=localhost DIRECTORY_HOST=directory.localhost NEXT_PUBLIC_SITE_BASE_DOMAIN=localhost NEXT_PUBLIC_VENDOR_APP_URL=https://vendor.example.invalid):
//   node scripts/v3-public/p5-shots.mjs [--base http://localhost:3112] [--out ../docs/v3/p5-shots]
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('--base', 'http://localhost:3112');
const DIR = BASE.replace('//localhost', '//directory.localhost');
const OUT = opt('--out', '../docs/v3/p5-shots');
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
const text = (page) => page.evaluate(() => document.body.innerText);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const noScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

async function open(width, url, errors) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  return page;
}
const shot = (page, name, width, full = false) => page.screenshot({ path: join(OUT, `${name}-${width}.png`), fullPage: full });

for (const width of [375, 768, 1280]) {
  const errors = [];

  // P5.1 search: suggestions on the home box
  {
    const page = await open(width, `${BASE}/`, errors);
    await page.click('#hero-what');
    await page.type('#hero-what', 'plum', { delay: 20 });
    await page.waitForSelector('#hero-what-list [role=option]', { timeout: 8000 }).catch(() => null);
    const t = await page.evaluate(() => document.querySelector('#hero-what-list')?.innerText ?? '');
    check(`search ${width}: businesses and categories are suggested`, /Businesses/i.test(t) && /Sri Murugan Plumbing/.test(t), t.slice(0, 60).replace(/\n/g, ' | '));
    await shot(page, 'search-suggest', width);
    await page.click('#hero-where');
    await page.type('#hero-where', '600020', { delay: 20 });
    await wait(500);
    const w = await page.evaluate(() => document.querySelector('#hero-where-list')?.innerText ?? '');
    check(`search ${width}: a typed pincode is offered as a pincode search`, /pincode 600020/i.test(w), w.replace(/\n/g, ' | '));
    check(`search ${width}: no sideways scroll`, await noScroll(page));
    await page.close();
  }
  // P5.1 honest empty state and unknown place on the directory results
  {
    const page = await open(width, `${DIR}/search?what=plumber&where=Atlantis`, errors);
    const t = await text(page);
    check(`results ${width}: an unknown typed place is said, with no results`, /do not know that place/i.test(t) && /No matching businesses/i.test(t));
    await shot(page, 'results-unknown-place', width);
    await page.close();
    const p2 = await open(width, `${DIR}/search?what=plumbing&where=Adyar`, errors);
    check(`results ${width}: a typed place that exists finds businesses, each with its id`, (await p2.evaluate(() => document.querySelectorAll('li[data-business-id]').length)) > 0);
    await p2.close();
  }
  // P5.2 domain search
  {
    const page = await open(width, `${BASE}/`, errors);
    await page.click('#hero-tab-domain');
    await page.type('#hero-sub', 'fresh-name', { delay: 20 });
    await page.waitForFunction(() => /is available/.test(document.body.innerText), { timeout: 8000 }).catch(() => null);
    let t = await text(page);
    check(`domain ${width}: subdomain available and registrar off, said honestly`, /fresh-name\.localhost is available/.test(t) && /not switched on yet/.test(t));
    await shot(page, 'domain-available', width);
    await page.$eval('#hero-sub', (el) => { el.value = ''; });
    await page.click('#hero-sub', { clickCount: 3 });
    await page.type('#hero-sub', 'sample-pro', { delay: 20 });
    await page.waitForFunction(() => /already taken/.test(document.body.innerText), { timeout: 8000 }).catch(() => null);
    t = await text(page);
    check(`domain ${width}: a taken name says taken and offers no create button`, /already taken/.test(t) && !(await page.$('a[href*="subdomain="]')));
    check(`domain ${width}: no sideways scroll`, await noScroll(page));
    await page.close();
  }
  // P5.7 / P5.5 pricing
  {
    const page = await open(width, `${BASE}/pricing`, errors);
    const t = await text(page);
    check(`pricing ${width}: Pro plans wording, no "Paid plans"`, /Pro plans/.test(t) && !/Paid plans|See paid plans|Move to a paid plan/.test(t));
    const free = await page.evaluate(() => Array.from(document.querySelectorAll('section#free-title, section[aria-labelledby=free-title] a')).map((a) => a.getAttribute('href')));
    check(`pricing ${width}: the Free card goes to /register`, free.includes('/register'), JSON.stringify(free));
    const choose = await page.evaluate(() => Array.from(document.querySelectorAll('a[aria-label^="Choose"]')).map((a) => a.getAttribute('href')));
    check(`pricing ${width}: Choose carries plan and term`, choose.length > 0 && choose.every((h) => /\/register\?plan=[a-z]+&term=12$/.test(h) || /\/register\?plan=[a-z]+$/.test(h)), JSON.stringify(choose));
    await page.close();
  }
  // P5.8 register Free and by plan
  {
    const page = await open(width, `${BASE}/register`, errors);
    let t = await text(page);
    check(`register ${width}: no plan keeps the Free wording and "Create my account"`, /free site/i.test(t) && /Chosen plan: Free plan/.test(t) && /Create my account/.test(t));
    check(`register ${width}: city, area, pincode and GSTIN are there`, ['#city', '#area', '#pincode', '#gstin'].every((s) => true) && (await page.evaluate(() => ['city', 'area', 'pincode', 'gstin'].every((i) => !!document.getElementById(i)))));
    await shot(page, 'register-free', width, true);
    await page.close();
    const p2 = await open(width, `${BASE}/register?plan=handyman&term=12`, errors);
    t = await p2.evaluate(() => document.querySelector('main')?.innerText ?? document.body.innerText);
    check(`register ${width}: by plan, the title, summary, price and the button`, /Create your account for Handyman/.test(t) && /Change plan/.test(t) && /billed annually ₹3,600 \+ GST/.test(t) && /₹300/.test(t) && /Continue to payment/.test(t));
    check(`register ${width}: by plan, never "free site" or "Chosen plan"`, !/free site|Chosen plan/i.test(t));
    check(`register ${width}: Change plan goes to pricing`, await p2.evaluate(() => Array.from(document.querySelectorAll('a')).some((a) => a.textContent === 'Change plan' && a.getAttribute('href') === '/pricing')));
    check(`register ${width}: no sideways scroll`, await noScroll(p2));
    await shot(p2, 'register-pro', width, true);
    await p2.close();
  }
  // P5.9 picker by track and the plan switch
  {
    const page = await open(width, `${BASE}/register?plan=handyman&term=12`, errors);
    await page.click('button#category');
    await page.waitForSelector('[role=dialog]');
    let t = await page.evaluate(() => document.querySelector('[role=dialog]').innerText);
    check(`picker ${width}: only the handyman track is listed, grouped by family`, /Plumber/.test(t) && !/Pharmacy|Dental clinic/.test(t) && /FIELD SERVICE/i.test(t) && /My business isn't here: see all categories/.test(t));
    await shot(page, 'picker-track', width);
    await page.evaluate(() => Array.from(document.querySelectorAll('[role=dialog] button')).find((b) => /isn't here/.test(b.textContent))?.click());
    await page.type('[role=dialog] input[type=search]', 'dental', { delay: 20 });
    t = await page.evaluate(() => document.querySelector('[role=dialog]').innerText);
    check(`picker ${width}: see all finds a category of another track`, /Dental clinic/.test(t));
    await shot(page, 'picker-all-search', width);
    await page.evaluate(() => Array.from(document.querySelectorAll('[role=dialog] button')).find((b) => /Dental clinic/.test(b.textContent))?.click());
    await page.waitForSelector('[data-testid=plan-switched]');
    const after = await page.evaluate(() => ({ notice: document.querySelector('[data-testid=plan-switched]').innerText, h1: document.querySelector('h1').innerText, plan: document.querySelector('[data-testid=summary-plan]').innerText, monthly: document.querySelector('[data-testid=summary-monthly]')?.innerText ?? '' }));
    check(`picker ${width}: a category of another track switches the plan, with a notice and the price updated`, /Professional/.test(after.h1) && after.plan === 'Professional' && /Dental clinic/.test(after.notice) && /₹600/.test(after.monthly), JSON.stringify(after));
    await shot(page, 'plan-switched', width, true);
    await page.close();
    const p2 = await open(width, `${BASE}/register`, errors);
    await p2.click('button#category');
    await p2.waitForSelector('[role=dialog]');
    t = await p2.evaluate(() => document.querySelector('[role=dialog]').innerText);
    check(`picker ${width}: Free lists all categories grouped by family`, /Plumber/.test(t) && /Pharmacy/.test(t) && /Dental clinic/.test(t) && !/isn't here/.test(t));
    await p2.keyboard.press('Escape');
    check(`picker ${width}: Escape closes the sheet`, !(await p2.$('[role=dialog]')));
    await p2.close();
  }
  // P5.3 and P5.10 the duplicate step and the payment screen
  {
    const page = await open(width, `${BASE}/register?plan=handyman&term=12`, errors);
    await page.type('#businessName', 'Adyar Plumbing House');
    await page.click('button#category');
    await page.waitForSelector('[role=dialog]');
    await page.evaluate(() => Array.from(document.querySelectorAll('[role=dialog] button')).find((b) => /^Plumber/.test(b.textContent))?.click());
    await page.type('#city', 'Chennai'); await page.type('#area', 'Adyar'); await page.type('#pincode', '600020');
    await page.type('#subdomain', 'adyar-house'); await page.type('#name', 'Asha'); await page.type('#email', 'asha@example.invalid'); await page.type('#password', 'Password1');
    await page.click('#terms');
    await page.evaluate(() => Array.from(document.querySelectorAll('button[type=submit]')).find((b) => /Continue to payment/.test(b.textContent))?.click());
    await page.waitForSelector('[data-testid=is-this-yours]', { timeout: 8000 }).catch(() => null);
    const t = await page.evaluate(() => document.querySelector('[data-testid=is-this-yours]')?.innerText ?? '');
    check(`duplicate ${width}: "Is this your business?" shows the public listing and a claim link`, /Is this your business\?/.test(t) && /Sri Murugan Plumbing/.test(t) && /claim it/.test(t) && /No, this is a different business/.test(t), t.slice(0, 80).replace(/\n/g, ' | '));
    await shot(page, 'is-this-yours', width, true);
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => /No, this is a different business/.test(b.textContent))?.click());
    await page.waitForFunction(() => /Your account is created/.test(document.body.innerText), { timeout: 8000 }).catch(() => null);
    const done = await page.evaluate(() => ({ text: document.body.innerText, href: Array.from(document.querySelectorAll('a')).find((a) => /Continue to payment/.test(a.textContent))?.getAttribute('href') ?? '' }));
    check(`payment ${width}: "Your account is created. Continue to payment" and no claim of payment`, /Your account is created\. Continue to payment/.test(done.text) && /not paid for yet/.test(done.text) && !/payment (received|successful|complete)|you have paid/i.test(done.text));
    let next = ''; try { next = new URL(done.href).searchParams.get('next') ?? ''; } catch { /* empty */ }
    check(`payment ${width}: the link is the app sign-in with a next address that keeps plan and term`, done.href.startsWith('https://vendor.example.invalid/login?next=') && next === '/app/more/plan?plan=handyman&term=12', done.href);
    await shot(page, 'payment-next', width, true);
    await page.close();
  }
  check(`page errors ${width}: none`, errors.length === 0, errors.join(' | '));
}

// P5.4 the old directory register address
{
  const r = await fetch(`${DIR}/account/register?plan=handyman`, { redirect: 'manual' }).catch((e) => ({ status: 0, headers: new Headers(), err: String(e) }));
  check('directory /account/register: a permanent redirect to the main /register, query kept', r.status === 308 && /\/register\?plan=handyman$/.test(r.headers.get('location') ?? ''), `${r.status} ${r.headers.get('location') ?? r.err ?? ''}`);
}

await browser.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
