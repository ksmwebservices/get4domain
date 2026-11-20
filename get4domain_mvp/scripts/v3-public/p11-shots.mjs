// Browser checks and screenshots for P11 (the theme design kit and the mobile app shell) at 375 and 1280 px (and 768 for the layout switch), with the live settings of P10:
// V3_PUBLIC_ENABLED=true, V3_PUBLIC_USE_MOCKS=false, the portal hosts, NEXT_PUBLIC_SITE_BASE_DOMAIN=get4domain.com, INTERNAL_API_URL pointing at a fake local backend. Every *.get4domain.com
// name is mapped to 127.0.0.1 in the test browser, so nothing leaves this machine.
// Usage (from get4domain_mvp): build and start with those settings, `next start -p 3115`, then
//   node scripts/v3-public/p11-shots.mjs [--port 3115] [--out ../docs/v3/p11-shots]
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { startFakeBackend } from './fake-backend-p11.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PORT = opt('--port', '3115');
const OUT = opt('--out', '../docs/v3/p11-shots');
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
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

async function visit(width, host, errors, o = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: o.height ?? 900, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
  if (o.ua) await page.setUserAgent(o.ua);
  page.on('pageerror', (e) => errors.push(`${host}: ${e}`));
  const res = await page.goto(`http://${host}:${PORT}${o.path ?? '/'}`, { waitUntil: 'networkidle2', timeout: 60000 });
  return { page, status: res.status() };
}
const facts = (page) => page.evaluate(() => {
  const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
  const bottom = document.querySelector('[data-testid=bottom-nav]'); const top = document.querySelector('[data-testid=top-nav] .sk-dnav');
  const root = document.querySelector('[data-testid=site-app]');
  const foot = document.querySelector('.sk-foot small');
  return {
    title: document.title, h1: Array.from(document.querySelectorAll('h1')).map((h) => h.innerText),
    mode: root?.dataset.mode, theme: root?.dataset.theme, hero: root?.dataset.hero, type: root?.dataset.type,
    bottomVisible: vis(bottom), bottomFixed: bottom ? getComputedStyle(bottom).position === 'fixed' && Math.round(bottom.getBoundingClientRect().bottom) === innerHeight : false,
    bottomLabels: bottom ? Array.from(bottom.querySelectorAll('a')).map((a) => a.innerText.trim()) : [], topVisible: vis(top),
    scrollOk: document.documentElement.scrollWidth <= innerWidth + 1,
    html: document.documentElement.outerHTML, text: document.body.innerText,
    els: Array.from(document.querySelectorAll('form, input, textarea, select, iframe')).map((e) => e.tagName.toLowerCase()),
    buttons: Array.from(document.querySelectorAll('button')).map((b) => b.dataset.testid || 'button'),
    links: Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href') || ''),
    footText: foot ? foot.innerText : null, footSize: foot ? parseFloat(getComputedStyle(foot).fontSize) : null, footCount: (document.body.innerText.match(/Powered by/g) || []).length,
    lang: document.documentElement.lang, desc: document.querySelector('meta[name=description]')?.content ?? '', canon: Array.from(document.querySelectorAll('link[rel=canonical]')).map((l) => l.href),
    og: { title: document.querySelector('meta[property="og:title"]')?.content ?? '', desc: document.querySelector('meta[property="og:description"]')?.content ?? '', image: document.querySelector('meta[property="og:image"]')?.content ?? '', url: document.querySelector('meta[property="og:url"]')?.content ?? '' },
    iconHref: document.querySelector('link[rel=icon]')?.getAttribute('href') ?? '',
    manifestHref: document.querySelector('link[rel=manifest]')?.getAttribute('href') ?? null,
    appleTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content ?? null,
    appleIcon: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href') ?? null,
    imgsBroken: Array.from(document.querySelectorAll('img')).filter((i) => i.getBoundingClientRect().height > 0 && i.loading !== 'lazy' && !(i.complete && i.naturalWidth > 0)).length,
  };
});

const FREE = [['spice-route', 'Spice Route Kitchen', 'Restaurant', 'restaurant'], ['lens-and-light', 'Lens and Light Studio', 'Photography', 'photography'], ['lakeview-homes', 'Lakeview Homes', 'Real estate', 'realestate'], ['plumberboy', 'Plumber Boy', 'Home repair and trades', 'homeservices']];
const PRO = [['homefix-pro', 'HomeFix Services', 'Home Services & Repairs', 'homeservices'], ['studio-nine', 'Studio Nine Interiors', 'Interior Design & Decor', 'interior'], ['paws-and-care', 'Paws and Care', 'Pet Care & Veterinary', 'petcare']];
const seen = new Map();

try {
  for (const width of [375, 768, 1280]) {
    const errors = [];
    const phone = width < 768;
    for (const [sub, name, category, pack] of FREE) {
      const { page, status } = await visit(width, `${sub}.get4domain.com`, errors);
      const f = await facts(page);
      check(`free ${sub} ${width}: renders the kit in info mode with the right theme`, status === 200 && f.mode === 'info' && f.theme === `${pack}-flagship`, `${status} ${f.mode} ${f.theme}`);
      check(`free ${sub} ${width}: one H1 and it is the business name`, f.h1.length === 1 && f.h1[0].trim().toLowerCase() === name.toLowerCase(), JSON.stringify(f.h1));
      check(`free ${sub} ${width}: title is "<name> | <real category>[ in <city>]"`, f.title.startsWith(`${name} | ${category}`) && !/Get4Domain/.test(f.title), f.title);
      check(`${sub} ${width}: head identity (one canonical on the vendor host, description, Open Graph, icon, lang, no /site/ link)`, f.canon.length === 1 && f.canon[0] === `https://${sub}.get4domain.com/` && f.desc.length > 20 && f.desc.length <= 160 && f.og.title === f.title && f.og.url.replace(/\/$/, '') === `https://${sub}.get4domain.com` && /^https?:\/\//.test(f.og.image) && !/\/starter\//.test(f.og.image) && /^\/app-icon\?s=/.test(f.iconHref) && f.lang === 'en-IN' && !f.links.some((h) => h.includes('/site/')), JSON.stringify({ c: f.canon, d: f.desc.length, og: f.og, i: f.iconHref, l: f.lang }));
      check(`free ${sub} ${width}: no form, input, chat or iframe; no tel, mailto, wa.me or external link; only the install button`, f.els.length === 0 && f.buttons.every((b) => b === 'install-app') && f.links.every((h) => h.startsWith('#')) && !/mailto:|tel:|wa\.me|chatbot/i.test(f.html), `${f.els} ${f.buttons} ${f.links.filter((h) => !h.startsWith('#'))}`);
      check(`free ${sub} ${width}: no e-mail or WhatsApp number on the page`, !/@|9190000|919000/.test(f.text.replace(/\+91 9\d{4} \d{5}/g, '')));
      check(`free ${sub} ${width}: no "Opening hours" placeholder line, no repeated sentence`, !/Hours: Opening hours|\nOpening hours\nOpening hours/.test(f.text) && (sub !== 'plumberboy' || (!f.text.includes('Opening hours') && (f.text.match(/Quick plumbing repairs at your door\./g) || []).length === 1)));
      check(`free ${sub} ${width}: navigation (${phone ? 'bottom bar' : 'top bar'}) and sizes`, phone ? f.bottomVisible && f.bottomFixed && !f.topVisible : !f.bottomVisible && f.topVisible, `${JSON.stringify({ b: f.bottomVisible, fixed: f.bottomFixed, t: f.topVisible })} ${f.bottomLabels}`);
      check(`free ${sub} ${width}: one small "Powered by Get4Domain.com" line`, f.footText === 'Powered by Get4Domain.com' && f.footCount === 1 && f.footSize <= 13, `${f.footText} ${f.footSize}`);
      check(`free ${sub} ${width}: manifest and icon tags, no sideways scroll, pictures load`, f.manifestHref === '/app-manifest' && /^\/app-icon\?s=180/.test(f.appleIcon ?? '') && f.appleTitle === name && f.scrollOk && f.imgsBroken === 0, `${f.manifestHref} ${f.appleIcon} ${f.appleTitle} ${f.scrollOk} ${f.imgsBroken}`);
      seen.set(`${pack}:${f.hero}:${f.type}`, sub);
      if (width !== 768 && ['spice-route', 'lens-and-light', 'lakeview-homes'].includes(sub)) await page.screenshot({ path: join(OUT, `free-${pack}-${width}.png`), fullPage: true });
      await page.close();
    }
    for (const [sub, name, category, pack] of PRO) {
      const { page, status } = await visit(width, `${sub}.get4domain.com`, errors);
      const f = await facts(page);
      check(`pro ${sub} ${width}: the kit in live mode, theme ${pack}-flagship`, status === 200 && f.mode === 'live' && f.theme === `${pack}-flagship`, `${status} ${f.mode} ${f.theme}`);
      check(`pro ${sub} ${width}: H1 is the name, title has the real category`, f.h1.length === 1 && f.h1[0].trim().toLowerCase() === name.toLowerCase() && f.title.startsWith(`${name} | `) && !/Get4Domain/.test(f.title), `${JSON.stringify(f.h1)} ${f.title}`);
      check(`pro ${sub} ${width}: call and enquire links work (tel, WhatsApp) and there is no chat or form`, f.links.some((h) => h.startsWith('tel:')) && f.els.length === 0 && !/chatbot/i.test(f.html), f.links.join(' ').slice(0, 160));
      check(`pro ${sub} ${width}: navigation and footer`, (phone ? f.bottomVisible && f.bottomFixed && !f.topVisible : !f.bottomVisible && f.topVisible) && f.footText === 'Powered by Get4Domain.com' && f.scrollOk, `${f.bottomLabels}`);
      if (phone) check(`pro ${sub} ${width}: bottom bar tabs are Home, Services, ... and Call/Enquire`, f.bottomLabels[0] === 'Home' && f.bottomLabels[1] === 'Services' && ['Call', 'Enquire'].includes(f.bottomLabels.at(-1)), f.bottomLabels.join(','));
      if (width !== 768) await page.screenshot({ path: join(OUT, `pro-${pack}-${width}.png`), fullPage: true });
      await page.close();
    }
    check(`page errors ${width}: none`, errors.length === 0, errors.join(' | ').slice(0, 300));
  }

  // the install button: shows on phones for Free and Pro, never on a computer; Android prompt, iOS guide sheet
  for (const [sub, label] of [['spice-route', 'Free'], ['homefix-pro', 'Pro']]) {
    const errors = [];
    // iOS: a guide sheet
    const ios = await visit(375, `${sub}.get4domain.com`, errors, { ua: IPHONE });
    await ios.page.waitForSelector('[data-testid=install-app]', { timeout: 8000 }).catch(() => null);
    const shown = await ios.page.$('[data-testid=install-app]');
    check(`install ${label} iOS: the Install app button shows on a phone`, !!shown);
    if (shown) {
      if (sub === 'spice-route') await ios.page.screenshot({ path: join(OUT, `install-button-ios-375.png`) });
      await shown.click();
      await ios.page.waitForSelector('[data-testid=install-sheet]', { timeout: 4000 }).catch(() => null);
      const sheet = await ios.page.evaluate(() => document.querySelector('[data-testid=install-sheet]')?.innerText ?? '');
      check(`install ${label} iOS: a short Add to Home Screen guide opens`, /Add to Home Screen/.test(sheet) && /Share/.test(sheet), sheet.replace(/\n/g, ' | ').slice(0, 120));
      if (sub === 'spice-route') await ios.page.screenshot({ path: join(OUT, `install-sheet-ios-375.png`) });
    }
    await ios.page.close();
    // Android: the browser's own prompt
    const and = await visit(375, `${sub}.get4domain.com`, errors, { ua: ANDROID });
    await and.page.evaluate(() => {
      window.__prompted = 0;
      const ev = new Event('beforeinstallprompt', { cancelable: true });
      ev.prompt = async () => { window.__prompted += 1; };
      ev.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(ev);
    });
    await and.page.waitForSelector('[data-testid=install-app]', { timeout: 8000 }).catch(() => null);
    const btn = await and.page.$('[data-testid=install-app]');
    check(`install ${label} Android: the Install app button shows`, !!btn);
    if (btn) { await btn.click(); await new Promise((r) => setTimeout(r, 300)); check(`install ${label} Android: the native install prompt is used`, (await and.page.evaluate(() => window.__prompted)) === 1); }
    await and.page.close();
    // a computer: no button
    const desk = await visit(1280, `${sub}.get4domain.com`, errors);
    check(`install ${label} desktop: no Install app button`, (await desk.page.$('[data-testid=install-app]')) === null);
    await desk.page.close();
    check(`install ${label}: no page errors`, errors.length === 0, errors.join(' | ').slice(0, 200));
  }

  // the vendor's own manifest and icon
  {
    const page = await browser.newPage();
    const m = await page.goto(`http://spice-route.get4domain.com:${PORT}/app-manifest`);
    const body = JSON.parse(await m.text());
    check('manifest: the vendor name, standalone, own start address, icons', m.status() === 200 && /manifest\+json/.test(m.headers()['content-type'] ?? '') && body.name === 'Spice Route Kitchen' && body.display === 'standalone' && body.start_url === '/' && body.icons.length >= 3, JSON.stringify(body).slice(0, 160));
    const ic = await page.goto(`http://spice-route.get4domain.com:${PORT}/app-icon?s=192`);
    const buf = await ic.buffer();
    check('icon: a PNG made for this vendor', ic.status() === 200 && /image\/png/.test(ic.headers()['content-type'] ?? '') && buf.length > 200 && buf[1] === 0x50, `${ic.status()} ${ic.headers()['content-type']} ${buf.length}`);
    const miss = await page.goto(`http://nobody-here.get4domain.com:${PORT}/app-manifest`);
    check('manifest: an unknown vendor has none (404)', miss.status() === 404);
    await page.close();
  }
  // the address rule, over real HTTP: /site/<name>... on the main host and on another vendor's host is a 301 to the vendor's own host, an unknown vendor is a 404
  {
    const http = await import('node:http');
    const hit = (host, path) => new Promise((resolve, reject) => { const r = http.request({ host: '127.0.0.1', port: PORT, path, headers: { host: `${host}:${PORT}` } }, (res) => { res.resume(); resolve({ status: res.statusCode, location: res.headers.location ?? null }); }); r.on('error', reject); r.end(); });
    // 127.0.0.1 is the loopback exemption of a developer machine, so the hosts below are the real names (the Host header decides, not the connection)
    for (const [host, path, to] of [['get4domain.com', '/site/spice-route', 'https://spice-route.get4domain.com/'], ['get4domain.com', '/site/spice-route/p/news?x=1', 'https://spice-route.get4domain.com/p/news?x=1'], ['plumberboy.get4domain.com', '/site/spice-route/listings', 'https://spice-route.get4domain.com/listings'], ['spice-route.get4domain.com', '/site/spice-route/home', 'https://spice-route.get4domain.com/']]) {
      const r = await hit(host, path);
      check(`address rule: ${host}${path} -> 301 ${to}`, r.status === 301 && r.location === to, `${r.status} ${r.location}`);
    }
    const gone = await hit('get4domain.com', '/site/nobody-here/about');
    check('address rule: /site/<no such vendor> is a 404', gone.status === 404 && !gone.location, `${gone.status} ${gone.location}`);
  }
  check('themes differ across packs (distinct hero and type combinations seen)', new Set([...seen.keys()].map((k) => k.split(':').slice(1).join(':'))).size >= 3, [...seen.keys()].join(' '));
} finally {
  await browser.close();
  await fake.close();
}
console.log(fails === 0 ? 'ALL PASSED' : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
