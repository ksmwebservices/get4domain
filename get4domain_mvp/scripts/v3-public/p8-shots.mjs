// Browser checks and screenshots for P8 at 375, 768 and 1280 px: a draft address shows "This site is being set up" (not a bare 404), an unknown address stays 404,
// and a Free site shows information only (no form, chat, button, link or e-mail). A tiny fake API on 127.0.0.1:3199 stands in for the backend.
// Usage (from get4domain_mvp): build and start with NEXT_PUBLIC_API_URL=http://127.0.0.1:3199 (it is read at build time), V3_PUBLIC_ENABLED=true V3_PUBLIC_USE_MOCKS=true, next start -p 3112, then
//   node scripts/v3-public/p8-shots.mjs [--base http://localhost:3112] [--out ../docs/v3/p8-shots]
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const BASE = opt('--base', 'http://localhost:3112');
const OUT = opt('--out', '../docs/v3/p8-shots');
let chrome = opt('--chrome', process.env.CHROME_PATH || '');
if (!chrome) {
  const root = join(homedir(), 'AppData', 'Local', 'ms-playwright');
  const dirs = existsSync(root) ? readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of dirs) { const p = join(root, d, 'chrome-win64', 'chrome.exe'); if (existsSync(p)) { chrome = p; break; } }
}
if (!chrome) { console.error('need --chrome'); process.exit(2); }
mkdirSync(OUT, { recursive: true });

// the fake backend: site "free-fixers" is a live Free site, "draft-site" exists as a draft (no site data), anything else does not exist
const FREE = { data: { vendor: { id: 'v1', businessName: 'Free Fixers', industry: 'plumber', subdomain: 'free-fixers' }, plan: 'FREE', docV2: true, products: [{ id: 'p1', name: 'Tap repair', description: 'Quick fix', price: '300', image: null, category: null, customFields: null }],
  cms: { businessName: 'Free Fixers', tagline: 'Repairs at home', about: 'We fix taps and pipes in Adyar.', logo: null, banner: null, phone: '+91 98765 43210', whatsapp: '+919876543210', email: 'owner@example.com', address: 'Adyar, Chennai', seoTitle: null, seoDesc: null, seoKeywords: null } } };
const api = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const json = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  const m = /^\/cms\/(site|site-state)\/([a-z0-9-]+)$/.exec(u.pathname);
  if (!m) return json(404, {});
  const [, kind, sub] = m;
  if (kind === 'site') return sub === 'free-fixers' ? json(200, FREE) : json(404, { message: 'Site not found' });
  if (sub === 'free-fixers') return json(200, { exists: true, status: 'LIVE' });
  if (sub === 'draft-site') return json(200, { exists: true, status: 'DRAFT' });
  return json(200, { exists: false, status: 'NOT_FOUND' });
});
await new Promise((r) => api.listen(3199, '127.0.0.1', r));

let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
const noScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const shot = (page, name, width) => page.screenshot({ path: join(OUT, `${name}-${width}.png`), fullPage: true });

async function visit(width, sub, errors) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = await page.goto(`${BASE}/site/${sub}`, { waitUntil: 'networkidle2', timeout: 60000 });
  return { page, status: res.status() };
}

try {
  for (const width of [375, 768, 1280]) {
    const errors = [];

    // a draft address: friendly page, not a bare 404
    {
      const { page, status } = await visit(width, 'draft-site', errors);
      const t = await page.evaluate(() => ({ h1: document.querySelector('h1')?.innerText ?? '', text: document.body.innerText, extras: document.querySelectorAll('a, button, form, input, textarea, iframe').length }));
      check(`draft ${width}: "This site is being set up"`, t.h1 === 'This site is being set up', t.h1);
      check(`draft ${width}: not a bare 404 page`, !/could not be found|404/i.test(t.text), t.text.slice(0, 80).replace(/\n/g, ' '));
      check(`draft ${width}: no link, button, form or input`, t.extras === 0, String(t.extras));
      check(`draft ${width}: not offered to search engines`, await page.evaluate(() => /noindex/.test(document.querySelector('meta[name=robots]')?.content ?? '')));
      check(`draft ${width}: no sideways scroll`, await noScroll(page));
      void status;
      await shot(page, 'site-being-set-up', width);
      await page.close();
    }

    // an unknown address stays a 404
    {
      const { page, status } = await visit(width, 'nobody-here', errors);
      const t = await page.evaluate(() => ({ text: document.body.innerText }));
      // the not-found page itself (Next streams it with status 200 here, as it did before P8; the status is reported, not asserted)
      check(`unknown ${width}: shows the not-found page, never "being set up"`, /404|not be found|not found/i.test(t.text) && !/being set up/i.test(t.text), `status ${status}: ${t.text.slice(0, 60).replace(/\n/g, ' ')}`);
      await page.close();
    }

    // a Free site: information only
    {
      const { page } = await visit(width, 'free-fixers', errors);
      const t = await page.evaluate(() => ({
        text: document.body.innerText, html: document.documentElement.outerHTML,
        els: Array.from(document.querySelectorAll('a, button, form, input, textarea, select, iframe')).map((e) => e.tagName.toLowerCase()),
        free: !!document.querySelector('[data-testid=free-site]'),
      }));
      check(`free ${width}: the Free page is shown`, t.free && /Free Fixers/.test(t.text) && /Tap repair/.test(t.text) && /We fix taps/.test(t.text));
      check(`free ${width}: no form, button, input or link`, t.els.length === 0, t.els.join(','));
      check(`free ${width}: no e-mail address`, !/owner@example\.com|mailto:/i.test(t.html) && !/@/.test(t.text));
      check(`free ${width}: no WhatsApp, no chat widget`, !/wa\.me|whatsapp|chat/i.test(t.text) && !/wa\.me|chatbot|chat-widget/i.test(t.html));
      check(`free ${width}: the phone number is plain text`, /Phone: \+91 98765 43210/.test(t.text) && !/href="tel:/.test(t.html));
      check(`free ${width}: no sideways scroll`, await noScroll(page));
      await shot(page, 'free-site', width);
      await page.close();
    }
    check(`page errors ${width}: none`, errors.length === 0, errors.join(' | ').slice(0, 200));
  }
} finally {
  await browser.close();
  api.close();
}
console.log(fails === 0 ? 'ALL PASSED' : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
