import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { decideHost, directoryHomeHref, hostRoutingActive, mainPageTarget, stripDirectoryPrefix, type HostRequest } from '../host-routing';
import { readHostConfig } from '../hostnames';

const HOSTS = {
  MAIN_HOST: 'main.example.invalid', DIRECTORY_HOST: 'directory.main.example.invalid', APP_HOST: 'app.main.example.invalid',
  ADMIN_HOST: 'admin.main.example.invalid', API_HOST: 'api.main.example.invalid', MEDIA_HOST: 'media.main.example.invalid',
};
const ON = { ...HOSTS, V3_PUBLIC_ENABLED: 'true' };
const cfg = readHostConfig(HOSTS);
const isId = (s: string): boolean => /^[0-9a-f]{8}-/.test(s);
const run = (host: string, pathname: string, extra: Partial<HostRequest> = {}, env: Record<string, string | undefined> = ON) => decideHost({ host, pathname, isBusinessId: isId, ...extra }, cfg, env);

describe('the host layer is active only with the flag and a main host', () => {
  test('flag off: no decision for any host or path', () => {
    for (const host of ['main.example.invalid', 'directory.main.example.invalid', 'x.main.example.invalid', 'other.invalid', 'api.main.example.invalid']) {
      for (const path of ['/', '/directory', '/directory/chennai', '/pricing', '/chennai/plumbers']) assert.equal(run(host, path, {}, HOSTS), null, `${host}${path}`);
    }
    assert.equal(run('main.example.invalid', '/', {}, { ...HOSTS, V3_PUBLIC_ENABLED: 'false' }), null);
    assert.equal(hostRoutingActive(cfg, HOSTS), false);
  });
  test('flag on but no main host: the earlier single-host behaviour, no decision', () => {
    const none = readHostConfig({});
    assert.equal(decideHost({ host: 'whatever.invalid', pathname: '/pricing' }, none, { V3_PUBLIC_ENABLED: 'true' }), null);
    assert.equal(hostRoutingActive(none, { V3_PUBLIC_ENABLED: 'true' }), false);
  });
  test('flag on and a main host: active', () => {
    assert.equal(hostRoutingActive(cfg, ON), true);
  });
});

describe('main host', () => {
  test('live marketing sub-pages and the V3 routes pass untouched', () => {
    for (const p of ['/industries/travel', '/claim', '/legal', '/account/login', '/demo/clinic', '/leadspace', '/pricing/extra', '/r', '/r/a/b']) assert.deepEqual(run('main.example.invalid', p), { action: 'pass', host: 'main' }, p);
  });
  test('the commercial pages replace their live twins only here, by an internal rewrite', () => {
    const want: Record<string, string> = {
      '/': '/v3-site', '/pricing': '/v3-site/pricing', '/pricing/': '/v3-site/pricing', '/register': '/v3-site/register', '/how-it-works': '/v3-site/how-it-works', '/industries': '/v3-site/industries',
      '/features': '/v3-site/features', '/about': '/v3-site/about', '/contact': '/v3-site/contact', '/login': '/account/login', '/r/ABC-123_x': '/v3-site/r/ABC-123_x', '/referral-link': '/v3-site/referral-link',
    };
    for (const [from, to] of Object.entries(want)) assert.deepEqual(run('main.example.invalid', from), { action: 'rewrite', pathname: to }, from);
    assert.equal(mainPageTarget('/constructor'), null);
    assert.equal(mainPageTarget('/__proto__'), null);
    assert.equal(mainPageTarget(`/r/${'a'.repeat(65)}`), null);
  });
  test('no replacement without the flag, without MAIN_HOST, or on any other host', () => {
    assert.equal(run('main.example.invalid', '/pricing', {}, HOSTS), null);
    assert.equal(decideHost({ host: 'main.example.invalid', pathname: '/pricing' }, readHostConfig({}), { V3_PUBLIC_ENABLED: 'true' }), null);
    assert.deepEqual(run('directory.main.example.invalid', '/pricing'), { action: 'not-found', host: 'directory' });
    assert.deepEqual(run('sri-murugan.main.example.invalid', '/pricing'), { action: 'pass', host: 'vendor-site' });
  });
  test('/directory and below go permanently to the directory host without the prefix', () => {
    assert.deepEqual(run('main.example.invalid', '/directory'), { action: 'redirect', to: 'https://directory.main.example.invalid/', status: 308 });
    assert.deepEqual(run('main.example.invalid', '/directory/'), { action: 'redirect', to: 'https://directory.main.example.invalid/', status: 308 });
    assert.deepEqual(run('main.example.invalid', '/directory/chennai/plumbers', { search: '?utm_source=x' }), { action: 'redirect', to: 'https://directory.main.example.invalid/chennai/plumbers?utm_source=x', status: 308 });
  });
  test('look-alikes of the prefix are not redirected', () => {
    for (const p of ['/directory-go/x', '/directory-api/page-visit', '/directoryx']) assert.deepEqual(run('main.example.invalid', p), { action: 'pass', host: 'main' }, p);
  });
  test('no directory host configured: nothing to redirect to, the path passes', () => {
    const noDir = readHostConfig({ MAIN_HOST: 'main.example.invalid' });
    assert.deepEqual(decideHost({ host: 'main.example.invalid', pathname: '/directory' }, noDir, ON), { action: 'pass', host: 'main' });
  });
  test('www goes permanently to the canonical host, path and query kept', () => {
    assert.deepEqual(run('www.main.example.invalid', '/pricing', { search: '?a=1' }), { action: 'redirect', to: 'https://main.example.invalid/pricing?a=1', status: 308 });
    // the scheme of the request is never trusted: a redirect to a configured host is https (localhost, in development, is http)
    assert.deepEqual(run('www.main.example.invalid', '/'), { action: 'redirect', to: 'https://main.example.invalid/', status: 308 });
    const dev = readHostConfig({ MAIN_HOST: 'www.localhost', DIRECTORY_HOST: 'directory.localhost' });
    assert.deepEqual(decideHost({ host: 'www.localhost', pathname: '/x' }, dev, ON), { action: 'redirect', to: 'http://localhost/x', status: 308 });
  });
});

describe('directory host', () => {
  const D = 'directory.main.example.invalid';
  test('the old /account/register goes to the main host /register for good, keeping the query; login is left alone', () => {
    assert.deepEqual(run(D, '/account/register'), { action: 'redirect', to: 'https://main.example.invalid/register', status: 308 });
    assert.deepEqual(run(D, '/account/register/', { search: '?plan=handyman' }), { action: 'redirect', to: 'https://main.example.invalid/register?plan=handyman', status: 308 });
    assert.notEqual(run(D, '/account/login')?.action, 'redirect');
  });
  test('the home is an internal rewrite, the public address has no prefix', () => {
    assert.deepEqual(run(D, '/'), { action: 'rewrite', pathname: '/directory' });
  });
  test('/sitemap.xml here is the directory sitemap index; the main host keeps its own', () => {
    assert.deepEqual(run(D, '/sitemap.xml'), { action: 'rewrite', pathname: '/sitemaps/directory-index.xml' });
    assert.deepEqual(run('main.example.invalid', '/sitemap.xml'), { action: 'pass', host: 'main' });
    assert.deepEqual(run('main.example.invalid', '/robots.txt'), { action: 'pass', host: 'main' });
  });
  test('the directory sitemaps are answered on the directory host only', () => {
    assert.deepEqual(run('main.example.invalid', '/sitemaps/directory-index.xml'), { action: 'not-found', host: 'main' });
    assert.deepEqual(run('main.example.invalid', '/sitemaps/directory-3.xml'), { action: 'not-found', host: 'main' });
  });
  test('/directory and below redirect to the same address without the prefix', () => {
    assert.deepEqual(run(D, '/directory'), { action: 'redirect', to: 'https://directory.main.example.invalid/', status: 308 });
    assert.deepEqual(run(D, '/directory/chennai', { search: '?x=1' }), { action: 'redirect', to: 'https://directory.main.example.invalid/chennai?x=1', status: 308 });
  });
  test('directory addresses and V3 routes pass', () => {
    for (const p of ['/chennai', '/chennai/plumbers', '/business/anand-electricals', '/state/tamil-nadu', '/category/plumbers', '/pincode/600020/plumbers', '/chennai/plumbers/page/2',
      '/claim', '/claim/start/x', '/account/login', '/legal/terms', '/sitemaps/directory-index.xml', '/sitemaps/directory-2.xml', '/directory-api/page-visit', '/robots.txt']) {
      assert.deepEqual(run(D, p), { action: 'pass', host: 'directory' }, p);
    }
  });
  test('marketing and other live routes are a real 404, never the marketing page', () => {
    for (const p of ['/pricing', '/about', '/industries/travel', '/demo/clinic', '/dashboard', '/login', '/site/anyone', '/ls/x', '/leadspace', '/terms']) {
      assert.deepEqual(run(D, p), { action: 'not-found', host: 'directory' }, p);
    }
  });
  test('/go is the click-out only: a business id passes, a campaign slug is a 404', () => {
    assert.deepEqual(run(D, '/go/0a1b2c3d-0000-4000-8000-000000000000'), { action: 'pass', host: 'directory' });
    assert.deepEqual(run(D, '/go/summer-sale'), { action: 'not-found', host: 'directory' });
    assert.deepEqual(run(D, '/go/0a1b2c3d-0000-4000-8000-000000000000/extra'), { action: 'not-found', host: 'directory' });
  });
});

describe('vendor, reserved and unknown hosts', () => {
  test('a vendor host passes with its class', () => {
    assert.deepEqual(run('sri-murugan.main.example.invalid', '/'), { action: 'pass', host: 'vendor-site' });
    assert.deepEqual(run('sri-murugan.main.example.invalid', '/services'), { action: 'pass', host: 'vendor-site' });
  });
  test('app, admin, api and media hosts are never handled here', () => {
    for (const h of ['app', 'admin', 'api', 'media']) for (const p of ['/', '/login', '/anything']) assert.deepEqual(run(`${h}.main.example.invalid`, p), { action: 'not-found', host: 'reserved' }, `${h}${p}`);
  });
  test('reserved labels (gapi, send, mail, V2 client names) are never handled here', () => {
    for (const n of ['gapi', 'send', 'mail', 'mrtravels', 's2travels', 'allwintours']) assert.deepEqual(run(`${n}.main.example.invalid`, '/'), { action: 'not-found', host: 'reserved' }, n);
  });
  test('unknown hosts get a real 404, never the marketing page', () => {
    for (const h of ['other.invalid', 'a.b.main.example.invalid', 'evilmain.example.invalid', '', 'localhost']) assert.deepEqual(run(h, '/'), { action: 'not-found', host: 'unknown' }, h);
  });
});

describe('stripDirectoryPrefix', () => {
  test('cases', () => {
    assert.equal(stripDirectoryPrefix('/directory'), '/');
    assert.equal(stripDirectoryPrefix('/directory/'), '/');
    assert.equal(stripDirectoryPrefix('/directory/a/b'), '/a/b');
    assert.equal(stripDirectoryPrefix('/directory-go/x'), null);
    assert.equal(stripDirectoryPrefix('/chennai'), null);
  });
});

describe('directoryHomeHref', () => {
  test('/ once the host layer is on, /directory before', () => {
    assert.equal(directoryHomeHref(cfg, ON), '/');
    assert.equal(directoryHomeHref(cfg, HOSTS), '/directory');
    assert.equal(directoryHomeHref(readHostConfig({}), { V3_PUBLIC_ENABLED: 'true' }), '/directory');
  });
});
