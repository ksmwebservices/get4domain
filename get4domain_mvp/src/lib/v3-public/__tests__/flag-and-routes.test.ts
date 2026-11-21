import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { apiBase, defaultRevalidate, siteOrigin, vendorAppUrl } from '../config';
import { isV3PublicEnabled, useMocks } from '../flag';
import { isInternalOnlyPath, isV3PublicPath, V3_PUBLIC_PREFIXES } from '../routes';

describe('the flag', () => {
  test('is off unless the value is exactly true', () => {
    assert.equal(isV3PublicEnabled({}), false);
    assert.equal(isV3PublicEnabled({ V3_PUBLIC_ENABLED: '' }), false);
    assert.equal(isV3PublicEnabled({ V3_PUBLIC_ENABLED: '1' }), false);
    assert.equal(isV3PublicEnabled({ V3_PUBLIC_ENABLED: 'yes' }), false);
    assert.equal(isV3PublicEnabled({ V3_PUBLIC_ENABLED: 'false' }), false);
    assert.equal(isV3PublicEnabled({ V3_PUBLIC_ENABLED: 'true' }), true);
    assert.equal(isV3PublicEnabled({ V3_PUBLIC_ENABLED: ' TRUE ' }), true);
  });

  test('mock mode is on by default and off only for the value false', () => {
    assert.equal(useMocks({}), true);
    assert.equal(useMocks({ V3_PUBLIC_USE_MOCKS: 'true' }), true);
    assert.equal(useMocks({ V3_PUBLIC_USE_MOCKS: 'false' }), false);
  });
});

describe('the configuration', () => {
  test('has no production fallback', () => {
    assert.equal(apiBase({}), null);
    assert.equal(vendorAppUrl({}), null);
    assert.equal(siteOrigin({}), null);
  });

  test('prefers the server-only API address and rejects anything that is not http or https', () => {
    assert.equal(apiBase({ API_BASE_URL: 'http://api.example.invalid/', NEXT_PUBLIC_API_BASE_URL: 'https://other.example.invalid' }), 'http://api.example.invalid');
    assert.equal(apiBase({ NEXT_PUBLIC_API_BASE_URL: 'https://other.example.invalid' }), 'https://other.example.invalid');
    assert.equal(apiBase({ API_BASE_URL: 'javascript:alert(1)' }), null);
    assert.equal(apiBase({ API_BASE_URL: 'not a url' }), null);
  });

  test('the canonical origin never carries www', () => {
    assert.equal(siteOrigin({ V3_PUBLIC_SITE_ORIGIN: 'https://www.staging.example.invalid/' }), 'https://staging.example.invalid');
    assert.equal(siteOrigin({ V3_PUBLIC_SITE_ORIGIN: 'http://www.localhost:3000' }), 'http://localhost:3000');
  });

  test('revalidate has a safe default and bounds', () => {
    assert.equal(defaultRevalidate({}), 300);
    assert.equal(defaultRevalidate({ V3_PUBLIC_REVALIDATE_SECONDS: '5' }), 300);
    assert.equal(defaultRevalidate({ V3_PUBLIC_REVALIDATE_SECONDS: '120' }), 120);
  });
});

describe('the fixed routes the middleware answers with a 404 while the flag is off', () => {
  test('every new fixed route and handler is covered', () => {
    for (const p of ['/directory', '/directory/x', '/directory-go/b-1001', '/directory-api/claim/start', '/directory-pages/chennai', '/directory-robots', '/claim', '/claim/abc', '/claim/start/x', '/legal', '/legal/terms', '/account/login', '/account/register', '/sitemaps/directory-1.xml']) {
      assert.equal(isV3PublicPath(p), true, p);
    }
  });

  test('no live page is covered', () => {
    for (const p of ['/', '/pricing', '/terms', '/privacy-policy', '/refund-policy', '/login', '/register', '/go/some-campaign', '/dashboard', '/demo/clinic', '/sitemap.xml', '/robots.txt', '/claims', '/accounting', '/legalese']) {
      assert.equal(isV3PublicPath(p), false, p);
    }
  });

  test('the prefix list is the documented one', () => {
    assert.deepEqual([...V3_PUBLIC_PREFIXES], ['/directory', '/claim', '/legal', '/account', '/sitemaps', '/search']);
  });

  test('rewrite targets cannot be typed by a visitor', () => {
    assert.equal(isInternalOnlyPath('/directory-pages/chennai/plumbers'), true);
    assert.equal(isInternalOnlyPath('/directory-robots'), true);
    assert.equal(isInternalOnlyPath('/directory'), false);
  });
});
