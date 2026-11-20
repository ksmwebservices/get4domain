import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fetchSiteState, freeViewOf, isFreeSite, siteStateOf } from '../site-state';

const read = (f: string): string => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');

describe('P8 site state: GET /cms/site-state/:subdomain', () => {
  test('LIVE, DRAFT and NOT_FOUND are read; NOT_FOUND never exists', () => {
    assert.deepEqual(siteStateOf({ exists: true, status: 'LIVE' }), { exists: true, status: 'LIVE' });
    assert.deepEqual(siteStateOf({ data: { exists: true, status: 'draft' } }), { exists: true, status: 'DRAFT' });
    assert.deepEqual(siteStateOf({ exists: false, status: 'NOT_FOUND' }), { exists: false, status: 'NOT_FOUND' });
    assert.equal(siteStateOf({ exists: true, status: 'NOT_FOUND' })?.exists, false);
  });
  test('any other shape is not a state', () => {
    for (const j of [null, 'x', {}, { exists: 'yes', status: 'LIVE' }, { exists: true, status: 'WEIRD' }, { exists: true }]) assert.equal(siteStateOf(j), null, JSON.stringify(j));
  });
  test('the fetch asks the route for a valid address only, and an unreadable answer is null (never "exists")', async () => {
    const real = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = (async (u: string | URL | Request) => { urls.push(String(u)); return Response.json({ exists: true, status: 'DRAFT' }); }) as typeof fetch;
    try {
      assert.deepEqual(await fetchSiteState('http://api.invalid', 'adyar-fixers'), { exists: true, status: 'DRAFT' });
      assert.deepEqual(urls, ['http://api.invalid/cms/site-state/adyar-fixers']);
      assert.equal(await fetchSiteState('http://api.invalid', '../etc'), null);
      assert.equal(urls.length, 1, 'an invalid name is not sent');
      globalThis.fetch = (async () => new Response('x', { status: 500 })) as typeof fetch;
      assert.equal(await fetchSiteState('http://api.invalid', 'adyar-fixers'), null);
      globalThis.fetch = (async () => { throw new Error('down'); }) as typeof fetch;
      assert.equal(await fetchSiteState('http://api.invalid', 'adyar-fixers'), null);
    } finally { globalThis.fetch = real; }
  });
  test('the renderer shows "being set up" only when the site exists, and keeps the 404 otherwise', () => {
    const page = read('app/site/[subdomain]/[[...rest]]/page.tsx');
    assert.match(page, /fetchSiteState\(siteApiBase\(\), subdomain\)\)\?\.exists === true/);
    assert.match(page, /if \(await siteExists\(subdomain\)\) return <SiteBeingSetUp \/>;\s*return missing\(subdomain\);/);
    assert.match(page, /if \(await siteExists\(subdomain\)\) return \{ title: 'This site is being set up', robots: \{ index: false, follow: false \} \};/);
  });
  test('the "being set up" page is plain: a title, no link, form, button, e-mail or chat', () => {
    const c = read('components/site/SiteBeingSetUp.tsx');
    assert.match(c, /This site is being set up/);
    assert.ok(!/<(a|button|form|input|textarea)\b|mailto:|ChatBot|ChatWidget|@[a-z]+\./i.test(c));
  });
});

describe('P8 a Free site never shows a form, chat, button or e-mail', () => {
  test('Free is read from plan or isFree; nothing else counts', () => {
    assert.equal(isFreeSite({ plan: 'FREE' }), true);
    assert.equal(isFreeSite({ plan: 'free' }), true);
    assert.equal(isFreeSite({ plan: { kind: 'FREE' } }), true);
    assert.equal(isFreeSite({ plan: { tier: 'Free' } }), true);
    assert.equal(isFreeSite({ isFree: true }), true);
    for (const s of [null, {}, { plan: 'PRO' }, { plan: { kind: 'HANDYMAN' } }, { isFree: 'true' }, { plan: 'freedom' }]) assert.equal(isFreeSite(s), false, JSON.stringify(s));
  });
  const site = {
    vendor: { businessName: 'Adyar Fixers' },
    cms: { businessName: null, tagline: 'Repairs at home', about: 'We fix things.', address: 'Adyar, Chennai', phone: '+91 98765 43210', logo: 'https://img.example.com/l.png', banner: 'javascript:alert(1)', email: 'owner@example.com', whatsapp: '+919876543210' },
    products: [{ name: 'Tap repair', price: '₹300', description: null, image: 'https://img.example.com/t.png' }],
  };
  test('the Free view carries the facts as text and drops e-mail, WhatsApp and unsafe pictures', () => {
    const v = freeViewOf(site);
    assert.equal(v.name, 'Adyar Fixers');
    assert.equal(v.phone, '+91 98765 43210');
    assert.equal(v.banner, null);
    const text = JSON.stringify(v);
    assert.ok(!text.includes('owner@example.com'), 'no e-mail');
    assert.ok(!text.includes('919876543210'), 'no WhatsApp number');
    assert.equal(v.items[0].name, 'Tap repair');
  });
  test('the Free page file has no form, input, button, link, e-mail, WhatsApp or chat', () => {
    const c = read('components/site/FreeSiteView.tsx').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/<(a|button|form|input|textarea|select|iframe|script)\b/i.test(c), 'a forbidden element');
    assert.ok(!/mailto:|tel:|wa\.me|whatsapp|ChatBot|ChatWidget|DemoContactSection|onClick|href=/i.test(c), 'a forbidden thing');
    assert.ok(!/\.email\b/.test(c));
  });
  test('the renderer puts the Free page before every design, template and theme', () => {
    const page = read('app/site/[subdomain]/[[...rest]]/page.tsx');
    const free = page.indexOf('if (isFreeSite(site)) {');
    assert.ok(free > 0);
    for (const later of ['themePages(site.theme)', 'templateFromThemeRow(site.theme)', 'if (site.docV2)', 'getEngineIndustry(', '<SiteApp view={view}']) assert.ok(page.indexOf(later) > free, later);
  });
});
