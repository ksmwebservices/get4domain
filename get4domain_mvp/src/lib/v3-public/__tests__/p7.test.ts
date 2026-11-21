import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';
import { DEFAULT_SITE_BASE_DOMAIN, siteBaseDomain, vendorHost } from '../hostnames';
import { categoryKnown, handleCategoryServices, handleRegister } from '../register-proxy';
import { MOCK_CATEGORIES } from '../packs';
import { vendorSignInUrl } from '../register-plan';
import { SITE } from '../site-strings';

const body = { businessName: 'Adyar Fixers', categoryKey: 'plumber', subdomain: 'adyar-fixers', name: 'Asha', email: 'asha@example.com', password: 'StrongPass1', acceptedTerms: true, plan: 'free', city: 'Chennai', area: 'Adyar', pincode: '600020' };
const req = new Request('http://localhost/x');
const read = (f: string): string => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');

/** every string under an object, with its path */
function strings(o: unknown, path: string, out: Array<[string, string]> = []): Array<[string, string]> {
  if (typeof o === 'string') out.push([path, o]);
  else if (Array.isArray(o)) o.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) strings(v, `${path}.${k}`, out);
  return out;
}

/** Run a body with the real (non-sample) mode and a fake API; always restores the environment. */
async function withFakeApi(handler: (url: string, init?: RequestInit) => Response, run: () => Promise<void>): Promise<void> {
  const realFetch = globalThis.fetch;
  const prev = { m: process.env.V3_PUBLIC_USE_MOCKS, a: process.env.API_BASE_URL };
  process.env.V3_PUBLIC_USE_MOCKS = 'false';
  process.env.API_BASE_URL = 'http://api.invalid';
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => handler(String(url), init)) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = realFetch;
    if (prev.m === undefined) delete process.env.V3_PUBLIC_USE_MOCKS; else process.env.V3_PUBLIC_USE_MOCKS = prev.m;
    if (prev.a === undefined) delete process.env.API_BASE_URL; else process.env.API_BASE_URL = prev.a;
  }
}

describe('P7.1 the category sent is always one from the list', () => {
  test('free text, a family label and a catalogue-only key are refused with a category error', async () => {
    for (const bad of ['Home repair and trades', 'FIELD_SERVICE', 'field-service', 'not-a-category', '', ' plumber']) {
      const r = await handleRegister(req, { ...body, categoryKey: bad });
      assert.equal(r.ok, false, `"${bad}" must not be accepted`);
      assert.equal(r.fields.category, 'category', bad);
    }
  });
  test('a category id from the list is accepted', async () => {
    assert.equal((await handleRegister(req, body)).ok, true);
  });
  test('categoryKey must match an id exactly', () => {
    assert.equal(categoryKnown(MOCK_CATEGORIES, 'plumber'), true);
    assert.equal(categoryKnown(MOCK_CATEGORIES, 'Plumber'), false);
    assert.equal(categoryKnown(MOCK_CATEGORIES, ''), false);
  });
  test('real mode checks the id against the API list, then sends it as `industry`; unknown text never reaches /auth/register', async () => {
    const sent: Array<{ url: string; body: Record<string, unknown> | null }> = [];
    const api = (u: string, init?: RequestInit): Response => {
      sent.push({ url: u, body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null });
      if (u.endsWith('/v3/public/pack-categories')) return Response.json({ success: true, data: [{ categoryKey: 'plumber', name: 'Plumber', family: 'FIELD_SERVICE', packKey: 'FIELD_SERVICE', minTier: 'HANDYMAN' }] });
      return Response.json({ data: { accessToken: 'x', site: { status: 'LIVE', published: false } } }, { status: 201 });
    };
    await withFakeApi(api, async () => {
      const bad = await handleRegister(req, { ...body, categoryKey: 'Home repair and trades' });
      assert.equal(bad.ok, false);
      assert.equal(bad.fields.category, 'category');
      assert.equal(sent.some((s) => s.url.endsWith('/auth/register')), false, 'unknown text must not reach /auth/register');
      await handleRegister(req, body);
      const call = sent.find((s) => s.url.endsWith('/auth/register'));
      assert.equal(call?.body?.industry, 'plumber');
      assert.equal(call?.body?.track, 'handyman');
    });
  });
  test('if the category list cannot be read, nothing is sent', async () => {
    let registered = false;
    await withFakeApi((u) => { if (u.endsWith('/auth/register')) registered = true; return new Response('no', { status: 503 }); }, async () => {
      const r = await handleRegister(req, body);
      assert.equal(r.ok, false);
      assert.equal(registered, false);
    });
  });
  test('the form disables Continue until a category is chosen and says why; the id is sent, not a label', () => {
    const f = read('components/site/RegisterForm.tsx');
    assert.match(f, /disabled=\{busy \|\| !categoryKey\}/);
    assert.match(f, /R\.categoryWhy/);
    assert.match(f, /categoryKey: cat \? categoryKey : ''/);
    assert.ok(!/industry: cat/.test(f));
    assert.match(SITE.register.categoryWhy, /category/i);
  });
  test('the register page offers only the API list (no catalogue-only category is added)', () => {
    assert.ok(!/options\.push/.test(read('app/(v3site)/v3-site/register/page.tsx')));
  });
  test('starter services: an invalid key gives none, a sample category gives names', async () => {
    assert.deepEqual((await handleCategoryServices('Bad Key!')).services, []);
    assert.ok((await handleCategoryServices('plumber')).services.length > 0);
  });
});

describe('P7.2 the site address shows the real host', () => {
  const saved = process.env.NEXT_PUBLIC_SITE_BASE_DOMAIN;
  afterEach(() => { if (saved === undefined) delete process.env.NEXT_PUBLIC_SITE_BASE_DOMAIN; else process.env.NEXT_PUBLIC_SITE_BASE_DOMAIN = saved; });
  test('the host is <typed name>.<base domain>', () => {
    assert.equal(vendorHost('Adyar-Fixers', 'get4domain.com'), 'adyar-fixers.get4domain.com');
    assert.equal(siteBaseDomain({ NEXT_PUBLIC_SITE_BASE_DOMAIN: 'get4domain.com' }), 'get4domain.com');
    assert.equal(siteBaseDomain({ NEXT_PUBLIC_SITE_BASE_DOMAIN: 'https://Example.com/' }), 'example.com');
    assert.equal(siteBaseDomain({}), DEFAULT_SITE_BASE_DOMAIN);
    assert.equal(siteBaseDomain({ NEXT_PUBLIC_SITE_BASE_DOMAIN: 'not a domain' }), DEFAULT_SITE_BASE_DOMAIN);
  });
  test('the form text never contains "v3site" and names no host other than the base domain', () => {
    const texts: Array<[string, string]> = [...strings(SITE.register, 'SITE.register'), ['RegisterForm.tsx', read('components/site/RegisterForm.tsx')], ['register/page.tsx', read('app/(v3site)/v3-site/register/page.tsx')]];
    const hosts = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|net|org|io|co)\b/gi;
    for (const [path, t] of texts) {
      assert.ok(!/v3site/i.test(t), `${path} mentions v3site`);
      for (const h of t.match(hosts) ?? []) assert.ok(h === DEFAULT_SITE_BASE_DOMAIN || h.endsWith(`.${DEFAULT_SITE_BASE_DOMAIN}`), `${path} names host ${h}`);
    }
  });
  test('the host guard really catches a bad host (it is not a vacuous test)', () => {
    const hosts = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|net|org|io|co)\b/gi;
    assert.deepEqual('.v3site.get4domain.com'.match(hosts), ['v3site.get4domain.com']);
    assert.ok(/v3site/i.test('Your site: name.v3site.get4domain.com'));
    assert.deepEqual('shop.example.com'.match(hosts), ['shop.example.com']);
  });
  test('the page passes the base domain from NEXT_PUBLIC_SITE_BASE_DOMAIN, not the main host', () => {
    const page = read('app/(v3site)/v3-site/register/page.tsx');
    assert.match(page, /siteBaseDomain\(\)/);
    assert.ok(!/readHostConfig|[^e]baseDomain\(/.test(page));
  });
  test('the form shows the full address and keeps the availability states', () => {
    const f = read('components/site/RegisterForm.tsx');
    assert.match(f, /vendorHost\(subdomain, p\.baseDomain\)/);
    for (const k of ['checking', 'available', 'taken', 'reserved', 'unknown']) assert.match(f, new RegExp(`availability === '${k}'`));
  });
});

describe('P7.3 after a Free registration', () => {
  test('the screen says the site is being created, shows the address as text, never claims live or paid, and links to the vendor sign-in', () => {
    const f = read('components/site/RegisterForm.tsx');
    assert.match(f, /R\.done\.creatingTitle/);
    const at = f.indexOf('data-testid="done-host"');
    assert.ok(at > 0);
    assert.ok(!/<a /.test(f.slice(at - 80, at + 60)), 'the address is text, not a link');
    assert.match(f, /vendorSignInUrl\(p\.vendorUrl\)/);
    assert.ok(!/window\.location\.assign/.test(f), 'no automatic jump after registering');
    const t = `${SITE.register.done.creatingTitle} ${SITE.register.done.creatingBody} ${SITE.register.creating}`.replace(/we do not say the site is live until it is/i, '');
    assert.ok(!/\b(is live|now live|paid|payment received)\b/i.test(t), t);
    assert.equal(SITE.register.done.creatingTitle, 'Your free site is being created');
  });
  test('the sign-in link is the vendor app /login, only for an http(s) address', () => {
    assert.equal(vendorSignInUrl('https://app.example.com'), 'https://app.example.com/login');
    assert.equal(vendorSignInUrl('https://app.example.com/base/?x=1'), 'https://app.example.com/base/login');
    assert.equal(vendorSignInUrl(null), null);
    assert.equal(vendorSignInUrl('javascript:alert(1)'), null);
  });
});
