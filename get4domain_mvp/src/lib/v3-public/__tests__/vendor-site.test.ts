import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { classifyHost, readHostConfig } from '../hostnames';
import { isInternalOnlyPath, isVendorPlatformFilePath } from '../routes';
import { NOT_AVAILABLE_HTML, fetchVendorPage, resetVendorMemo, safeLocation, vendorOwnsHost, vendorResponseParts, type VendorPage } from '../vendor-site';
import { MOCK_DOWN_LABEL, MOCK_MOVED_LABEL, MOCK_SITES, MOCK_TAKEDOWN_LABEL, mockJsonLd, mockVendorAnswer } from '../vendor-site-mocks';

const cfg = readHostConfig({ MAIN_HOST: 'main.example.invalid', DIRECTORY_HOST: 'directory.main.example.invalid' });
const H = (label: string): string => `${label}.main.example.invalid`;

const page = async (label: string, path = '/'): Promise<Extract<VendorPage, { kind: 'page' }>> => {
  const r = await fetchVendorPage(H(label), path);
  assert.equal(r.kind, 'page', `${label}${path}`);
  return r as Extract<VendorPage, { kind: 'page' }>;
};

const CONTACT = /tel:|mailto:|wa\.me|<form|<button|<input/i;

describe('host to site mapping', () => {
  test('a vendor host resolves to its own site; the label picks the site', async () => {
    assert.deepEqual(classifyHost(H('sample-pro'), cfg), { kind: 'vendor-site', label: 'sample-pro' });
    const a = await page('sample-pro');
    const b = await page('sample-free');
    assert.match(a.body, /Sample Pro Plumbing/);
    assert.match(b.body, /Sample Free Electricals/);
    assert.notEqual(a.etag, b.etag);
  });
  test('an unknown host, an unknown path and bad input are the same plain not-found', async () => {
    for (const [h, p] of [[H('nobody'), '/'], [H('sample-pro'), '/nope'], [H('sample-pro'), '/a/../b'], [H('sample-pro'), `/${'x'.repeat(301)}`], ['', '/']] as const) {
      assert.deepEqual(await fetchVendorPage(h, p), { kind: 'not-found' }, `${h}${p}`);
    }
  });
  test('pages of a site are only its own', async () => {
    assert.deepEqual(await fetchVendorPage(H('sample-draft'), '/services'), { kind: 'not-found' });
    assert.equal((await fetchVendorPage(H('sample-pro'), '/services')).kind, 'page');
    assert.equal((await fetchVendorPage(H('sample-pro'), '/services/')).kind, 'page', 'a trailing slash is the same page');
  });
  test('moved, taken down and unavailable hosts', async () => {
    const moved = await fetchVendorPage(H(MOCK_MOVED_LABEL), '/services');
    assert.deepEqual(moved, { kind: 'redirect', status: 301, location: 'https://sample-pro.main.example.invalid/services' });
    assert.equal((await fetchVendorPage(H(MOCK_TAKEDOWN_LABEL), '/')).kind, 'notice');
    assert.deepEqual(await fetchVendorPage(H(MOCK_DOWN_LABEL), '/'), { kind: 'unavailable' });
  });
});

describe('noindex states', () => {
  test('a published site is indexable: header and page agree', async () => {
    const p = await page('sample-pro');
    assert.equal(p.robots, 'index, follow');
    assert.match(p.body, /<meta name="robots" content="index, follow">/);
  });
  test('a draft site is noindex in the header and in the page, and its sitemap lists nothing', async () => {
    const p = await page('sample-draft');
    assert.equal(p.robots, 'noindex, nofollow');
    assert.match(p.body, /<meta name="robots" content="noindex, nofollow">/);
    const sm = await page('sample-draft', '/sitemap.xml');
    assert.doesNotMatch(sm.body, /<url>/);
    assert.match(sm.body, /<urlset/);
  });
  test('the relay keeps the backend robots header and adds none of its own to a stored page', () => {
    const indexable = vendorResponseParts({ kind: 'page', body: 'x', contentType: 'text/html; charset=utf-8', etag: '"a"', robots: null, lang: 'en', cacheControl: null });
    assert.equal(indexable.headers['x-robots-tag'], undefined, 'no header from the backend means none relayed (platform files carry none)');
    const noidx = vendorResponseParts({ kind: 'page', body: 'x', contentType: 'text/html', etag: null, robots: 'noindex, nofollow', lang: null, cacheControl: null });
    assert.equal(noidx.headers['x-robots-tag'], 'noindex, nofollow');
  });
  test('everything this app writes itself is noindex and uncached', () => {
    for (const r of [{ kind: 'not-found' }, { kind: 'unavailable' }, { kind: 'notice', html: '<p>x</p>' }] as VendorPage[]) {
      const p = vendorResponseParts(r);
      assert.equal(p.headers['x-robots-tag'], 'noindex, nofollow', r.kind);
      assert.equal(p.headers['cache-control'], 'no-store', r.kind);
    }
  });
});

describe('the platform files of a site are its own', () => {
  test('robots.txt, sitemap.xml and llms.txt name only this host', async () => {
    const host = H('sample-pro');
    const robots = await page('sample-pro', '/robots.txt');
    assert.equal(robots.contentType.startsWith('text/plain'), true);
    assert.match(robots.body, new RegExp(`Sitemap: https://${host}/sitemap\\.xml`));
    const sm = await page('sample-pro', '/sitemap.xml');
    const locs = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.ok(locs.length >= 3);
    for (const l of locs) assert.ok(l.startsWith(`https://${host}/`), l);
    const llms = await page('sample-pro', '/llms.txt');
    for (const m of llms.body.matchAll(/\((https:[^)]+)\)/g)) assert.ok(m[1].startsWith(`https://${host}/`), m[1]);
    assert.equal(robots.robots, null, 'platform files carry no robots header');
  });
  test('the canonical of a page is on its own host', async () => {
    const p = await page('sample-pro', '/services');
    assert.match(p.body, new RegExp(`<link rel="canonical" href="https://${H('sample-pro')}/services">`));
  });
});

describe('Free sites are informational only', () => {
  test('a Free page has no tel, mailto, wa.me, form, input or button', async () => {
    for (const label of ['sample-free', 'sample-draft', 'sample-hostile']) {
      for (const path of MOCK_SITES[label].pages) assert.doesNotMatch((await page(label, path)).body, CONTACT, `${label}${path}`);
    }
  });
  test('the check is meaningful: a Pro page does carry them', async () => {
    assert.match((await page('sample-pro', '/contact')).body, CONTACT);
  });
  test('the pages this app writes itself carry none either', () => {
    assert.doesNotMatch(NOT_AVAILABLE_HTML, CONTACT);
    assert.doesNotMatch(vendorResponseParts({ kind: 'not-found' }).body ?? '', CONTACT);
    assert.doesNotMatch(mockVendorAnswer(H(MOCK_TAKEDOWN_LABEL), '/').status === 451 ? (mockVendorAnswer(H(MOCK_TAKEDOWN_LABEL), '/') as { body: string }).body : '', CONTACT);
  });
  test('every page links back to the main domain', async () => {
    for (const label of ['sample-pro', 'sample-free', 'sample-draft']) assert.match((await page(label)).body, /href="https:\/\/main\.example\.invalid\/"/, label);
  });
});

describe('JSON-LD and text escaping', () => {
  test('Organization, WebSite and FAQPage are present with areaServed', async () => {
    const types = mockJsonLd(MOCK_SITES['sample-pro'], H('sample-pro'), '/').map((d) => d['@type']);
    assert.deepEqual(types, ['Organization', 'WebSite', 'FAQPage']);
    assert.match((await page('sample-pro')).body, /"areaServed":\{"@type":"City","name":"Chennai"\}/);
  });
  test('a hostile business name cannot close a script tag, and every block still parses', async () => {
    const body = (await page('sample-hostile')).body;
    const blocks = [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.equal(blocks.length, 3);
    for (const b of blocks) {
      assert.doesNotMatch(b[1], /<|>/, 'no raw angle bracket inside a JSON-LD block');
      assert.equal(typeof JSON.parse(b[1]), 'object');
    }
    assert.equal((body.match(/<script/g) ?? []).length, 3, 'the name did not add a script');
    assert.doesNotMatch(body, /<script>x\(\)/);
    assert.match(body, /<h1>Evil &lt;\/script&gt;/);
  });
});

describe('the relay changes nothing', () => {
  test('a stored page is relayed byte for byte with its validators', async () => {
    const p = await page('sample-pro', '/about');
    const out = vendorResponseParts(p);
    assert.equal(out.status, 200);
    assert.equal(out.body, p.body);
    assert.equal(out.headers['content-type'], p.contentType);
    assert.equal(out.headers.etag, p.etag);
    assert.equal(out.headers['content-language'], 'en');
    assert.equal(out.headers['cache-control'], p.cacheControl);
  });
  test('HEAD has no body; a matching ETag is a 304', async () => {
    const p = await page('sample-pro');
    assert.equal(vendorResponseParts(p, 'HEAD').body, null);
    const again = await fetchVendorPage(H('sample-pro'), '/', { ifNoneMatch: p.etag });
    assert.equal(again.kind, 'not-modified');
    const out = vendorResponseParts(again);
    assert.equal(out.status, 304);
    assert.equal(out.body, null);
    assert.equal(out.headers.etag, p.etag);
  });
  test('redirects, takedown notice, not found and unavailable', async () => {
    assert.deepEqual(vendorResponseParts({ kind: 'redirect', status: 301, location: 'https://a.example.invalid/x' }), { status: 301, headers: { location: 'https://a.example.invalid/x', 'cache-control': 'public, max-age=300' }, body: null });
    const n = vendorResponseParts({ kind: 'notice', html: '<p>gone</p>' });
    assert.equal(n.status, 451);
    assert.equal(n.body, '<p>gone</p>');
    assert.equal(vendorResponseParts({ kind: 'not-found' }).status, 404);
    const u = vendorResponseParts({ kind: 'unavailable' });
    assert.equal(u.status, 503);
    assert.equal(u.headers['retry-after'], '120');
  });
  test('safeLocation accepts an https address only', () => {
    assert.equal(safeLocation('https://a.example.invalid/x?y=1'), 'https://a.example.invalid/x?y=1');
    for (const bad of ['http://a.example.invalid/', 'javascript:alert(1)', '//a.example.invalid/', '/relative', 'https://user:pw@a.example.invalid/', 'https://localhost/', '', null, undefined]) assert.equal(safeLocation(bad as string), null, String(bad));
  });
});

describe('V3 or V2: does the backend know the host', () => {
  beforeEach(() => resetVendorMemo());
  test('a published, moved or taken down host is V3; a plain not-found is not', async () => {
    assert.equal(await vendorOwnsHost(H('sample-pro')), true);
    assert.equal(await vendorOwnsHost(H(MOCK_MOVED_LABEL)), true);
    assert.equal(await vendorOwnsHost(H(MOCK_TAKEDOWN_LABEL)), true);
    assert.equal(await vendorOwnsHost(H('some-v2-client')), false);
  });
  test('a backend that cannot answer counts as V3 (a 503, never another system\'s 404) and is not remembered', async () => {
    let t = 0;
    assert.equal(await vendorOwnsHost(H(MOCK_DOWN_LABEL), null, () => t), true);
    t += 1;
    assert.equal(await vendorOwnsHost(H(MOCK_DOWN_LABEL), null, () => t), true);
  });
  test('the answer is remembered for a minute', async () => {
    let t = 1000;
    assert.equal(await vendorOwnsHost(H('late-site'), null, () => t), false);
    // the same host later becomes a site: the remembered answer holds until it expires
    MOCK_SITES['late-site'] = { name: 'Late Site', city: 'Chennai', cta: false, indexable: false, pages: ['/'] };
    try {
      t += 30_000;
      assert.equal(await vendorOwnsHost(H('late-site'), null, () => t), false);
      t += 31_000;
      assert.equal(await vendorOwnsHost(H('late-site'), null, () => t), true);
    } finally {
      delete MOCK_SITES['late-site'];
    }
  });
});

describe('routes', () => {
  test('the vendor handler is internal only; llms.txt and /assets/ are vendor platform files', () => {
    assert.equal(isInternalOnlyPath('/vendor-site'), true);
    assert.equal(isInternalOnlyPath('/vendor-site/services'), true);
    assert.equal(isInternalOnlyPath('/vendor-sitemap'), false);
    assert.equal(isVendorPlatformFilePath('/llms.txt'), true);
    assert.equal(isVendorPlatformFilePath('/assets/site.css'), true);
    assert.equal(isVendorPlatformFilePath('/assetsx'), false);
    assert.equal(isVendorPlatformFilePath('/robots.txt'), false);
  });
});
