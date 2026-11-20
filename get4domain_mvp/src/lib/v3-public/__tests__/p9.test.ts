import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
// the fake local backend (127.0.0.1 only) with the exact answer shape of the live case
import { PLUMBERBOY, startFakeBackend } from '../../../../scripts/v3-public/fake-backend-p9.mjs';
import { DEFAULT_PUBLIC_API, fetchSiteState, freeViewOf, isFreeSite, siteApiBase, vendorHostReason, vendorNotFoundLine } from '../site-state';

const read = (f: string): string => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
const PAGE = 'app/site/[subdomain]/[[...rest]]/page.tsx';

describe('P9 the live case: plumberboy (Free, unknown industry text, no theme, no logo, no address, a phone)', () => {
  test('the renderer reads the API address when the request runs: INTERNAL_API_URL first (the old code used the build-time NEXT_PUBLIC_API_URL only)', () => {
    assert.equal(siteApiBase({ INTERNAL_API_URL: 'http://api:4000/', NEXT_PUBLIC_API_URL: 'https://baked.example.com' }), 'http://api:4000');
    assert.equal(siteApiBase({ API_BASE_URL: 'http://b:1', NEXT_PUBLIC_API_URL: 'https://baked.example.com' }), 'http://b:1');
    assert.equal(siteApiBase({ NEXT_PUBLIC_API_URL: 'https://baked.example.com' }), 'https://baked.example.com');
    assert.equal(siteApiBase({ INTERNAL_API_URL: 'not a url', NEXT_PUBLIC_API_URL: 'ftp://x' }), DEFAULT_PUBLIC_API);
    assert.equal(siteApiBase({}), DEFAULT_PUBLIC_API);
    const page = read(PAGE);
    assert.match(page, /\$\{siteApiBase\(\)\}\/cms\/site\//, 'the site data is fetched from siteApiBase()');
    assert.ok(!/\$\{API_BASE\}\/cms\/site\//.test(page), 'not from the build-time constant');
    assert.match(page, /fetchSiteState\(siteApiBase\(\), subdomain\)/);
  });

  test('against the fake backend, the site data and the site state of plumberboy are read and the plan sits at the top of data', async () => {
    const fake = await startFakeBackend(0);
    try {
      const state = await fetchSiteState(fake.url, 'plumberboy');
      assert.deepEqual(state, { exists: true, status: 'LIVE' });
      const res = await fetch(`${siteApiBase({ INTERNAL_API_URL: fake.url })}/cms/site/plumberboy`);
      assert.equal(res.status, 200);
      const json = (await res.json()) as { data?: unknown };
      const site = (json.data ?? json) as Record<string, unknown>; // exactly what the page does
      assert.equal(site.plan, 'FREE', 'plan is at the top level of the unwrapped answer');
      assert.equal(isFreeSite(site), true);
      assert.equal((site.vendor as { industry: string }).industry, 'Home repair and trades');
      assert.equal((site.cms as { themeId: unknown }).themeId, null);
      assert.deepEqual(await fetchSiteState(fake.url, 'nobody'), { exists: false, status: 'NOT_FOUND' });
      // an address the fake does not have is a 404 on the site route (what makes the page end in notFound when the wrong API is asked)
      assert.equal((await fetch(`${fake.url}/cms/site/plumberboy-zzz`)).status, 404);
    } finally { await fake.close(); }
  });

  test('the information page of plumberboy: name, about, services, phone as text, the starter banner; no e-mail or WhatsApp', () => {
    const v = freeViewOf(JSON.parse(JSON.stringify(PLUMBERBOY)));
    assert.equal(v.name, 'Plumber Boy');
    assert.equal(v.about, 'Quick plumbing repairs at your door.');
    assert.equal(v.phone, '+91 98765 43210');
    assert.equal(v.logo, null);
    assert.equal(v.address, null);
    assert.equal(v.banner, '/starter/generic/hero.svg', 'the platform starter banner is kept (the old code dropped it)');
    assert.deepEqual(v.items.map((x) => x.name), ['Tap and pipe repair', 'Bathroom fittings']);
    const text = JSON.stringify(v);
    assert.ok(!/@|whatsapp|mailto/i.test(text));
  });

  test('unsafe pictures are still dropped: protocol-relative, script, data and path tricks', () => {
    const mk = (banner: string) => freeViewOf({ vendor: { businessName: 'X' }, cms: { businessName: 'X', tagline: null, about: null, address: null, phone: null, logo: null, banner }, products: [] }).banner;
    for (const bad of ['//evil.example.com/x.png', 'javascript:alert(1)', 'data:image/svg+xml,<svg/>', '/a b', '/../x"onerror="1', '']) assert.equal(mk(bad), null, bad);
    assert.equal(mk('/starter/generic/hero.svg'), '/starter/generic/hero.svg');
    assert.equal(mk('https://img.example.com/b.png'), 'https://img.example.com/b.png');
  });

  test('a half-empty answer never throws: no products, no vendor name, no cms', () => {
    assert.doesNotThrow(() => freeViewOf({ vendor: { businessName: '' }, cms: null, products: undefined as unknown as [] }));
    const v = freeViewOf({ vendor: undefined as unknown as { businessName: string }, cms: null, products: [{ name: '  ', price: null, description: null, image: null }, null as unknown as { name: string; price: null; description: null; image: null }] });
    assert.equal(v.name, 'This business');
    assert.deepEqual(v.items, []);
  });

  test('the Free page comes before every design, and a failure building it says "being set up" and logs FREE_RENDER_FAILED (never a bare 404)', () => {
    const page = read(PAGE);
    assert.match(page, /logVendorNotFound\(subdomain, 'FREE_RENDER_FAILED'\)/);
    assert.match(page, /return view \? <FreeSiteView view=\{view\} \/> : <SiteBeingSetUp \/>;/);
    assert.ok(page.indexOf('if (isFreeSite(site))') < page.indexOf('themePages(site.theme)'));
  });

  test('a site that is not Free is never sent to the not-found page for its industry text: the generic design handles an unknown industry', () => {
    const page = read(PAGE);
    // the industry switch only runs a bespoke design when one exists, then the generic renderer follows with an optional category
    assert.match(page, /const engineIndustry = getEngineIndustry\(canonicalIndustryId\(site\.vendor\.industry\)\);\s*if \(engineIndustry && /);
    // P11: the generic design is the theme design kit; an unknown industry text resolves to the safe default pack, never to a not-found page
    assert.match(page, /const \{ theme, pack \} = themeForSite\(site\);/);
    assert.match(page, /<SiteApp view=\{view\} theme=\{theme\} \/>/);
  });
});

describe('P9 every vendor-host not-found leaves one log line with a reason code', () => {
  test('the line has the subdomain and the reason only', () => {
    assert.deepEqual(JSON.parse(vendorNotFoundLine('plumberboy', 'API_NOT_FOUND')), { evt: 'vendor_not_found', subdomain: 'plumberboy', reason: 'API_NOT_FOUND' });
    assert.deepEqual(Object.keys(JSON.parse(vendorNotFoundLine('plumberboy', 'NO_DESIGN'))).sort(), ['evt', 'reason', 'subdomain']);
  });
  test('anything that is not a plain subdomain is logged as "invalid" (nothing a visitor typed leaks into the log)', () => {
    for (const bad of ['Ravi Kumar <ravi@example.com>', 'a.b', '../x', '', 'x'.repeat(64)]) assert.equal(JSON.parse(vendorNotFoundLine(bad, 'HOST_NOT_PARSED')).subdomain, 'invalid', bad);
  });
  test('host reasons: base mismatch, unusable label, reserved name, a path the rewrite leaves alone; null when it would be rewritten', () => {
    const reserved = new Set(['www', 'app', 'api']);
    assert.deepEqual(vendorHostReason('plumberboy.example.org', 'get4domain.com', reserved, '/'), { subdomain: 'plumberboy', reason: 'HOST_BASE_MISMATCH' });
    assert.deepEqual(vendorHostReason('-bad-.get4domain.com', 'get4domain.com', reserved, '/'), { subdomain: '-bad-', reason: 'HOST_NOT_PARSED' });
    assert.deepEqual(vendorHostReason('app.get4domain.com', 'get4domain.com', reserved, '/'), { subdomain: 'app', reason: 'HOST_NOT_PARSED' });
    assert.deepEqual(vendorHostReason('plumberboy.get4domain.com', 'get4domain.com', reserved, '/api/x'), { subdomain: 'plumberboy', reason: 'HOST_NOT_PARSED' });
    assert.equal(vendorHostReason('plumberboy.get4domain.com:3000', 'get4domain.com', reserved, '/'), null);
  });
  test('every notFound() of the renderer goes through a function that logs; the middleware logs its plain 404', () => {
    const page = read(PAGE);
    const bare = page.split('\n').filter((l) => /\bnotFound\(\)/.test(l) && !/import/.test(l));
    assert.equal(bare.length, 2, 'only inside missing() and noPage()');
    for (const code of ['API_NOT_FOUND', 'API_UNREACHABLE', 'NO_DESIGN', 'INNER_PAGE_NOT_FOUND', 'FREE_RENDER_FAILED']) assert.ok(page.includes(`'${code}'`), code);
    const mw = read('middleware.ts');
    assert.match(mw, /logVendorNotFound\(why\.subdomain, why\.reason\)/);
  });
});
