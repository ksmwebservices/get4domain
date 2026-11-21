import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from '../../../middleware';
import { resetHostLog } from '../host-log';
import { resetVendorMemo } from '../vendor-site';

/** The runtime settings of the live test container (measured after P9), exactly. NEXT_PUBLIC_SITE_BASE_DOMAIN is baked at build: here it is set before the middleware reads it, as the build would inline it. */
const LIVE_ENV: Record<string, string> = {
  V3_PUBLIC_ENABLED: 'true', V3_PUBLIC_USE_MOCKS: 'false',
  MAIN_HOST: 'v3site.get4domain.com', APP_HOST: 'v3app.get4domain.com', API_HOST: 'v3api.get4domain.com', DIRECTORY_HOST: 'v3directory.get4domain.com',
  ADMIN_HOST: 'v3admin.get4domain.com', MEDIA_HOST: 'v3media.get4domain.com',
  NEXT_PUBLIC_SITE_BASE_DOMAIN: 'get4domain.com', INTERNAL_API_URL: 'http://g4d-v3-api:3008',
};

const saved: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
const realWarn = console.warn;
let warned: string[] = [];
let calls: string[] = [];

beforeEach(() => {
  for (const k of [...Object.keys(LIVE_ENV), 'API_BASE_URL', 'NEXT_PUBLIC_API_URL']) saved[k] = process.env[k];
  delete process.env.API_BASE_URL;
  delete process.env.NEXT_PUBLIC_API_URL;
  Object.assign(process.env, LIVE_ENV);
  calls = [];
  warned = [];
  resetVendorMemo(); // the middleware remembers "V3 does not own this host" for a minute
  resetHostLog();    // and each host and reason is logged once per ten minutes
  // the backend, faked: it answers "no V3 site" for any host (the vendor is a V2 site), and no call leaves this machine
  globalThis.fetch = (async (url: string | URL | Request) => { calls.push(String(url)); return new Response('Not found', { status: 404 }); }) as typeof fetch;
  console.warn = (...a: unknown[]) => { warned.push(a.map(String).join(' ')); };
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  globalThis.fetch = realFetch;
  console.warn = realWarn;
});

const ask = (host: string, path = '/', urlHost?: string) => middleware(new NextRequest(`http://${urlHost ?? host.replace(/:\d+$/, '').replace(/\.$/, '')}${path}`, { headers: { host } }));
const rewriteOf = (r: Response): string | null => { const h = r.headers.get('x-middleware-rewrite'); return h ? new URL(h).pathname : null; };

describe('P10 the live case: Host plumberboy.get4domain.com with the live settings', () => {
  test('the vendor host is rewritten to /site/plumberboy (the old code answered a plain 404 with no rewrite header)', async () => {
    const r = await ask('plumberboy.get4domain.com');
    assert.equal(rewriteOf(r), '/site/plumberboy', `status ${r.status}`);
    assert.notEqual(r.status, 404);
  });
  test('also with a port, a trailing dot and capital letters; inner paths keep their path', async () => {
    for (const host of ['PlumberBoy.Get4Domain.com', 'plumberboy.get4domain.com:3000', 'plumberboy.get4domain.com.', 'PLUMBERBOY.GET4DOMAIN.COM.:8080']) assert.equal(rewriteOf(await ask(host)), '/site/plumberboy', host);
    assert.equal(rewriteOf(await ask('plumberboy.get4domain.com', '/p/about')), '/site/plumberboy/p/about');
  });
  test('a Free and a Pro vendor are the same to the middleware (both <name>.get4domain.com)', async () => {
    for (const name of ['plumberboy', 'sri-murugan-plumbing', 'a1b2c3']) assert.equal(rewriteOf(await ask(`${name}.get4domain.com`)), `/site/${name}`, name);
  });
  test('the only call made to the backend is the V3 "do you own this host" question, to the runtime address', async () => {
    await ask('plumberboy.get4domain.com');
    assert.ok(calls.length >= 1 && calls.every((u) => u.startsWith('http://g4d-v3-api:3008/v3/public/site/by-host?host=plumberboy.get4domain.com')), calls.join(' | '));
  });
});

describe('P10 own internal links of a vendor site on its host', () => {
  // A1: a vendor has no /site/<name> path address on any host (the full rule and its tests are in a1.test.ts)
  test('/site/<own name>/... on the vendor own host is a 301 to the same page without the prefix', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ exists: true, status: 'LIVE' }), { status: 200 })) as typeof fetch;
    const r = await ask('plumberboy.get4domain.com', '/site/plumberboy/contact?x=1');
    assert.equal(r.status, 301);
    assert.equal(r.headers.get('location'), 'https://plumberboy.get4domain.com/contact?x=1');
  });
  test('a /site/<name> of a vendor that does not exist is a 404 on a vendor host too', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ exists: false, status: 'NOT_FOUND' }), { status: 200 })) as typeof fetch;
    for (const path of ['/site/other-vendor', '/site/other-vendor/contact']) assert.equal((await ask('plumberboy.get4domain.com', path)).status, 404, path);
  });
});

describe('P10 portal hosts keep working exactly as before', () => {
  test('v3site (main) serves the marketing home, v3directory the directory home', async () => {
    assert.equal(rewriteOf(await ask('v3site.get4domain.com')), '/v3-site');
    assert.equal(rewriteOf(await ask('v3site.get4domain.com', '/pricing')), '/v3-site/pricing');
    assert.equal(rewriteOf(await ask('v3directory.get4domain.com')), '/directory');
  });
  test('v3app, v3api, v3admin and v3media are never handled by this app: a plain 404, and no vendor rewrite', async () => {
    for (const host of ['v3app.get4domain.com', 'v3api.get4domain.com', 'v3admin.get4domain.com', 'v3media.get4domain.com']) {
      const r = await ask(host);
      assert.equal(r.status, 404, host);
      assert.equal(rewriteOf(r), null, host);
    }
  });
  test('www of the main host goes to the main host (308), as before', async () => {
    const r = await ask('www.v3site.get4domain.com', '/pricing');
    assert.equal(r.status, 308);
    assert.equal(r.headers.get('location'), 'https://v3site.get4domain.com/pricing');
  });
});

describe('P10 reserved names and other hosts are never vendors', () => {
  test('reserved platform names, partner, and every name starting v3 or t3- are not rewritten', async () => {
    for (const name of ['www', 'api', 'app', 'admin', 'partner', 'directory', 'media', 'mail', 'send', 'gapi', 'v3', 'v3foo', 'v3-anything', 't3-site', 't3-x', 'allwintours']) {
      const r = await ask(`${name}.get4domain.com`);
      assert.equal(rewriteOf(r), null, `${name} must not become a vendor`);
      assert.equal(r.status, 404, name);
    }
  });
  test('the backend reserved list (default settings) is respected too', async () => {
    for (const name of ['login', 'dashboard', 'support', 'staging', 'demo', 'cdn', 'static', 'portal']) assert.equal(rewriteOf(await ask(`${name}.get4domain.com`)), null, name);
  });
  test('the bare base domain, a two-level name and a host outside the base are not vendors', async () => {
    for (const host of ['get4domain.com', 'a.b.get4domain.com', 'plumberboy.example.com', 'plumberboy.get4domain.com.evil.example']) assert.equal(rewriteOf(await ask(host)), null, host);
  });
  test('a name that merely contains v3 or t3 (not at the start) is a vendor', async () => {
    for (const name of ['pv3', 'cat3-shop', 'my-t3-shop']) assert.equal(rewriteOf(await ask(`${name}.get4domain.com`)), `/site/${name}`, name);
  });
});

describe('P10 a request to the base domain that is not rewritten leaves one log line with a reason', () => {
  const lines = (): Array<Record<string, string>> => warned.filter((w) => w.includes('host_not_rewritten')).map((w) => JSON.parse(w) as Record<string, string>);
  test('reasons: PORTAL_HOST, RESERVED_NAME, EMPTY_SUBDOMAIN, NOT_UNDER_BASE; host class and reason only', async () => {
    await ask('v3app.get4domain.com');
    await ask('partner.get4domain.com');
    await ask('get4domain.com');
    await ask('plumberboy.example.com');
    const by = Object.fromEntries(lines().map((l) => [l.host, l]));
    assert.equal(by['v3app.get4domain.com']?.reason, 'PORTAL_HOST');
    assert.equal(by['partner.get4domain.com']?.reason, 'RESERVED_NAME');
    assert.equal(by['get4domain.com']?.reason, 'EMPTY_SUBDOMAIN');
    assert.equal(by['plumberboy.example.com']?.reason, 'NOT_UNDER_BASE');
    for (const l of lines()) assert.deepEqual(Object.keys(l).sort(), ['class', 'evt', 'host', 'reason'], 'nothing but the host, its class and the reason');
  });
  test('a rewritten vendor host logs nothing, and the same host and reason is logged once, not on every request', async () => {
    await ask('plumberboy.get4domain.com');
    assert.equal(lines().length, 0);
    await ask('v3foo.get4domain.com');
    await ask('v3foo.get4domain.com');
    await ask('v3foo.get4domain.com', '/x');
    assert.equal(lines().filter((l) => l.host === 'v3foo.get4domain.com').length, 1);
  });
  test('a host that is not a valid name is logged as "invalid", never as typed', async () => {
    await ask('Ravi Kumar <ravi@example.com>', '/', 'x.get4domain.com');
    assert.ok(lines().every((l) => !/ravi|kumar|@/i.test(JSON.stringify(l))));
  });
});
