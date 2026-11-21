import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { activeTab, installMode, isIosDevice, isLegalPath, showAppNav, type AppTabLink } from '../app-nav';
import { LEGAL_PAGE_PATHS } from '../legal-paths';
import { PORTAL } from '../portal-strings';

// the app root is the folder the tests run from (get4domain_mvp)
const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

const same: AppTabLink[] = [{ key: 'home', href: '/' }, { key: 'search', href: '/search' }, { key: 'categories', href: '/industries' }, { key: 'plans', href: '/pricing' }];
// the main site when the directory is its own host: Search is absolute there
const crossHost: AppTabLink[] = [{ key: 'home', href: '/' }, { key: 'search', href: 'https://directory.example.test/search' }, { key: 'categories', href: '/industries' }, { key: 'plans', href: '/pricing' }];

describe('the bottom bar: which tab is active', () => {
  test('each place marks its own tab, and sub-pages keep it', () => {
    assert.equal(activeTab('/', same), 'home');
    assert.equal(activeTab('/search', same), 'search');
    assert.equal(activeTab('/search/', same), 'search');
    assert.equal(activeTab('/industries', same), 'categories');
    assert.equal(activeTab('/industries/retail/general-store', same), 'categories');
    assert.equal(activeTab('/pricing', same), 'plans');
  });
  test('the More pages mark More; an unknown page marks nothing', () => {
    for (const p of ['/login', '/register', '/product', '/how-it-works', '/guides/start', '/partners', '/account/login']) assert.equal(activeTab(p, same), 'more', p);
    assert.equal(activeTab('/about', same), null);
    assert.equal(activeTab('/chennai/plumbers', same), null);
  });
  test('a link to the other host is never active', () => {
    assert.equal(activeTab('/search', crossHost), null);
    assert.equal(activeTab('/pricing', crossHost), 'plans');
  });
  test('a path that only starts with the same letters is not the tab', () => {
    assert.equal(activeTab('/searching', same), null);
    assert.equal(activeTab('/pricing-guide', same), null);
  });
});

describe('the bottom bar: where it is shown', () => {
  test('hidden on every policy page and under /legal', () => {
    for (const p of LEGAL_PAGE_PATHS) { assert.equal(isLegalPath(p), true, p); assert.equal(showAppNav(p), false, p); assert.equal(showAppNav(`${p}/`), false, p); }
    assert.equal(showAppNav('/legal/terms'), false);
  });
  test('shown on the pages people use', () => {
    for (const p of ['/', '/search', '/register', '/pricing', '/industries', '/claim', '/chennai', '/account/login']) assert.equal(showAppNav(p), true, p);
  });
});

describe('the install item', () => {
  test('prompt where the browser has one, a hint on iOS, nothing when installed or when there is no way', () => {
    assert.equal(installMode({ standalone: false, hasPrompt: true, ios: false }), 'prompt');
    assert.equal(installMode({ standalone: false, hasPrompt: false, ios: true }), 'ios');
    assert.equal(installMode({ standalone: true, hasPrompt: true, ios: true }), 'hidden');
    assert.equal(installMode({ standalone: false, hasPrompt: false, ios: false }), 'hidden');
  });
  test('iOS detection covers iPhone, iPad and iPadOS posing as a Mac', () => {
    assert.equal(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5), true);
    assert.equal(isIosDevice('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)', 5), true);
    assert.equal(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), true);
    assert.equal(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0), false);
    assert.equal(isIosDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5), false);
  });
  test('the words exist', () => {
    for (const k of ['home', 'search', 'categories', 'plans', 'more', 'install', 'iosTitle', 'iosSteps'] as const) assert.ok(PORTAL.app[k].length > 2, k);
    assert.match(PORTAL.app.iosSteps, /Add to Home Screen/);
  });
});

describe('the service worker never caches pages or API answers', () => {
  const sw = read('public/sw.js');
  test('the only thing put in a cache is the shell list, added at install', () => {
    assert.doesNotMatch(sw, /\.put\(/);
    assert.equal((sw.match(/cache\.add\(/g) ?? []).length, 1);
    assert.match(sw, /const SHELL = \[OFFLINE_URL, '\/icons\/app-192\.png', '\/icons\/app-512\.png'\]/);
  });
  test('pages are network only, the offline page is the fallback, and other requests are not intercepted', () => {
    assert.match(sw, /req\.method !== 'GET' \|\| url\.origin !== self\.location\.origin\) return;/);
    assert.match(sw, /req\.mode === 'navigate'/);
    assert.match(sw, /fetch\(req\)\.catch\(/);
    assert.match(sw, /SHELL\.includes\(url\.pathname\)/);
    // no rule names an API, directory, flag or login address: nothing to answer from a cache there
    const code = sw.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    assert.doesNotMatch(code, /\/api\b|directory-api|\/login|V3_PUBLIC|robots|noindex/i);
  });
  test('push handlers of the dashboard are kept', () => {
    assert.match(sw, /addEventListener\('push'/);
    assert.match(sw, /addEventListener\('notificationclick'/);
  });
  test('old caches are removed on activate', () => assert.match(sw, /keys\.filter\(\(k\) => k !== CACHE\)/));
});

describe('the offline page and the icons are local', () => {
  test('offline.html is self-contained: no script, no external address, noindex', () => {
    const html = read('public/offline.html');
    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /https?:\/\//i);
    assert.match(html, /noindex/);
    for (const src of html.match(/src="([^"]+)"/g) ?? []) assert.match(src, /src="\/icons\//);
  });
  test('every icon file exists, as SVG and PNG, with the sizes the manifest says', () => {
    for (const f of ['app-icon.svg', 'app-icon-maskable.svg', 'app-192.png', 'app-512.png', 'app-maskable-512.png', 'apple-touch-180.png']) assert.ok(existsSync(join(ROOT, 'public/icons', f)), f);
    const png = (f: string): [number, number] => { const b = readFileSync(join(ROOT, 'public/icons', f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
    assert.deepEqual(png('app-192.png'), [192, 192]);
    assert.deepEqual(png('app-512.png'), [512, 512]);
    assert.deepEqual(png('app-maskable-512.png'), [512, 512]);
    assert.deepEqual(png('apple-touch-180.png'), [180, 180]);
    assert.doesNotMatch(read('public/icons/app-icon.svg'), /href=|<image/i);
  });
});

describe('the manifest', () => {
  const m = read('src/app/manifest.ts');
  test('name, short name, standalone, start url, theme colour', () => {
    assert.match(m, /short_name: 'Get4Domain'/);
    assert.match(m, /display: 'standalone'/);
    assert.match(m, /start_url: '\/'/);
    assert.match(m, /theme_color: '#[0-9a-fA-F]{6}'/);
    assert.match(m, /scope: '\/'/);
  });
  test('every icon it names is a local file that exists', () => {
    const srcs = [...m.matchAll(/src: '(\/[^']+)'/g)].map((x) => x[1]);
    assert.ok(srcs.length >= 4);
    for (const s of srcs) { assert.ok(!/^https?:/.test(s), s); assert.ok(existsSync(join(ROOT, 'public', s)), s); }
    assert.match(m, /purpose: 'maskable'/);
  });
});

describe('the wiring stays inside the flag and the shell', () => {
  test('the bar and the registration are in the portal shell only, which asserts the flag', () => {
    const shell = read('src/components/portal/PortalShell.tsx');
    assert.match(shell, /<MobileNav links=\{links\} \/>/);
    assert.match(shell, /<ServiceWorkerRegister \/>/);
    assert.match(read('src/app/(v3site)/v3-site/layout.tsx'), /assertV3Public\(\)/);
    assert.match(read('src/app/(directory)/layout.tsx'), /assertV3Public\(\)/);
    assert.match(read('src/components/portal/ServiceWorkerRegister.tsx'), /serviceWorker\.register\('\/sw\.js'/);
  });
  test('the bar is for phones only and keeps a spacer above the footer', () => {
    const c = read('src/components/portal/MobileNav.tsx');
    assert.match(c, /md:hidden/);
    assert.match(c, /env\(safe-area-inset-bottom\)/);
    assert.match(c, /aria-current/);
    assert.match(c, /print:hidden/);
    assert.match(c, /h-16/);
  });
  test('the worker file is always fetched fresh', () => assert.match(read('next.config.ts'), /source: '\/sw\.js'[\s\S]*no-cache/));
});
