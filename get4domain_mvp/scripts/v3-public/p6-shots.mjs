// Browser checks and screenshots for the P6 pages (home, pricing, growth) at 375, 768 and 1280 px: the new hero, the Pro plan wording, the three groups
// with their labels, "How you get found", "Business tools", the custom domain pack and its contact link, the titles, and the words that must not appear.
// Usage (from get4domain_mvp, with `next start -p 3112` running: V3_PUBLIC_ENABLED=true V3_PUBLIC_USE_MOCKS=true NEXT_PUBLIC_API_URL=http://127.0.0.1:1
//   MAIN_HOST=localhost DIRECTORY_HOST=directory.localhost NEXT_PUBLIC_SITE_BASE_DOMAIN=localhost NEXT_PUBLIC_VENDOR_APP_URL=https://vendor.example.invalid):
//   node scripts/v3-public/p6-shots.mjs [--base http://localhost:3112] [--out ../docs/v3/p6-shots]
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('--base', 'http://localhost:3112');
const OUT = opt('--out', '../docs/v3/p6-shots');
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
const noScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const BANNED = /launching soon|coming soon|automated campaign builder|\bpaid plans?\b|\bleads\b|justdial|indiamart|Included, done by our team|Included, with an allowance by plan/i;

async function open(width, path, errors) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 60000 });
  return page;
}
const shot = (page, name, width) => page.screenshot({ path: join(OUT, `${name}-${width}.png`), fullPage: true });

for (const width of [375, 768, 1280]) {
  const errors = [];

  // Home
  {
    const page = await open(width, '/', errors);
    const t = await page.evaluate(() => document.body.innerText);
    const title = await page.title();
    check(`home ${width}: title is the default`, title === 'Get4Domain | Local business and domain directory, domain search and web app', title);
    check(`home ${width}: hero kicker, headline and sub line`, /LOCAL BUSINESS DIRECTORY, DOMAIN SEARCH AND WEB APP/.test(t) && /Get your business online, found and getting enquiries\./.test(t) && /Search local businesses and domain names on the Get4Domain directory\. Every business gets a website, business tools and promotion run by our team, in one Pro plan\./.test(t));
    check(`home ${width}: both search tabs`, /Find a business/.test(t) && /Find a domain or website name/.test(t));
    check(`home ${width}: How you get found, four steps`, /How you get found/.test(t) && ['Directory pages by category and area', 'Your Get4Domain subdomain', 'Campaigns run by Get4Domain', 'Enquiries captured in your business app'].every((s) => t.includes(s)));
    check(`home ${width}: Run for you by Get4Domain, Included in Pro`, /Run for you by Get4Domain/.test(t) && /Included in Pro/.test(t) && /Campaigns by SMS, e-mail and WhatsApp/.test(t));
    check(`home ${width}: Business tools lists only working tools`, /Business tools/.test(t) && /Enquiry capture/.test(t) && !/design studio|Reports\b.*Business tools/i.test(t.split('Business tools')[1] ?? ''));
    check(`home ${width}: no banned words`, !BANNED.test(t), (t.match(BANNED) ?? [''])[0]);
    const og = await page.evaluate(() => [document.querySelector('meta[property="og:title"]')?.content, document.querySelector('meta[name="twitter:title"]')?.content, document.querySelector('meta[name="description"]')?.content]);
    check(`home ${width}: Open Graph and Twitter titles and the description`, og[0] === title && og[1] === title && /local business and domain directory/.test(og[2] ?? ''), JSON.stringify(og).slice(0, 120));
    const ld = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent).join(' '));
    check(`home ${width}: Organization and WebSite structured data`, /"Organization"/.test(ld) && /"WebSite"/.test(ld));
    check(`home ${width}: no sideways scroll`, await noScroll(page));
    await shot(page, 'home', width);
    await page.close();
  }

  // Pricing
  {
    const page = await open(width, '/pricing', errors);
    const t = await page.evaluate(() => document.body.innerText);
    const title = await page.title();
    check(`pricing ${width}: title`, /^Pro plans: business website and web app/.test(title), title);
    check(`pricing ${width}: Compare Free and Pro plans, columns Free plan and Pro plans`, /Compare Free and Pro plans/.test(t) && await page.evaluate(() => { const th = [...document.querySelectorAll('#compare-title ~ div table thead th')].map((x) => x.textContent.trim()); return th.includes('Free plan') && th.includes('Pro plans'); }));
    check(`pricing ${width}: labels Included in Pro and Add-on pack, price on request`, /Included in Pro/.test(t) && /Add-on pack, price on request/.test(t));
    check(`pricing ${width}: FAQ has the two new questions`, /What does Get4Domain promote for me\?/.test(t) && /What is the custom domain pack\?/.test(t));
    check(`pricing ${width}: no banned words`, !BANNED.test(t), (t.match(BANNED) ?? [''])[0]);
    check(`pricing ${width}: no sideways scroll`, await noScroll(page));
    await shot(page, 'pricing', width);
    await page.close();
  }

  // Growth
  {
    const page = await open(width, '/growth', errors);
    const t = await page.evaluate(() => document.body.innerText);
    const title = await page.title();
    check(`growth ${width}: title`, /^Pro plan: promotion and enquiries/.test(title), title);
    check(`growth ${width}: How you get found, Business tools and the three groups`, /How you get found/.test(t) && /Business tools/.test(t) && ['Run for you by Get4Domain', 'Self-serve tools in your business app', 'Custom domain pack'].every((s) => t.includes(s)));
    check(`growth ${width}: with a monthly or yearly allowance by plan`, /with a monthly or yearly allowance by plan/.test(t));
    const link = await page.evaluate(() => document.querySelector('a[href="/contact"]')?.textContent ?? '');
    check(`growth ${width}: custom domain pack links to the contact page`, /Ask about the custom domain pack/.test(link), link);
    check(`growth ${width}: nothing launching soon, no builder, no social posting`, !/soon|campaign builder|Social posting/i.test(t));
    check(`growth ${width}: no banned words`, !BANNED.test(t), (t.match(BANNED) ?? [''])[0]);
    check(`growth ${width}: no sideways scroll`, await noScroll(page));
    await shot(page, 'growth', width);
    await page.close();
  }

  check(`no page errors at ${width}`, errors.length === 0, errors.join(' | ').slice(0, 200));
}

await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
