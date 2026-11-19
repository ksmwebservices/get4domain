// Browser checks and screenshots for P9 at 375, 768 and 1280 px: the live case. A fake local backend (127.0.0.1) serves the exact answer shape for subdomain plumberboy; the site app is built with a
// WRONG NEXT_PUBLIC_API_URL (nothing listens there) and told the right address only through the runtime INTERNAL_API_URL, and requested with Host: plumberboy.get4domain.com.
// Usage (from get4domain_mvp): build with NEXT_PUBLIC_API_URL=http://127.0.0.1:3197 V3_PUBLIC_ENABLED=true V3_PUBLIC_USE_MOCKS=true, then
//   INTERNAL_API_URL=http://127.0.0.1:3199 npx next start -p 3113   and   node scripts/v3-public/p9-shots.mjs [--port 3113] [--out ../docs/v3/p9-shots]
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { startFakeBackend } from './fake-backend-p9.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PORT = opt('--port', '3113');
const OUT = opt('--out', '../docs/v3/p9-shots');
let chrome = opt('--chrome', process.env.CHROME_PATH || '');
if (!chrome) {
  const root = join(homedir(), 'AppData', 'Local', 'ms-playwright');
  const dirs = existsSync(root) ? readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of dirs) { const p = join(root, d, 'chrome-win64', 'chrome.exe'); if (existsSync(p)) { chrome = p; break; } }
}
if (!chrome) { console.error('need --chrome'); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const fake = await startFakeBackend(3199);
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--host-resolver-rules=MAP *.get4domain.com 127.0.0.1'] }); // every vendor host name is answered by the local site app only
const noScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

async function visit(width, sub, errors) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = await page.goto(`http://${sub}.get4domain.com:${PORT}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  return { page, status: res.status() };
}

try {
  for (const width of [375, 768, 1280]) {
    const errors = [];

    // the live case
    {
      const { page, status } = await visit(width, 'plumberboy', errors);
      const t = await page.evaluate(() => ({
        text: document.body.innerText, html: document.documentElement.outerHTML, title: document.title, free: !!document.querySelector('[data-testid=free-site]'),
        els: Array.from(document.querySelectorAll('a, button, form, input, textarea, select, iframe')).map((e) => e.tagName.toLowerCase()),
      }));
      check(`plumberboy ${width}: answers 200 with a page title, not a bare 404`, status === 200 && /Plumber Boy/.test(t.title), `${status} "${t.title}"`);
      check(`plumberboy ${width}: the Free information page is shown`, t.free && /Plumber Boy/.test(t.text) && /Quick plumbing repairs/.test(t.text) && /Tap and pipe repair/.test(t.text));
      check(`plumberboy ${width}: the phone is plain text`, /Phone: \+91 98765 43210/.test(t.text) && !/href="tel:/.test(t.html));
      check(`plumberboy ${width}: no form, button, input, link, e-mail, WhatsApp or chat`, t.els.length === 0 && !/mailto:|wa\.me|whatsapp|chatbot/i.test(t.html) && !/@/.test(t.text), t.els.join(','));
      check(`plumberboy ${width}: no logo image and no address line is invented`, !/<img[^>]*alt="[^"]*logo/i.test(t.html) && !/Adyar|Chennai/.test(t.text));
      const banner = await page.evaluate(() => { const i = document.querySelector('[data-testid=free-site] main img'); return i ? { src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, shown: i.getBoundingClientRect().height > 20 } : null; });
      check(`plumberboy ${width}: the /starter/ banner renders (loaded, not blank)`, !!banner && banner.src === '/starter/generic/hero.svg' && banner.ok && banner.shown, JSON.stringify(banner));
      check(`plumberboy ${width}: no sideways scroll`, await noScroll(page));
      await page.screenshot({ path: join(OUT, `free-information-page-${width}.png`), fullPage: true });
      await page.close();
    }

    // neighbours: a Pro site with an unknown industry gets the generic design (not a 404); an unknown address stays not-found
    {
      const { page } = await visit(width, 'pro-unknown', errors);
      const t = await page.evaluate(() => ({ title: document.title, text: document.body.innerText, free: !!document.querySelector('[data-testid=free-site]') }));
      check(`pro-unknown ${width}: a non-Free site with an unknown industry renders the generic design`, !t.free && /Pro Unknown/.test(t.title) && /Pro Unknown/.test(t.text) && !/404/.test(t.text), t.title);
      await page.close();
      const th = await visit(width, 'themed-pro', errors);
      const tt = await th.page.evaluate(() => ({ title: document.title, text: document.body.innerText, free: !!document.querySelector('[data-testid=free-site]') }));
      check(`themed-pro ${width}: a themed Pro site renders (built-in design when its package is missing), never the Free page or a 404`, !tt.free && /Themed Pro/.test(tt.text) && !/404/.test(tt.text), tt.title);
      await th.page.close();
      const q = await visit(width, 'draft-site', errors);
      check(`draft ${width}: still "This site is being set up"`, await q.page.evaluate(() => document.querySelector('h1')?.innerText === 'This site is being set up'));
      await q.page.close();
      const u = await visit(width, 'nobody-here', errors);
      check(`unknown ${width}: still the not-found page`, await u.page.evaluate(() => /404|not found|could not be found/i.test(document.body.innerText) && !/being set up/i.test(document.body.innerText)));
      await u.page.close();
    }
    check(`page errors ${width}: none`, errors.length === 0, errors.join(' | ').slice(0, 200));
  }
  check('the fake backend was asked through the runtime address (the built-in address points nowhere)', fake.log.some((l) => l.startsWith('GET /cms/site')), fake.log.slice(0, 4).join(', '));
  check('the theme package of the themed Pro site was asked from the same runtime address', fake.log.includes('GET /themes/package/t-missing'), fake.log.filter((l) => l.includes('themes')).join(', '));
} finally {
  await browser.close();
  await fake.close();
}
console.log(fails === 0 ? 'ALL PASSED' : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
