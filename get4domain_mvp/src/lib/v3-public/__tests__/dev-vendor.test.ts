import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEV_VENDOR_HEADER, DEV_VENDOR_PREFIX, devRedirectLocation, devVendorHost, devVendorViewEnabled, isProductionBuild, parseDevVendorPath, prefixRootLinks } from '../dev-vendor';

const ON = { V3_PUBLIC_ENABLED: 'true', V3_PUBLIC_DEV_VENDOR_VIEW: 'true' };

describe('the developer-only vendor view switch', () => {
  test('on only with the flag, its own name exactly true, and not a production build', () => {
    assert.equal(devVendorViewEnabled(ON, false), true);
    assert.equal(devVendorViewEnabled({ ...ON, V3_PUBLIC_ENABLED: '' }, false), false, 'flag off');
    assert.equal(devVendorViewEnabled({ V3_PUBLIC_ENABLED: 'true' }, false), false, 'its own name missing');
    for (const v of ['1', 'yes', 'false', 'TRUEE', '']) assert.equal(devVendorViewEnabled({ ...ON, V3_PUBLIC_DEV_VENDOR_VIEW: v }, false), false, v);
  });
  test('a production build is never enabled, whatever the environment says', () => {
    assert.equal(devVendorViewEnabled(ON, true), false);
    assert.equal(devVendorViewEnabled({ ...ON, NODE_ENV: 'development' }, true), false);
  });
  test('the test run itself is not a production build, and the default reads the real environment', () => {
    assert.equal(isProductionBuild(), process.env.NODE_ENV === 'production');
  });
});

describe('the dev address', () => {
  test('a label and a rest path', () => {
    assert.deepEqual(parseDevVendorPath('/_vendor/sample-pro'), { label: 'sample-pro', rest: '/' });
    assert.deepEqual(parseDevVendorPath('/_vendor/sample-pro/'), { label: 'sample-pro', rest: '/' });
    assert.deepEqual(parseDevVendorPath('/_vendor/sample-pro/about'), { label: 'sample-pro', rest: '/about' });
    assert.deepEqual(parseDevVendorPath('/_vendor/Sample-Pro/assets/site.css'), { label: 'sample-pro', rest: '/assets/site.css' });
    assert.deepEqual(parseDevVendorPath('/_vendor/sample-pro/sitemap.xml'), { label: 'sample-pro', rest: '/sitemap.xml' });
  });
  test('anything that is not a clean label is null', () => {
    for (const p of ['/_vendor', '/_vendor/', '/_vendor//x', '/_vendor/-bad', '/_vendor/bad-', '/_vendor/a.b', '/_vendor/%2e%2e', '/_vendor/a_b', '/_vendors/x', '/vendor/x', '/', '/pricing']) assert.equal(parseDevVendorPath(p), null, p);
    assert.equal(parseDevVendorPath(`/_vendor/${'a'.repeat(64)}`), null);
  });
  test('the host is the label under the main domain, or localhost', () => {
    assert.equal(devVendorHost('sample-pro', 'main.example.invalid'), 'sample-pro.main.example.invalid');
    assert.equal(devVendorHost('sample-pro', null), 'sample-pro.localhost');
  });
  test('the header name and prefix are fixed', () => {
    assert.equal(DEV_VENDOR_PREFIX, '/_vendor');
    assert.equal(DEV_VENDOR_HEADER, 'x-v3-dev-vendor-host');
  });
});

describe('links of a stored page in the dev view', () => {
  test('root-relative href, src and action are put under the dev address; absolute and protocol-relative are left alone', () => {
    const html = '<a href="/about">a</a><img src="/assets/x.png"><form action="/contact"></form><a href="https://x.invalid/">b</a><a href="//cdn.invalid/x">c</a><a href="#top">d</a><a href="tel:1">e</a>';
    const out = prefixRootLinks(html, 'sample-pro');
    assert.match(out, /href="\/_vendor\/sample-pro\/about"/);
    assert.match(out, /src="\/_vendor\/sample-pro\/assets\/x\.png"/);
    assert.match(out, /action="\/_vendor\/sample-pro\/contact"/);
    assert.match(out, /href="https:\/\/x\.invalid\/"/);
    assert.match(out, /href="\/\/cdn\.invalid\/x"/);
    assert.match(out, /href="#top"/);
    assert.match(out, /href="tel:1"/);
  });
  test('the home link becomes the dev root', () => assert.equal(prefixRootLinks('<a href="/">Home</a>', 'x'), '<a href="/_vendor/x/">Home</a>'));
});

describe('redirects in the dev view', () => {
  test('a redirect to another vendor host of the same main domain stays under the dev address', () => {
    assert.equal(devRedirectLocation('https://sample-pro.main.example.invalid/about?x=1', 'sample-moved.main.example.invalid'), '/_vendor/sample-pro/about?x=1');
    assert.equal(devRedirectLocation('https://sample-pro.localhost/', 'sample-moved.localhost'), '/_vendor/sample-pro/');
  });
  test('any other location is returned as it is', () => {
    assert.equal(devRedirectLocation('https://elsewhere.invalid/x', 'sample-moved.main.example.invalid'), 'https://elsewhere.invalid/x');
    assert.equal(devRedirectLocation('https://a.b.main.example.invalid/x', 'sample-moved.main.example.invalid'), 'https://a.b.main.example.invalid/x');
    assert.equal(devRedirectLocation('/relative', 'x.localhost'), '/relative');
  });
});
