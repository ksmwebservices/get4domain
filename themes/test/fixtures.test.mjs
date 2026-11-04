import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, CATEGORY_IDS } from '../lib/categories.mjs';
import { SEEDS } from '../fixtures/data.mjs';
import { sampleContent, extremeContent, stretchContent, EXTREME_KINDS, LANGS, allSamples, ENTITLEMENTS_ON, ENTITLEMENTS_OFF, ENTITLEMENTS_LISTING, sampleEntitlements } from '../fixtures/index.mjs';

const TAMIL = /[஀-௿]/;
const strings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach((x) => strings(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out)); return out; };

test('there is one seed per category and nothing else', () => {
  assert.deepEqual(Object.keys(SEEDS).sort(), [...CATEGORY_IDS].sort());
});

test('every category has complete English and Tamil sample content', () => {
  for (const c of CATEGORIES) for (const lang of LANGS) {
    const s = sampleContent(c.id, { lang });
    const at = `${c.id}/${lang}`;
    assert.equal(s.category, c.id); assert.equal(s.lang, lang);
    for (const p of ['site.name', 'site.tagline', 'hero.title', 'about.text', 'contact.phone', 'contact.address', 'cta.label']) {
      const v = p.split('.').reduce((o, k) => o?.[k], s);
      assert.ok(typeof v === 'string' && v.length > 2, `${at}: ${p}`);
    }
    assert.equal(s.items.length, 6, `${at}: 6 services`); assert.equal(s.faqs.length, 4, `${at}: 4 faqs`); assert.equal(s.testimonials.length, 3, `${at}: 3 testimonials`);
    assert.equal(s.hours.length, 7); assert.ok(s.gallery.length >= 4);
    assert.deepEqual(s.blocks.map((b) => b.key), c.extraBlocks, `${at}: extra blocks in the category's order`);
    for (const b of s.blocks) assert.ok(b.items.length >= 1 && b.title.length > 1, `${at}: block ${b.key}`);
    const sname = [s.site.name, s.site.tagline, s.hero.title, s.items[0].name].join(' ');
    if (lang === 'ta') { assert.match(sname, TAMIL, `${at}: Tamil text`); assert.match(s.about.text, TAMIL); assert.match(s.blocks[0].title, TAMIL, `${at}: Tamil block title`); }
    else assert.doesNotMatch(sname, TAMIL, `${at}: English text has no Tamil`);
  }
});

test('all sample content is invented: reserved .example domains, impossible phone numbers, a sample label', () => {
  for (const c of CATEGORIES) {
    const s = sampleContent(c.id);
    assert.match(s.contact.email, /@[a-z0-9-]+\.example$/);
    assert.match(s.contact.phone, /^\+91 00000 000\d\d$/);
    assert.equal(s.sample, true);
    for (const str of strings(s)) {
      for (const m of str.matchAll(/https?:\/\/([^/\s"']+)/g)) {
        assert.ok(/\.example$|^(www\.)?(google\.com|instagram\.com|facebook\.com|youtube-nocookie\.com)$|^wa\.me$|\.get4domain\.com$|^example\.com$/.test(m[1]), `${c.id}: unexpected host ${m[1]}`);
      }
    }
  }
});

test('ecommerce categories carry products, others do not', () => {
  for (const c of CATEGORIES) assert.equal(sampleContent(c.id).products.length > 0, c.track === 'ecommerce', c.id);
});

test('fixtures are deterministic', () => {
  assert.equal(JSON.stringify(allSamples()), JSON.stringify(allSamples()));
  assert.equal(JSON.stringify(allSamples({ lang: 'ta' })), JSON.stringify(allSamples({ lang: 'ta' })));
});

test('extreme fixtures exist and behave as named', () => {
  for (const c of CATEGORIES) for (const kind of EXTREME_KINDS) {
    const base = sampleContent(c.id);
    const x = extremeContent(c.id, kind);
    assert.notDeepEqual(x, base, `${c.id}/${kind} differs from the sample`);
  }
  const id = 'plumber';
  assert.ok(extremeContent(id, 'long-name').site.name.length > 120);
  assert.match(extremeContent(id, 'long-name').site.name, /[A-Za-z]{60,}/, 'contains an unbroken 60+ letter word');
  assert.ok(extremeContent(id, 'long-list').items.length >= 40 && extremeContent(id, 'long-list').faqs.length >= 30);
  const e = extremeContent(id, 'empty');
  assert.equal(e.contact.phone, ''); assert.equal(e.items.length, 0); assert.equal(e.gallery.length, 0); assert.equal(e.hero.image, '');
  const n = extremeContent(id, 'no-images');
  assert.equal(n.hero.image, ''); assert.ok(n.items.every((i) => i.image === ''));
  assert.ok(extremeContent(id, 'long-text').about.text.length > 4000);
  assert.throws(() => extremeContent(id, 'nope'), RangeError);
});

test('stretchContent makes readable text about 1.6x longer and leaves links alone', () => {
  const s = sampleContent('dentist', { lang: 'ta' });
  const t = stretchContent(s, 1.6);
  assert.ok(t.about.text.length > s.about.text.length * 1.4);
  assert.ok(t.hero.title.length > s.hero.title.length);
  assert.equal(t.contact.phoneHref, s.contact.phoneHref);
  assert.equal(t.hero.image, s.hero.image);
  assert.equal(t.contact.mapUrl, s.contact.mapUrl);
});

test('entitlement fixtures: all on, all off, and a realistic set per plan and track', () => {
  const keys = ['video', 'cart', 'booking', 'customDomain', 'callsToAction'];
  assert.deepEqual(Object.keys(ENTITLEMENTS_ON).sort(), [...keys].sort());
  assert.ok(keys.every((k) => ENTITLEMENTS_ON[k] === true));
  assert.ok(['video', 'cart', 'booking', 'customDomain'].every((k) => ENTITLEMENTS_OFF[k] === false && ENTITLEMENTS_LISTING[k] === false));
  assert.equal(ENTITLEMENTS_OFF.callsToAction, true, 'OFF is a Pro site without the optional extras');
  assert.equal(ENTITLEMENTS_LISTING.callsToAction, false, 'a Free listing has no call to action');
  assert.deepEqual(sampleEntitlements('plumber', { pro: false }), ENTITLEMENTS_LISTING);
  const pro = sampleEntitlements('plumber', { pro: true });
  assert.equal(pro.cart, false, 'cart is Ecommerce Pro only');
  assert.equal(pro.booking, true, 'booking is offered on Handyman and Professional');
  assert.equal(sampleEntitlements('jewellery', { pro: true }).cart, true);
  assert.equal(sampleEntitlements('jewellery', { pro: true }).booking, false, 'booking is not offered on Ecommerce');
  assert.throws(() => sampleEntitlements('nope'), RangeError);
});
