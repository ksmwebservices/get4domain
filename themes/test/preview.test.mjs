import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { startPreview } from '../lib/preview.mjs';
import { openBrowser } from '../lib/browser.mjs';
import { takeShots } from '../lib/shots.mjs';
import { CATEGORY_IDS } from '../lib/categories.mjs';
import { listVendorThemeIds, loadTheme } from '../lib/theme.mjs';

let ctx;
const get = (p, headers = {}) => new Promise((resolve, reject) => {
  const u = new URL(p, ctx.url);
  const req = http.request({ host: '127.0.0.1', port: u.port, path: u.pathname + u.search, method: 'GET', headers: { Host: `127.0.0.1:${u.port}`, ...headers } }, (res) => {
    let body = ''; res.setEncoding('utf8'); res.on('data', (c) => { body += c; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
  });
  req.on('error', reject); req.end();
});

test('start: the server listens on 127.0.0.1 only', async () => {
  ctx = await startPreview({ port: 0 });
  assert.equal(ctx.server.address().address, '127.0.0.1');
  assert.match(ctx.url, /^http:\/\/127\.0\.0\.1:\d+/);
});

test('a request with a foreign Host header is refused (no DNS-rebinding reach)', async () => {
  const r = await get('/', { Host: 'evil.example' });
  assert.equal(r.status, 403);
});

test('only GET is served', async () => {
  const u = new URL('/', ctx.url);
  const status = await new Promise((resolve) => { const req = http.request({ host: '127.0.0.1', port: u.port, path: '/', method: 'POST', headers: { Host: `127.0.0.1:${u.port}` } }, (res) => { res.resume(); resolve(res.statusCode); }); req.end(); });
  assert.equal(status, 405);
});

test('every page of the harness answers 200 and loads nothing from outside', async () => {
  for (const p of ['/', '/coverage', '/motion', '/variants', '/performance', '/contrast', '/render?theme=_starter&category=plumber', '/lint?theme=_starter&category=plumber']) {
    const r = await get(p);
    assert.equal(r.status, 200, p);
    assert.match(r.headers['content-type'], /text\/html/);
    assert.doesNotMatch(r.body, /(?:src|href)=["']https?:\/\/(?!www\.(?:google|openstreetmap|youtube)|maps\.google|get4domain\.com|wa\.me|www\.facebook|www\.instagram)/i, p);
    assert.doesNotMatch(r.body, /<script/i, `${p}: the harness itself needs no script`);
    assert.equal(r.headers['content-security-policy'].includes("default-src 'none'") || r.headers['content-security-policy'].includes("default-src 'self'"), true);
  }
});

test('coverage: a theme by category grid with a result for every one of the 41 categories', async () => {
  const r = await get('/coverage');
  const vendor = listVendorThemeIds();
  const shown = vendor.length ? vendor : ['_starter'];
  for (const id of shown) assert.ok(r.body.includes(id), id);
  for (const id of CATEGORY_IDS) assert.ok(r.body.includes(id), id);
  assert.match(r.body, /PASS/);
  const listed = shown.reduce((n, id) => n + loadTheme(id).manifest.categories.length, 0);
  assert.equal((r.body.match(/class="cell pass"/g) ?? []).length, listed, 'every listed combination passes');
  assert.equal((r.body.match(/class="cell fail"/g) ?? []).length, 0);
  assert.match(r.body, /categories have a theme/);
});

test('motion lab: all ten effects, a reduced-motion toggle and the two readouts', async () => {
  const r = await get('/motion');
  for (const n of ['Scroll reveal', 'Hero effects', 'Number counters', 'Marquee', 'Card hover', 'Image treatments', 'Section dividers', 'Page transitions', 'Sticky bar', 'Menu']) assert.ok(r.body.includes(n), n);
  assert.match(r.body, /Animated elements/);
  assert.match(r.body, /Motion CSS size/);
  assert.match(r.body, /reduced=1/);
  const reduced = await get('/motion?reduced=1');
  assert.match(reduced.body, /Reduced motion: ON/);
  assert.match(reduced.body, /not all/, 'the animation block is switched off');
  const m = await get('/motion?m=rich');
  assert.match(m.body, /data-motion="rich"/);
});

test('variant picker: theme, category, variant (read only), motion intensity and three device frames', async () => {
  const r = await get('/variants?theme=_starter&category=dentist&motion=Rich&lang=ta');
  for (const w of ['360', '768', '1280']) assert.ok(r.body.includes(`width="${w}"`), `frame ${w}`);
  assert.match(r.body, /calm-centered/);
  assert.match(r.body, /read only/i);
  assert.match(r.body, /<iframe[^>]+src="\/render\?[^"]*category=dentist/);
  assert.match(r.body, /motion=Rich/);
});

test('entitlements can be switched on in the render and in the variant picker frames', async () => {
  const off = await get('/render?theme=_starter&category=plumber');
  assert.doesNotMatch(off.body, /data-g4d-slot="(video|booking|cart)"/);
  const on = await get('/render?theme=_starter&category=plumber&ent=all');
  assert.match(on.body, /data-g4d-slot="video"/);
  assert.match(on.body, /data-g4d-slot="booking"/);
  const v = await get('/variants?theme=_starter&category=plumber&ent=all');
  assert.match(v.body, /<iframe[^>]+src="\/render\?[^"]*ent=all/);
  assert.match(v.body, /Entitlements/);
});

test('variant picker: a category is shown in its own Standard theme, by default and when the chosen theme does not list it', async () => {
  const dflt = await get('/variants?category=jewellery');
  assert.match(dflt.body, /<iframe[^>]+src="\/render\?[^"]*theme=free-shop-lite/, 'default theme for a shop category');
  assert.match(dflt.body, /product-first/);
  const sw = await get('/variants?theme=free-practice&category=plumber');
  assert.match(sw.body, /<iframe[^>]+src="\/render\?[^"]*theme=free-service-pro/, 'switched to the theme that lists the category');
  assert.match(sw.body, /is not in free-practice/);
  const own = await get('/variants?theme=free-practice&category=lawyer');
  assert.match(own.body, /theme=free-practice/);
  assert.doesNotMatch(own.body, /is not in/);
});

test('every Standard theme renders its own categories through /render with its preset applied', async () => {
  for (const [theme, category, pattern] of [['free-service-pro', 'plumber', 'waves'], ['free-practice', 'lawyer', 'diagonal'], ['free-studio', 'gym-yoga', 'rays'], ['free-hospitality', 'hotel-homestay', 'rings'], ['free-shop-lite', 'jewellery', 'rings']]) {
    const r = await get(`/render?theme=${theme}&category=${category}`);
    assert.equal(r.status, 200, theme);
    assert.match(r.body, new RegExp(`data-pattern="${pattern}"`), `${theme}/${category} uses its preset pattern`);
    assert.match(r.body, /--g4d-pal-primary:#[0-9a-f]{6}/);
  }
});

test('performance readout: one table per Standard theme with only its own categories, and a summary of CSS sizes', async () => {
  const r = await get('/performance');
  for (const id of ['free-service-pro', 'free-practice', 'free-studio', 'free-hospitality', 'free-shop-lite']) assert.ok(r.body.includes(id), id);
  assert.match(r.body, /Summary/);
  const rows = (r.body.match(/<td><code>[a-z0-9-]+<\/code><\/td><td>[\d.]+ KB/g) ?? []).length;
  const listed = ['free-service-pro', 'free-practice', 'free-studio', 'free-hospitality', 'free-shop-lite'].reduce((n, id) => n + loadTheme(id).manifest.categories.length, 0);
  const starter = loadTheme('_starter').manifest.categories.length;
  assert.equal(rows, listed + starter, 'a row per listed category for every theme, no more');
});

test('performance readout: CSS size, image count, estimated LCP element, layout-shift risk', async () => {
  const r = await get('/performance');
  for (const h of ['CSS size', 'Pictures', 'Estimated LCP element', 'Layout shift risk']) assert.ok(r.body.includes(h), h);
  assert.ok(r.body.includes('plumber'));
});

test('contrast page: token ratios for light and dark, and the accent tester gives a fix', async () => {
  const r = await get('/contrast?accent=%23ffff00');
  assert.match(r.body, /Light/);
  assert.match(r.body, /Dark/);
  assert.match(r.body, /#[0-9a-f]{6}.*suggest|suggest.*#[0-9a-f]{6}/is);
  assert.match(r.body, /4\.5/);
});

test('render returns a complete themed page for the chosen category, language and motion', async () => {
  const r = await get('/render?theme=_starter&category=restaurant-cafe&lang=ta&motion=Off&page=services');
  assert.match(r.body, /^<!doctype html>/i);
  assert.match(r.body, /<html lang="ta">/);
  assert.match(r.body, /data-motion="off"/);
  assert.match(r.body, /[஀-௿]/);
  assert.match(r.body, /Thalai Vazhai|தலை வாழை/);
});

test('hostile parameters are escaped or rejected, never reflected as markup', async () => {
  for (const p of ['/variants?theme=%3Cscript%3Ealert(1)%3C/script%3E', '/variants?category=%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E', '/render?theme=../../etc/passwd&category=plumber', '/contrast?accent=%3Cscript%3E', '/render?theme=_starter&category=plumber&lang=%3Cb%3E', '/motion?m=%3Cscript%3E']) {
    const r = await get(p);
    assert.ok([200, 400, 404].includes(r.status), `${p} -> ${r.status}`);
    assert.doesNotMatch(r.body, /<script>alert|<img src=x|onerror=alert/i, p);
  }
  assert.equal((await get('/nope')).status, 404);
});

test('shots: PNG screenshots at 360, 768 and 1280 px (needs the Playwright already on this machine)', async (t) => {
  const b = await openBrowser();
  if (!b.available) { t.skip(b.reason); return; }
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-shots-'));
  try {
    const files = await takeShots({ browser: b.browser, themes: ['_starter'], categories: ['plumber'], out, widths: [360, 768, 1280] });
    assert.equal(files.length, 3);
    for (const f of files) {
      const head = fs.readFileSync(f).subarray(0, 8);
      assert.deepEqual([...head], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], f);
      assert.ok(fs.statSync(f).size > 3000, `${f} is a real picture`);
    }
    assert.ok(files.every((f) => f.startsWith(out)));
  } finally { await b.close(); fs.rmSync(out, { recursive: true, force: true }); }
});

test('performance readout: pictures per home page for the sample, the Free limits and the largest Pro content, against the budget', async () => {
  const r = await get('/performance');
  assert.match(r.body, /Pictures \(Free limits, budget 12\)/);
  assert.match(r.body, /Pictures \(largest Pro content, budget 19\)/);
  assert.match(r.body, /Most pictures, Free limits/);
  assert.equal((r.body.match(/class="cell fail"/g) ?? []).length, 0, 'every theme is within its picture budget');
  const row = r.body.match(/<td><code>plumber<\/code><\/td><td>[^<]+<\/td><td>(\d+)<\/td><td class="cell pass">(\d+)<\/td><td class="cell pass">(\d+)<\/td>/);
  assert.ok(row, 'a row with sample, Free-limit and Pro-max picture counts');
  assert.ok(Number(row[2]) <= 12 && Number(row[3]) <= 19);
});

test('stop: the server closes', async () => {
  await ctx.close();
  await assert.rejects(() => get('/'));
});

test('shot plan: --all means every Standard theme with the categories it lists; Tamil is a sample of three per theme', async () => {
  const { shotPlan, tamilSample } = await import('../lib/shots.mjs');
  const plan = shotPlan({ all: true });
  assert.deepEqual(plan.map((p) => p.theme).sort(), ['free-hospitality', 'free-practice', 'free-service-pro', 'free-shop-lite', 'free-studio']);
  assert.deepEqual(Object.fromEntries(plan.map((p) => [p.theme, p.categories.length])), { 'free-hospitality': 4, 'free-practice': 11, 'free-service-pro': 13, 'free-shop-lite': 8, 'free-studio': 5 });
  assert.equal(plan.reduce((n, p) => n + p.categories.length, 0), 41);
  const ta = tamilSample(plan);
  for (const p of ta) { assert.equal(p.categories.length, 3); assert.equal(new Set(p.categories).size, 3); for (const c of p.categories) assert.ok(plan.find((x) => x.theme === p.theme).categories.includes(c)); }
  assert.equal(ta.length, 5);
  assert.deepEqual(shotPlan({ theme: 'free-practice', category: 'lawyer' }), [{ theme: 'free-practice', categories: ['lawyer'] }]);
  assert.deepEqual(shotPlan({ theme: '_starter', category: 'plumber' }), [{ theme: '_starter', categories: ['plumber'] }]);
});

test('shots by plan: a category in its own theme at three widths', async (t) => {
  const b = await openBrowser();
  if (!b.available) { t.skip(b.reason); return; }
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-shots2-'));
  try {
    const files = await takeShots({ browser: b.browser, plan: [{ theme: 'free-shop-lite', categories: ['jewellery'] }], out, widths: [360, 1280] });
    assert.equal(files.length, 2);
    assert.ok(files.every((f) => /free-shop-lite[\\/]jewellery[\\/]jewellery-en-home-(360|1280)\.png$/.test(f) && fs.statSync(f).size > 3000));
  } finally { await b.close(); fs.rmSync(out, { recursive: true, force: true }); }
});
