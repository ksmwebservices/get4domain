import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { classifyHost, explicitSiteBase, hostNotRewritten, isReservedLabel, readHostConfig, siteBaseDomain } from '../hostnames';
import { hostNotRewrittenLine, logHostNotRewritten, resetHostLog } from '../host-log';

const src = (f: string): string => readFileSync(fileURLToPath(new URL(`../../../${f}`, import.meta.url)), 'utf8');

/** The live container's runtime settings without NEXT_PUBLIC_SITE_BASE_DOMAIN: that one is inlined at build and is not necessarily in the runtime environment. */
const RUNTIME: Record<string, string> = {
  V3_PUBLIC_ENABLED: 'true', V3_PUBLIC_USE_MOCKS: 'false', MAIN_HOST: 'v3site.get4domain.com', APP_HOST: 'v3app.get4domain.com', API_HOST: 'v3api.get4domain.com',
  DIRECTORY_HOST: 'v3directory.get4domain.com', ADMIN_HOST: 'v3admin.get4domain.com', MEDIA_HOST: 'v3media.get4domain.com', INTERNAL_API_URL: 'http://g4d-v3-api:3008',
};

describe('P10.1 why the live host was "unknown": what is read at build and what at run time', () => {
  test('the old rule measured a vendor host against MAIN_HOST: plumberboy.get4domain.com is not under v3site.get4domain.com', () => {
    const cfg = readHostConfig(RUNTIME); // no vendor base known: exactly the old behaviour
    assert.equal(cfg.vendorBase, undefined);
    assert.deepEqual(classifyHost('plumberboy.get4domain.com', cfg), { kind: 'unknown' });
    // names under the portal main host were vendors, which is why V3 test hosts looked fine
    assert.deepEqual(classifyHost('plumberboy.v3site.get4domain.com', cfg), { kind: 'vendor-site', label: 'plumberboy' });
  });
  test('with the vendor base domain (the build-inlined NEXT_PUBLIC_SITE_BASE_DOMAIN) the live host is a vendor host', () => {
    const cfg = { ...readHostConfig(RUNTIME), vendorBase: 'get4domain.com' };
    assert.deepEqual(classifyHost('plumberboy.get4domain.com', cfg), { kind: 'vendor-site', label: 'plumberboy' });
    assert.deepEqual(classifyHost('Plumberboy.GET4DOMAIN.com:8080', cfg), { kind: 'vendor-site', label: 'plumberboy' });
    assert.deepEqual(classifyHost('plumberboy.get4domain.com.', cfg), { kind: 'vendor-site', label: 'plumberboy' });
  });
  test('portal hosts are exact names and win over the vendor rule', () => {
    const cfg = { ...readHostConfig(RUNTIME), vendorBase: 'get4domain.com' };
    assert.deepEqual(classifyHost('v3site.get4domain.com', cfg), { kind: 'main', canonical: true });
    assert.deepEqual(classifyHost('www.v3site.get4domain.com', cfg), { kind: 'main', canonical: false });
    assert.deepEqual(classifyHost('v3directory.get4domain.com', cfg), { kind: 'directory' });
    for (const [h, role] of [['v3app.get4domain.com', 'app'], ['v3api.get4domain.com', 'api'], ['v3admin.get4domain.com', 'admin'], ['v3media.get4domain.com', 'media']] as const) assert.deepEqual(classifyHost(h, cfg), { kind: 'reserved', role }, h);
  });
  test('the base domain setting: explicit when set, null when not, with the default only where a default is wanted', () => {
    assert.equal(explicitSiteBase({ NEXT_PUBLIC_SITE_BASE_DOMAIN: 'get4domain.com' }), 'get4domain.com');
    assert.equal(explicitSiteBase({ NEXT_PUBLIC_SITE_BASE_DOMAIN: 'https://Get4Domain.com/' }), 'get4domain.com');
    assert.equal(explicitSiteBase({}), null);
    assert.equal(explicitSiteBase({ NEXT_PUBLIC_SITE_BASE_DOMAIN: 'nodots' }), null);
    assert.equal(siteBaseDomain({}), 'get4domain.com');
    assert.equal(readHostConfig({ ...RUNTIME, NEXT_PUBLIC_SITE_BASE_DOMAIN: 'get4domain.com' }).vendorBase, 'get4domain.com');
    assert.equal('vendorBase' in readHostConfig({}), false, 'nothing set: nothing configured');
  });
  test('what the middleware bundle fixes at build time: only the base domain, read with a static process.env.NEXT_PUBLIC_SITE_BASE_DOMAIN', () => {
    const mw = src('middleware.ts');
    const statics = (mw.match(/process\.env\.NEXT_PUBLIC_[A-Z_]+/g) ?? []).filter((v, i, a) => a.indexOf(v) === i);
    assert.deepEqual(statics.filter((s) => !s.includes('//')), ['process.env.NEXT_PUBLIC_SITE_BASE_DOMAIN']);
    assert.match(mw, /const SITE_BASE = \(process\.env\.NEXT_PUBLIC_SITE_BASE_DOMAIN \|\| 'get4domain\.com'\)/);
    assert.match(mw, /const hostCfg = \(\): HostConfig => \(\{ \.\.\.readHostConfig\(\), vendorBase: SITE_BASE \}\);/);
    // the host names are read from the runtime environment on every request (readHostConfig), never captured in a module constant
    assert.ok(!/const (MAIN|APP|API|ADMIN|MEDIA|DIRECTORY)_HOST\b/.test(mw));
  });
  test('the vendor rewrite and the host layer both use that one configuration', () => {
    const mw = src('middleware.ts');
    assert.match(mw, /classifyHost\(req\.headers\.get\('host'\), hostCfg\(\)\)/);
    assert.match(mw, /\}, hostCfg\(\)\);/);
    assert.match(mw, /logHostNotRewritten\(req\.headers\.get\('host'\), hostCfg\(\)\)/);
  });
});

describe('P10.2 reserved names', () => {
  test('union of the frontend list, the backend mandatory and default lists, partner, and the v3 and t3- prefixes', () => {
    for (const n of ['www', 'api', 'app', 'admin', 'partner', 'directory', 'media', 'mail', 'send', 'gapi', 'login', 'dashboard', 'support', 'staging', 'demo', 'cdn', 'static', 'portal', 'get4domain', 'g4d', 'allwintours', 'v3', 'v3site', 'v3app', 'v3x', 'v3-shop', 't3-site', 't3-', 'T3-Anything']) assert.equal(isReservedLabel(n), true, n);
    for (const n of ['plumberboy', 'pv3', 'cat3-shop', 't3shop', 'my-v3', 'sri-murugan-plumbing', 'xv3-site']) assert.equal(isReservedLabel(n), false, n);
  });
});

describe('P10.3 the log line', () => {
  test('reason codes for each kind of host', () => {
    const cfg = { ...readHostConfig(RUNTIME), vendorBase: 'get4domain.com' };
    assert.equal(hostNotRewritten('plumberboy.get4domain.com', cfg), null);
    assert.deepEqual(hostNotRewritten('v3site.get4domain.com', cfg), { hostClass: 'main', reason: 'PORTAL_HOST' });
    assert.deepEqual(hostNotRewritten('v3directory.get4domain.com', cfg), { hostClass: 'directory', reason: 'PORTAL_HOST' });
    assert.deepEqual(hostNotRewritten('v3app.get4domain.com', cfg), { hostClass: 'reserved', reason: 'PORTAL_HOST' });
    assert.deepEqual(hostNotRewritten('partner.get4domain.com', cfg), { hostClass: 'reserved', reason: 'RESERVED_NAME' });
    assert.deepEqual(hostNotRewritten('t3-x.get4domain.com', cfg), { hostClass: 'reserved', reason: 'RESERVED_NAME' });
    assert.deepEqual(hostNotRewritten('get4domain.com', cfg), { hostClass: 'unknown', reason: 'EMPTY_SUBDOMAIN' });
    assert.deepEqual(hostNotRewritten('a.b.get4domain.com', cfg), { hostClass: 'unknown', reason: 'EMPTY_SUBDOMAIN' });
    assert.deepEqual(hostNotRewritten('plumberboy.example.com', cfg), { hostClass: 'unknown', reason: 'NOT_UNDER_BASE' });
    assert.deepEqual(hostNotRewritten('', cfg), { hostClass: 'unknown', reason: 'NOT_UNDER_BASE' });
  });
  test('the line has the host, its class and the reason; the same host and reason is written once per ten minutes', () => {
    resetHostLog();
    const cfg = { ...readHostConfig(RUNTIME), vendorBase: 'get4domain.com' };
    const realWarn = console.warn;
    const out: string[] = [];
    console.warn = (...a: unknown[]) => { out.push(a.map(String).join(' ')); };
    try {
      const t0 = 1_000_000;
      assert.equal(logHostNotRewritten('partner.get4domain.com', cfg, t0), hostNotRewrittenLine('partner.get4domain.com', 'reserved', 'RESERVED_NAME'));
      assert.equal(logHostNotRewritten('partner.get4domain.com', cfg, t0 + 5 * 60_000), null);
      assert.ok(logHostNotRewritten('partner.get4domain.com', cfg, t0 + 11 * 60_000), 'written again after the window');
      assert.equal(logHostNotRewritten('plumberboy.get4domain.com', cfg, t0), null, 'a vendor host is not logged');
      assert.equal(out.length, 2);
      assert.deepEqual(Object.keys(JSON.parse(out[0]) as object).sort(), ['class', 'evt', 'host', 'reason']);
    } finally { console.warn = realWarn; resetHostLog(); }
  });
});
