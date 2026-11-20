import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { middleware } from '../../../middleware';
import { resetHostLog } from '../host-log';
import { resetVendorMemo } from '../vendor-site';
import { ownPath, siteAddress } from '../site-kit/address';
import { buildHead, canonicalUrl, cityOf, descriptor, headDescription, headTitle } from '../site-kit/head';
import { buildSiteView } from '../site-kit/view';
import { themeForSite } from '../site-kit/resolver';
import SiteApp from '../../../components/site-kit/SiteApp';
import { buildPageModel, buildSiteDocModel } from '../../../engine/sitedoc/build';
import { withShell } from '../../../engine/shell/with-shell';
import { buildThemeSrcDoc } from '../../../engine/raw-theme-frame';
import { pageSetOf } from '../../../engine/themepack/data';
import { themeMetadata } from '../../../engine/themepack/site';

const BASE = 'get4domain.com';
const ENV: Record<string, string> = {
  V3_PUBLIC_ENABLED: 'true', V3_PUBLIC_USE_MOCKS: 'false', MAIN_HOST: 'v3site.get4domain.com', APP_HOST: 'v3app.get4domain.com', API_HOST: 'v3api.get4domain.com',
  DIRECTORY_HOST: 'v3directory.get4domain.com', ADMIN_HOST: 'v3admin.get4domain.com', MEDIA_HOST: 'v3media.get4domain.com', NEXT_PUBLIC_SITE_BASE_DOMAIN: BASE, INTERNAL_API_URL: 'http://g4d-v3-api:3008',
};

const site = {
  vendor: { id: 'v1', businessName: 'Sri Murugan Dental', industry: 'Dental clinic', subdomain: 'sri-murugan' },
  cms: {
    businessName: 'Sri Murugan Dental', tagline: 'Gentle care for the whole family', about: 'We are a family dental clinic. We do check-ups, fillings and braces for children and adults.',
    address: '12 MG Road, Indiranagar, Bengaluru, Karnataka 560001', phone: '+91 98765 43210', logo: 'https://cdn.example.com/logo.png', banner: 'https://cdn.example.com/banner.jpg', ogImage: null,
    seoDesc: null, seoTitle: 'Old SEO title', seoKeywords: null, pages: [{ slug: 'news', title: 'Latest news', body: 'We moved to a new clinic building next to the bus stand.' }],
  },
  products: [{ id: 'p1', name: 'Teeth cleaning', description: 'A full clean', price: '800', image: null, category: null, customFields: null }],
  docV2: true, pack: { key: 'clinic', name: 'Clinic', config: {} },
};
const bare = { vendor: { id: 'v2', businessName: 'Plumber Boy', industry: '', subdomain: 'plumberboy' }, cms: { businessName: 'Plumber Boy' }, products: [] };

const src = (f: string): string => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? (n === '__tests__' ? [] : walk(p)) : /\.(ts|tsx)$/.test(n) ? [p] : []; });

// ---------------------------------------------------------------------------------------------------------------------------------------------
describe('A1 address rule (pure)', () => {
  const a = (host: string, pathname: string, search = '') => siteAddress({ host, pathname, search, vendorBase: BASE });
  test('/site/<name> and every /site/<name>/... path goes to the same page on the vendor host (query kept, home is /)', () => {
    assert.deepEqual(a('v3site.get4domain.com', '/site/ravi'), { kind: 'redirect', name: 'ravi', to: 'https://ravi.get4domain.com/' });
    assert.equal((a('v3site.get4domain.com', '/site/ravi/about') as { to: string }).to, 'https://ravi.get4domain.com/about');
    assert.equal((a('get4domain.com', '/site/ravi/p/news', '?preview=abc') as { to: string }).to, 'https://ravi.get4domain.com/p/news?preview=abc');
    assert.equal((a('other.get4domain.com', '/site/ravi/home') as { to: string }).to, 'https://ravi.get4domain.com/');
    assert.equal((a('ravi.get4domain.com', '/site/ravi/contact/') as { to: string }).to, 'https://ravi.get4domain.com/contact');
    assert.equal((a('x.example.org', '/SITE/Ravi/App-Manifest') as { to: string }).to, 'https://ravi.get4domain.com/App-Manifest', 'the name is lower-cased, the rest of the path is kept as it was');
  });
  test('a name that cannot be a vendor is "invalid" (404 without asking anyone); other paths are not touched', () => {
    for (const bad of ['/site/-x', '/site/a..b', '/site/x_y', `/site/${'a'.repeat(64)}`]) assert.equal(a('get4domain.com', bad).kind, 'invalid', bad);
    for (const ok of ['/', '/sites', '/site', '/siteabc/x', '/directory/site/x', '/demo/clinic']) assert.equal(a('get4domain.com', ok).kind, 'none', ok);
  });
  test('a developer machine (localhost) has no vendor host to go to and is left alone', () => {
    assert.equal(a('localhost:3000', '/site/ravi').kind, 'none');
    assert.equal(a('127.0.0.1:3115', '/site/ravi/about').kind, 'none');
  });
  test('ownPath', () => { assert.equal(ownPath(undefined), '/'); assert.equal(ownPath('/'), '/'); assert.equal(ownPath('/home'), '/'); assert.equal(ownPath('/a/b/'), '/a/b'); });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
describe('A1 the middleware: 301 to the vendor host, 404 when there is no such vendor', () => {
  const saved: Record<string, string | undefined> = {}; const realFetch = globalThis.fetch;
  let api: 'exists' | 'missing' | 'down' = 'exists'; let calls: string[] = [];
  beforeEach(() => {
    for (const k of [...Object.keys(ENV), 'API_BASE_URL', 'NEXT_PUBLIC_API_URL']) saved[k] = process.env[k];
    delete process.env.API_BASE_URL; delete process.env.NEXT_PUBLIC_API_URL; Object.assign(process.env, ENV);
    resetVendorMemo(); resetHostLog(); calls = []; api = 'exists';
    globalThis.fetch = (async (url: string | URL | Request) => {
      calls.push(String(url));
      if (api === 'down') throw new Error('down');
      return String(url).includes('/cms/site-state/') ? new Response(JSON.stringify({ exists: api === 'exists', status: api === 'exists' ? 'LIVE' : 'NOT_FOUND' }), { status: 200 }) : new Response('no', { status: 404 });
    }) as typeof fetch;
  });
  afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } globalThis.fetch = realFetch; });
  const ask = (host: string, path: string, method = 'GET') => middleware(new NextRequest(`http://${host.replace(/:\d+$/, '')}${path}`, { headers: { host }, method }));

  test('on the main host, a vendor host of another vendor and the vendor\'s own host', async () => {
    for (const host of ['v3site.get4domain.com', 'get4domain.com', 'other-vendor.get4domain.com', 'ravi.get4domain.com', 'v3directory.get4domain.com', 'www.get4domain.com']) {
      const r = await ask(host, '/site/ravi/about?x=1');
      assert.equal(r.status, 301, host);
      assert.equal(r.headers.get('location'), 'https://ravi.get4domain.com/about?x=1', host);
    }
    assert.equal((await ask('v3site.get4domain.com', '/site/ravi')).headers.get('location'), 'https://ravi.get4domain.com/');
  });
  test('a HEAD request gets the same 301; a POST (a form) is not redirected', async () => {
    assert.equal((await ask('v3site.get4domain.com', '/site/ravi/book', 'HEAD')).status, 301);
    assert.notEqual((await ask('v3site.get4domain.com', '/site/ravi/book', 'POST')).status, 301);
  });
  test('no such vendor: a real 404 with noindex, on every host', async () => {
    api = 'missing';
    for (const host of ['v3site.get4domain.com', 'ravi.get4domain.com', 'x.get4domain.com']) {
      const r = await ask(host, '/site/ghost/contact');
      assert.equal(r.status, 404, host);
      assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
      assert.equal(r.headers.get('location'), null);
    }
  });
  test('a name that cannot exist is a 404 without a backend call; the backend being down is a 503, never a redirect or a guess', async () => {
    assert.equal((await ask('v3site.get4domain.com', '/site/-bad-')).status, 404);
    assert.equal(calls.length, 0);
    api = 'down';
    const r = await ask('v3site.get4domain.com', '/site/ravi');
    assert.equal(r.status, 503); assert.equal(r.headers.get('location'), null);
  });
  test('the matcher also covers dotted /site/ paths (robots.txt, sitemap.xml)', () => {
    assert.match(src('middleware.ts'), /matcher: \[[^\]]*'\/site\/:path\*'/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
describe('A1 internal links never carry /site/<name>', () => {
  const hrefs = (html: string): string[] => [...html.matchAll(/(?:href|action|src)="([^"]*)"/g)].map((m) => m[1]);
  test('the theme design kit (home and Free)', () => {
    const { theme, pack } = themeForSite(site);
    for (const mode of ['live', 'info'] as const) {
      const html = renderToStaticMarkup(createElement(SiteApp, { view: buildSiteView(site, { mode, pack }), theme }));
      assert.ok(hrefs(html).length > 0);
      assert.ok(!html.includes('/site/'), mode);
    }
  });
  test('the built-in designs: nav, page nav and the shell, on the home page and on a vendor page', () => {
    const e = site as never;
    const home = withShell(buildSiteDocModel(e), e, { mode: 'live', cart: false, base: '', onHome: true });
    const page = withShell(buildPageModel(e, site.cms.pages[0]), e, { mode: 'live', cart: false, base: '', onHome: false });
    for (const m of [home, page]) {
      const blob = JSON.stringify(m);
      assert.ok(!blob.includes('/site/'), 'no /site/ anywhere in the model');
      assert.ok(m.nav.every((n) => n.href === '/' || n.href.startsWith('/') || n.href.startsWith('#')), JSON.stringify(m.nav));
    }
    assert.ok(home.nav.some((n) => n.href === '/p/news'), 'the vendor page is /p/news');
    assert.equal(page.nav[0].href, '/'); assert.equal(page.shell?.base, '');
    assert.ok(page.shell?.legal.every((l) => l.href.startsWith('/legal/')));
    assert.ok(page.shell?.flowPath.startsWith('/'));
    assert.ok(JSON.stringify(page.shell).includes('"/#') || JSON.stringify(page.shell).includes('"/"'), 'on a sub page the anchors point back to /#section, not to #section of the wrong page');
  });
  test('the theme packs: every page address is on the vendor host', () => {
    const manifest = { pages: [{ slug: 'about', template: 'page', title: 'About', navLabel: 'About' }, { slug: 'services', template: 'items', title: 'Services', navLabel: 'Services' }], itemsPage: 'services' } as never;
    const set = pageSetOf(site as never, manifest, '');
    assert.equal(set.home, '/');
    assert.deepEqual([...set.standard, ...set.vendor].map((p) => p.href), ['/about', '/services', '/p/news']);
  });
  test('an uploaded static theme: page links are /<slug>, home is /', () => {
    const html = buildThemeSrcDoc({ pages: [{ slug: 'index', title: 'Home', html: '<a href="about.html">a</a><a href="/">h</a><a href="index.html">i</a><a href="https://x.test/">x</a>' }, { slug: 'about', title: 'About', html: '<p>x</p>' }], css: '', js: '', fonts: [] },
      { vendor: { businessName: 'V', subdomain: 'v' }, cms: null } as never, { subdomain: 'v', rest: [], apiBase: 'http://api.test' });
    assert.ok(!html.includes('/site/'));
    assert.match(html, /href="\/about"/); assert.ok((html.match(/href="\/"/g) ?? []).length >= 1);
  });
  test('no renderer source builds a /site/<name> link any more (only the app\'s own route folder and prose remain)', () => {
    const offenders: string[] = [];
    for (const f of [...walk(fileURLToPath(new URL('../../../engine', import.meta.url))), ...walk(fileURLToPath(new URL('../../../components', import.meta.url))), ...walk(fileURLToPath(new URL('../site-kit', import.meta.url)))]) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => { if (/`\/site\/\$\{|'\/site\/'\s*\+|"\/site\/"\s*\+|href=\{?[`'"]\/site\//.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)) offenders.push(`${f}:${i + 1}`); });
    }
    assert.deepEqual(offenders, []);
    assert.ok(!/\/site\/\$\{/.test(src('app/site/[subdomain]/[[...rest]]/page.tsx').replace(/\/cms\/site\/\$\{/g, '').replace(/\/\/.*$/gm, '')), 'the page passes base "" to every renderer');
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
describe('A1 head identity (the one builder every renderer uses)', () => {
  const head = (o: Partial<Parameters<typeof buildHead>[0]> = {}) => buildHead({ site, subdomain: 'sri-murugan', path: '/', category: 'Dental clinic', baseDomain: BASE, ...o });
  const flat = (m: ReturnType<typeof buildHead>) => ({ title: (m.title as { absolute: string }).absolute, canonical: (m.alternates as { canonical: string }).canonical, og: m.openGraph as { title: string; description: string; url: string; images: { url: string }[] } });

  test('city comes from the vendor\'s own address only (the last part that is not a state, country, postcode or a numbered street)', () => {
    assert.equal(cityOf('12 MG Road, Indiranagar, Bengaluru, Karnataka 560001'), 'Bengaluru');
    assert.equal(cityOf('Shop 4, Pune 411001'), 'Pune');
    assert.equal(cityOf('Bengaluru, India'), 'Bengaluru');
    assert.equal(cityOf('12, 4th cross'), null);
    assert.equal(cityOf(''), null); assert.equal(cityOf(null), null); assert.equal(cityOf('Karnataka'), null);
  });
  test('title: "<page title> | <vendor name> | <category> in <city>", home without the page title; the name is never repeated', () => {
    assert.equal(flat(head()).title, 'Sri Murugan Dental | Dental clinic in Bengaluru');
    assert.equal(flat(head({ pageTitle: 'Latest news', path: '/p/news' })).title, 'Latest news | Sri Murugan Dental | Dental clinic in Bengaluru');
    assert.equal(headTitle('Plumber Boy', null), 'Plumber Boy');
    assert.equal(headTitle('Plumber Boy', 'Plumber in Pune', 'Contact'), 'Contact | Plumber Boy | Plumber in Pune');
    assert.equal(headTitle('Clinic', null, 'Clinic'), 'Clinic');
    assert.equal(descriptor('Dental clinic', null, 'X'), 'Dental clinic');
    assert.equal(descriptor('Clinic', 'Pune', 'Clinic'), null, 'a category that is the name itself is left out');
  });
  test('every page title carries the vendor name (landing pages, item pages, legal)', () => {
    for (const p of ['About us', 'Book an appointment', 'Privacy policy', 'Teeth cleaning', 'Latest news']) assert.ok((flat(head({ pageTitle: p })).title).includes('Sri Murugan Dental'), p);
  });
  test('description: the vendor\'s business description (cut at a word, 160 max); else only the vendor\'s own data; never an invented claim', () => {
    const own = flat(head()).og.description;
    assert.equal(own, site.cms.about);
    const long = { ...site, cms: { ...site.cms, about: `${'We look after teeth '.repeat(20)}end` } };
    const d = buildHead({ site: long, subdomain: 's', path: '/', category: null, baseDomain: BASE }).description as string;
    assert.ok(d.length <= 160 && d.endsWith('…'), d.length.toString());
    const gen = headDescription({ cms: { tagline: 'Gentle care for the whole family', address: 'Pune' } }, 'Sri Murugan Dental', 'Dental clinic in Pune');
    assert.equal(gen, 'Sri Murugan Dental is a Dental clinic in Pune. Gentle care for the whole family.');
    assert.equal(headDescription({}, 'Plumber Boy', null), 'Plumber Boy: official website.');
    assert.ok(!/best|leading|trusted|number one|#1|years|award/i.test(gen + headDescription({}, 'Plumber Boy', null)));
  });
  test('the vendor\'s own SEO description wins over the about text', () => {
    assert.equal(buildHead({ site: { ...site, cms: { ...site.cms, seoDesc: 'Dentist near MG Road' } }, subdomain: 's', path: '/', category: null, baseDomain: BASE }).description, 'Dentist near MG Road');
  });
  test('favicon: the per-vendor icon route (logo, or initials when there is none), apple icon and manifest', () => {
    const m = head();
    const icons = (m.icons as { icon: { url: string }[]; apple: string });
    assert.ok(icons.icon.every((i) => /^\/app-icon\?s=\d+$/.test(i.url)));
    assert.equal(icons.apple, '/app-icon?s=180');
    assert.equal(m.manifest, '/app-manifest');
    const r = src('app/site/[subdomain]/app-icon/route.ts');
    assert.match(r, /id\.logo/); assert.match(r, /id\.letter/, 'the initials icon when there is no usable logo');
  });
  test('canonical: exactly one, absolute, on the vendor host; no /site/; no query; home has no trailing slash', () => {
    assert.equal(flat(head()).canonical, 'https://sri-murugan.get4domain.com');
    assert.equal(flat(head({ path: '/p/news' })).canonical, 'https://sri-murugan.get4domain.com/p/news');
    assert.equal(canonicalUrl('a', BASE, '/about/'), 'https://a.get4domain.com/about');
    assert.equal(typeof head().alternates?.canonical, 'string', 'a single string, never a list');
    assert.ok(!flat(head({ preview: undefined } as never)).canonical.includes('/site/'));
  });
  test('Open Graph: title, description, url (= canonical) and an absolute image; the image falls back share > banner > logo > icon route', () => {
    const f = flat(head());
    assert.equal(f.og.title, f.title); assert.equal(f.og.url, f.canonical); assert.equal(f.og.images[0].url, 'https://cdn.example.com/banner.jpg');
    assert.equal(flat(head({ image: 'https://cdn.example.com/item.jpg' })).og.images[0].url, 'https://cdn.example.com/item.jpg');
    const logoOnly = buildHead({ site: { ...site, cms: { ...site.cms, banner: null, ogImage: null } }, subdomain: 's', path: '/', category: null, baseDomain: BASE });
    assert.equal((logoOnly.openGraph as { images: { url: string }[] }).images[0].url, 'https://cdn.example.com/logo.png');
    const none = buildHead({ site: bare as never, subdomain: 'plumberboy', path: '/', category: null, baseDomain: BASE });
    assert.equal((none.openGraph as { images: { url: string }[] }).images[0].url, 'https://plumberboy.get4domain.com/app-icon?s=512');
    const rel = buildHead({ site: { ...site, cms: { ...site.cms, ogImage: '/uploads/x.png' } }, subdomain: 's', path: '/', category: null, baseDomain: BASE });
    assert.equal((rel.openGraph as { images: { url: string }[] }).images[0].url, 'https://s.get4domain.com/uploads/x.png');
  });
  test('a starter placeholder picture is never the share image', () => {
    const m = buildHead({ site: { ...site, cms: { ...site.cms, banner: '/starter/generic/hero.svg', ogImage: null } }, subdomain: 's', path: '/', category: null, baseDomain: BASE });
    assert.equal((m.openGraph as { images: { url: string }[] }).images[0].url, 'https://cdn.example.com/logo.png');
  });
  test('a site with almost no data still gets every part of the head', () => {
    const m = buildHead({ site: bare as never, subdomain: 'plumberboy', path: '/', category: null, baseDomain: BASE });
    assert.equal(flat(m).title, 'Plumber Boy'); assert.ok(m.description); assert.equal(flat(m).canonical, 'https://plumberboy.get4domain.com'); assert.ok(m.icons); assert.ok(m.openGraph);
  });
  test('the html lang attribute is set once for the whole app', () => { assert.match(src('app/layout.tsx'), /<html lang="en-IN"/); });

  // --- per renderer
  test('renderer: the generic kit, Free, built-in designs, templates and uploaded themes all take their head from buildHead (no "only when docV2" condition)', () => {
    const page = src('app/site/[subdomain]/[[...rest]]/page.tsx');
    const meta = page.split('export async function generateMetadata')[1].split('export default async function')[0];
    assert.match(meta, /buildHead\(\{ site, subdomain/);
    assert.ok(!/site\.docV2 \? \{ alternates/.test(meta), 'the docV2 condition is gone');
    assert.ok(!/alternates/.test(meta), 'the canonical comes only from buildHead, so there is exactly one');
    assert.match(meta, /themeMetadata\(/);
    assert.match(meta, /!isFreeSite\(site\)/); // a Free site never takes the imported-theme head
  });
  test('renderer: imported theme packs (home, page, item, vendor page, flow, legal)', () => {
    const manifest = { pages: [{ slug: 'about', template: 'page', title: 'About', navLabel: 'About' }, { slug: 'services', template: 'items', title: 'Services', navLabel: 'Services' }], itemsPage: 'services', families: ['booking'] } as never;
    const pkg = { id: 't1', key: 't1', version: 1, name: 'T', manifest, pages: {}, css: '', googleFonts: [], assets: [] } as never;
    const m = (rest: string[]) => themeMetadata(site as never, pkg, rest, { base: '', subdomain: 'sri-murugan', preview: false, category: 'Dental clinic', baseDomain: BASE });
    const cases: [string[], string, string][] = [
      [[], 'Sri Murugan Dental | Dental clinic in Bengaluru', 'https://sri-murugan.get4domain.com'],
      [['about'], 'About | Sri Murugan Dental | Dental clinic in Bengaluru', 'https://sri-murugan.get4domain.com/about'],
      [['p', 'news'], 'Latest news | Sri Murugan Dental | Dental clinic in Bengaluru', 'https://sri-murugan.get4domain.com/p/news'],
      [['services', 'teeth-cleaning'], 'Teeth cleaning | Sri Murugan Dental | Dental clinic in Bengaluru', 'https://sri-murugan.get4domain.com/services/teeth-cleaning'],
      [['book'], 'Book an appointment | Sri Murugan Dental | Dental clinic in Bengaluru', 'https://sri-murugan.get4domain.com/book'],
      [['legal', 'privacy'], 'Privacy policy | Sri Murugan Dental | Dental clinic in Bengaluru', 'https://sri-murugan.get4domain.com/legal/privacy'],
    ];
    for (const [rest, title, canonical] of cases) {
      const f = flat(m(rest)); const mm = m(rest);
      assert.equal(f.title, title, rest.join('/')); assert.equal(f.canonical, canonical, rest.join('/'));
      assert.ok(mm.description && (mm.description as string).length <= 160); assert.ok((mm.icons as { apple: string }).apple); assert.equal(f.og.url, canonical); assert.ok(f.og.images[0].url.startsWith('https://'));
    }
    assert.deepEqual(m(['book']).robots, { index: false, follow: false }, 'the flow pages keep their existing noindex rule');
    assert.equal(m([]).robots, undefined);
  });
  test('renderer: the vendor pages /p/<slug> of the built-in designs and the kit use the same function and the same path', () => {
    const f = flat(buildHead({ site, subdomain: 'sri-murugan', path: '/p/news', pageTitle: 'Latest news', category: 'Dental clinic', baseDomain: BASE }));
    assert.equal(f.title, 'Latest news | Sri Murugan Dental | Dental clinic in Bengaluru'); assert.equal(f.canonical, 'https://sri-murugan.get4domain.com/p/news');
  });
  test('robots: the head builder adds a robots meta only for noindex pages, with the same value the old code used', () => {
    assert.equal(head().robots, undefined);
    assert.deepEqual(head({ noindex: true }).robots, { index: false, follow: false });
  });
});
