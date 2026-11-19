// Browser checks and screenshots for P10 at 375, 768 and 1280 px, with the LIVE settings: V3_PUBLIC_ENABLED=true, V3_PUBLIC_USE_MOCKS=false, MAIN_HOST=v3site.get4domain.com and the other portal hosts,
// NEXT_PUBLIC_SITE_BASE_DOMAIN=get4domain.com (inlined at build), INTERNAL_API_URL (runtime) pointing at a fake local backend. Every *.get4domain.com name is mapped to 127.0.0.1 in the browser,
// so nothing leaves this machine. The site app is asked for plumberboy.get4domain.com and the portal and reserved hosts as the live container would be.
// Usage (from get4domain_mvp): build and start with the live settings above (NEXT_PUBLIC_API_URL pointing nowhere, INTERNAL_API_URL=http://127.0.0.1:3199), `next start -p 3114`, then
//   node scripts/v3-public/p10-shots.mjs [--port 3114] [--out ../docs/v3/p10-shots]
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { startFakeBackend } from './fake-backend-p9.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PORT = opt('--port', '3114');
const OUT = opt('--out', '../docs/v3/p10-shots');
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
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--host-resolver-rules=MAP *.get4domain.com 127.0.0.1, MAP get4domain.com 127.0.0.1'] });
const noScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

async function visit(width, host, errors, path = '/') {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
  page.on('pageerror', (e) => errors.push(`${host}: ${e}`));
  const res = await page.goto(`http://${host}:${PORT}${path}`, { waitUntil: 'networkidle2', timeout: 60000 });
  return { page, status: res.status() };
}
const plain404 = (page) => page.evaluate(() => document.body.innerText.trim() === 'Not found');

try {
  for (const width of [375, 768, 1280]) {
    const errors = [];

    // the live case: a Free vendor under the base domain (not under the portal main host)
    {
      const { page, status } = await visit(width, 'plumberboy.get4domain.com', errors);
      const t = await page.evaluate(() => ({
        title: document.title, text: document.body.innerText, html: document.documentElement.outerHTML, free: !!document.querySelector('[data-testid=free-site]'),
        els: Array.from(document.querySelectorAll('a, button, form, input, textarea, select, iframe')).map((e) => e.tagName.toLowerCase()),
        banner: (() => { const i = document.querySelector('[data-testid=free-site] main img'); return i ? { ok: i.complete && i.naturalWidth > 0, shown: i.getBoundingClientRect().height > 20 } : null; })(),
      }));
      check(`plumberboy ${width}: not a 404, has a page title`, status === 200 && /Plumber Boy/.test(t.title), `${status} "${t.title}"`);
      check(`plumberboy ${width}: the Free information page`, t.free && /Quick plumbing repairs/.test(t.text) && /Tap and pipe repair/.test(t.text) && /Phone: \+91 98765 43210/.test(t.text));
      check(`plumberboy ${width}: starter banner renders`, !!t.banner && t.banner.ok && t.banner.shown, JSON.stringify(t.banner));
      check(`plumberboy ${width}: no form, button, input, link, e-mail or chat`, t.els.length === 0 && !/mailto:|wa\.me|whatsapp|chatbot/i.test(t.html) && !/@/.test(t.text), t.els.join(','));
      check(`plumberboy ${width}: no sideways scroll`, await noScroll(page));
      await page.screenshot({ path: join(OUT, `free-vendor-site-${width}.png`), fullPage: true });
      await page.close();
    }

    // Pro neighbours and the P8 pages on the same host rule, also with a capital letter and a trailing dot
    {
      const a = await visit(width, 'themed-pro.get4domain.com', errors);
      check(`themed-pro ${width}: a Pro site renders (not the Free page, not a 404)`, a.status === 200 && await a.page.evaluate(() => !document.querySelector('[data-testid=free-site]') && /Themed Pro/.test(document.body.innerText)));
      await a.page.close();
      const b = await visit(width, 'pro-unknown.get4domain.com', errors);
      check(`pro-unknown ${width}: unknown industry renders the generic design`, b.status === 200 && await b.page.evaluate(() => /Pro Unknown/.test(document.title)));
      await b.page.close();
      const c = await visit(width, 'draft-site.get4domain.com', errors);
      check(`draft ${width}: "This site is being set up"`, await c.page.evaluate(() => document.querySelector('h1')?.innerText === 'This site is being set up'));
      await c.page.close();
      const d = await visit(width, 'nobody-here.get4domain.com', errors);
      check(`unknown vendor ${width}: the not-found page, not "being set up"`, await d.page.evaluate(() => /404|not found|could not be found/i.test(document.body.innerText) && !/being set up/i.test(document.body.innerText)));
      await d.page.close();
    }

    // portal hosts keep working; reserved names and v3 names are never vendors
    {
      const m = await visit(width, 'v3site.get4domain.com', errors);
      check(`portal ${width}: v3site is the marketing site`, m.status === 200 && await m.page.evaluate(() => !document.querySelector('[data-testid=free-site]') && /Get4Domain/i.test(document.body.innerText)), `${m.status}`);
      await m.page.screenshot({ path: join(OUT, `portal-v3site-${width}.png`) });
      await m.page.close();
      const dir = await visit(width, 'v3directory.get4domain.com', errors);
      check(`portal ${width}: v3directory is the directory (not a vendor page)`, dir.status < 500 && await dir.page.evaluate(() => !document.querySelector('[data-testid=free-site]') && !/Plumber Boy/.test(document.body.innerText)), `${dir.status}`);
      await dir.page.close();
      for (const host of ['v3app.get4domain.com', 'v3api.get4domain.com', 'v3foo.get4domain.com', 't3-site.get4domain.com', 'partner.get4domain.com', 'www.get4domain.com', 'admin.get4domain.com']) {
        const r = await visit(width, host, errors);
        check(`reserved ${width}: ${host} is a plain 404, never a vendor`, r.status === 404 && await plain404(r.page), `${r.status}`);
        await r.page.close();
      }
    }
    check(`page errors ${width}: none`, errors.length === 0, errors.join(' | ').slice(0, 300));
  }
  check('the fake backend was asked at the runtime address (the built-in address points nowhere)', fake.log.some((l) => l.startsWith('GET /cms/site/plumberboy')), fake.log.slice(0, 3).join(', '));
} finally {
  await browser.close();
  await fake.close();
}
console.log(fails === 0 ? 'ALL PASSED' : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
