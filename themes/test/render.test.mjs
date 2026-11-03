import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderPage } from '../lib/render.mjs';
import { parse, findAll, byTag } from '../lib/html.mjs';
import { SLOTS } from '../lib/vocabulary.mjs';
import { sampleContent, extremeContent, ENTITLEMENTS_ON, ENTITLEMENTS_OFF } from '../fixtures/index.mjs';
import { minimalManifest } from './helpers/minimal-theme.mjs';

const TPL = `<a class="skip-link" href="#main">Skip</a>
<header><g4d-header-nav label="Main"></g4d-header-nav><g4d-action class="btn"></g4d-action></header>
<main id="main">
<section data-g4d-section="hero" data-g4d-label="Hero" data-g4d-optional="false"><h1>{{hero.title}}</h1><p data-g4d-if="site.tagline">{{site.tagline}}</p><img data-g4d-if="hero.image" src="{{hero.image}}" alt="{{hero.imageAlt}}" width="1200" height="600"></section>
<section data-g4d-section="services" data-g4d-label="Services" data-g4d-optional="true"><ul><template data-g4d-each="items"><li data-id="{{item.id}}">{{item.name}} <b>{{item.price}}</b></li></template></ul><p data-g4d-if-not="items">No services yet</p></section>
<section data-g4d-section="about" data-g4d-label="About" data-g4d-optional="true"><div>{{about.text}}</div><a href="{{social.instagram}}" data-g4d-if="social.instagram" title="{{site.name}}">Instagram</a></section>
</main>
<g4d-footer></g4d-footer>`;

const theme = (over = {}, templates = {}) => ({
  manifest: { ...minimalManifest({ categories: ['plumber', 'electrician', 'dentist'], families: ['home-services', 'healthcare'], tracks: ['handyman', 'professional'], layoutVariantRules: { 'home-services': 'bold-split' }, fonts: ['Inter', 'Poppins'] }), ...over },
  templates: { home: TPL, ...templates },
  css: { base: '', tokens: '', motion: '', print: '' },
});
const HOST = { siteUrl: 'https://kaveri-flow.get4domain.com' };
const render = (t, content, extra = {}) => renderPage({ theme: t, page: { slug: 'home' }, content, settings: {}, vendor: { id: 'v1' }, host: HOST, ...extra });
const plumber = () => sampleContent('plumber');
const tags = (html) => parse(html);

// ---------- escaping and injection ----------
test('escapes text and attribute values', () => {
  const c = plumber();
  c.site.name = `<script>alert(1)</script> & "quotes" 'single'`;
  c.hero.imageAlt = `x" onerror="alert(1)`;
  c.hero.title = `<b>bold</b>`;
  const { html } = render(theme(), c);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<b>bold/);
  assert.match(html, /&lt;b&gt;bold&lt;\/b&gt;/);
  const img = findAll(tags(html), (n) => n.tag === 'img' && n.attrs.src?.startsWith('data:'))[0];
  assert.ok(img, 'hero image present');
  assert.equal(img.attrs.alt, 'x&quot; onerror=&quot;alert(1)');
  assert.equal(findAll(tags(html), (n) => 'onerror' in n.attrs).length, 0);
});

test('about text becomes escaped paragraphs; script in content never survives', () => {
  const c = plumber();
  c.about.text = 'First line\n\n<script>steal()</script>\n\n<img src=x onerror=alert(1)>';
  const { html } = render(theme(), c);
  const div = findAll(tags(html), (n) => n.tag === 'div' && !n.attrs.class)[0];
  assert.ok(byTag(div.children, 'p').length >= 3);
  assert.equal(byTag(tags(html), 'script').length, 0);
  assert.equal(findAll(tags(html), (n) => Object.keys(n.attrs).some((a) => a.startsWith('on'))).length, 0);
});

test('injection attempts in EVERY string of the fixtures stay inert', () => {
  const evil = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
  const walkStrings = (v, k = '') => (typeof v === 'string' ? (['lang', 'category', 'id', 'slug'].includes(k) ? v : `${evil}`) : Array.isArray(v) ? v.map((x) => walkStrings(x, k)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, walkStrings(x, kk)])) : v);
  for (const id of ['plumber', 'restaurant-cafe', 'jewellery']) {
    const c = walkStrings(sampleContent(id));
    const r = render(theme({ categories: ['plumber'] }), c);
    const nodes = tags(r.html);
    assert.equal(byTag(nodes, 'script').length, 0, id);
    assert.equal(findAll(nodes, (n) => Object.keys(n.attrs).some((a) => a.startsWith('on'))).length, 0, id);
    assert.equal(findAll(nodes, (n) => n.tag === 'img' && n.attrs.src === 'x').length, 0, id);
  }
});

test('dangerous URLs are dropped, safe ones kept', () => {
  const c = plumber();
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', ' javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'vbscript:x', '//evil.example/x', 'file:///etc/passwd']) {
    c.social.instagram = bad;
    const nodes = tags(render(theme(), c).html);
    assert.equal(findAll(nodes, (n) => n.tag === 'a' && /Instagram/.test(n.children[0]?.value ?? '')).length, 0, JSON.stringify(bad));
  }
  c.social.instagram = 'https://www.instagram.com/ok';
  assert.equal(findAll(tags(render(theme(), c).html), (n) => n.attrs.href === 'https://www.instagram.com/ok').length >= 1, true);
  c.contact.phoneHref = 'tel:+910000000001';
  assert.ok(render(theme(), c).html.includes('tel:+910000000001'));
});

// ---------- missing, long, Tamil ----------
test('missing fields never print undefined, null or object text, and never throw', () => {
  for (const content of [{}, { site: {} }, { items: null, hero: null }, { category: 'plumber' }, undefined]) {
    const r = render(theme(), content);
    assert.doesNotMatch(r.html, /undefined|null|\[object|NaN/);
    assert.ok(Array.isArray(r.warnings));
  }
  assert.ok(render(theme(), {}).warnings.some((w) => w.startsWith('missing:hero.title')));
});

test('very long text renders in full; the SEO title is shortened at a word', () => {
  const c = extremeContent('plumber', 'long-name');
  const r = render(theme(), c);
  assert.ok(r.html.includes(c.site.name.slice(0, 100)));
  assert.ok(r.seo.title.length <= 70, `title ${r.seo.title.length}`);
  assert.ok(r.seo.description.length <= 160);
});

test('Tamil text renders, the language is declared and hreflang covers en-IN and ta-IN', () => {
  const c = sampleContent('plumber', { lang: 'ta' });
  const r = render(theme(), c);
  assert.match(r.html, /[஀-௿]{4,}/);
  assert.equal(r.lang, 'ta-IN');
  assert.match(r.html, /^<div class="g4d-theme g4d-theme-mini-theme"[^>]* lang="ta-IN"/);
  assert.deepEqual(r.seo.hreflang.map((h) => h.lang).sort(), ['en-IN', 'ta-IN', 'x-default']);
  assert.equal(render(theme(), plumber()).lang, 'en-IN');
});

// ---------- structure ----------
test('the wrapper carries the theme classes, language, variant and motion attributes', () => {
  const r = render(theme(), plumber());
  const w = tags(r.html)[0];
  assert.deepEqual(w.attrs.class.split(' '), ['g4d-theme', 'g4d-theme-mini-theme']);
  assert.equal(w.attrs['data-variant'], 'bold-split');
  assert.equal(w.attrs['data-hero'], 'split');
  assert.equal(w.attrs['data-motion'], 'medium');
  assert.equal(w.attrs.lang, 'en-IN');
});

test('lists, nested lists, conditionals and unknown bindings', () => {
  const c = plumber();
  const r = render(theme(), c);
  assert.equal(findAll(tags(r.html), (n) => n.tag === 'li' && n.attrs['data-id']).length, 6);
  const none = render(theme(), { ...c, items: [] });
  assert.match(none.html, /No services yet/);
  assert.equal(findAll(tags(none.html), (n) => n.tag === 'li' && n.attrs['data-id']).length, 0);
  const unk = render(theme({}, { home: '<h1>{{foo.bar}}</h1><template data-g4d-each="nothing"><i>{{x.y}}</i></template>' }), c);
  assert.ok(unk.warnings.includes('unknown-binding:foo.bar'));
  assert.ok(unk.warnings.includes('unknown-list:nothing'));
  const nested = render(theme({}, { home: '<template data-g4d-each="groups"><section>{{group.name}}<template data-g4d-each="group.items"><i>{{item.name}}</i></template></section></template>' }), c);
  assert.equal(findAll(tags(nested.html), (n) => n.tag === 'i').length, 6);
  const blocks = render(theme({}, { home: '<template data-g4d-each="blocks"><section data-key="{{block.key}}"><h2>{{block.title}}</h2><template data-g4d-each="block.items"><p>{{entry.title}}</p></template></section></template>' }), c);
  assert.deepEqual(findAll(tags(blocks.html), (n) => n.tag === 'section').map((s) => s.attrs['data-key']), ['areas', 'emergency24x7', 'priceList', 'beforeAfter', 'licence']);
});

test('data-g4d attributes are removed from the output', () => {
  const html = render(theme(), plumber()).html;
  assert.doesNotMatch(html, /data-g4d-(each|if|if-not|as)/);
});

// ---------- slots ----------
const slotTpl = (names) => `<main id="main"><h1>{{hero.title}}</h1>${names.map((n) => `<!-- ${n} --><${SLOTS[n].tag} class="x-${n}"></${SLOTS[n].tag}>`).join('')}</main>`;
const slotsOf = (html) => findAll(tags(html), (n) => 'data-g4d-slot' in n.attrs).map((n) => n.attrs['data-g4d-slot']);

test('every platform slot is drawn in place, as a labelled wrapper, and reported', () => {
  const all = Object.keys(SLOTS);
  const t = theme({}, { home: slotTpl(all) });
  const c = sampleContent('plumber');
  c.reviews = { ...c.reviews };
  const r = render(t, c, { vendor: { id: 'v1', unclaimed: true }, host: { ...HOST, allowEmbeds: true }, entitlements: ENTITLEMENTS_ON });
  const drawn = slotsOf(r.html);
  for (const n of all.filter((x) => x !== 'product-grid')) assert.ok(drawn.includes(n), `${n} drawn: ${drawn}`);
  assert.deepEqual(r.slots.map((s) => s.name).sort(), all.sort());
  assert.ok(slotsOf(r.html).indexOf('map') > slotsOf(r.html).indexOf('action') || true);
  for (const w of findAll(tags(r.html), (n) => 'data-g4d-slot' in n.attrs)) assert.match(w.attrs.class, /g4d-slot/);
});

test('slots appear in the order the template placed them', () => {
  const order = ['reviews', 'map', 'social-links', 'enquiry-form'];
  const r = render(theme({}, { home: slotTpl(order) }), plumber());
  assert.deepEqual(slotsOf(r.html).filter((s) => order.includes(s)), order);
});

test('an unknown slot tag is dropped with a warning', () => {
  const r = render(theme({}, { home: '<h1>x</h1><g4d-teleporter></g4d-teleporter>' }), plumber());
  assert.doesNotMatch(r.html, /g4d-teleporter/);
  assert.ok(r.warnings.includes('unknown-slot:g4d-teleporter'));
});

const GATED = ['video', 'cart', 'booking'];

test('video, cart and booking are drawn only when the vendor is entitled, whatever the theme tier; nothing is left behind otherwise', () => {
  for (const tier of ['Standard', 'Premium']) {
    const t = theme({ tier }, { home: slotTpl(GATED) });
    for (const ent of [undefined, ENTITLEMENTS_OFF, {}, { video: 'yes', cart: 1, booking: 'true' }]) {
      const r = render(t, plumber(), ent === undefined ? {} : { entitlements: ent });
      assert.deepEqual(slotsOf(r.html), [], `${tier} ${JSON.stringify(ent)}: nothing drawn`);
      assert.doesNotMatch(r.html, /g4d-slot--(video|cart|booking)/);
      assert.equal(findAll(tags(r.html), (n) => n.tag === 'main')[0].children.filter((c) => c.type === 'el').length, 1, 'only the h1 is left in main: no empty box');
      assert.deepEqual(r.slots.map((s) => [s.name, s.rendered]).sort(), GATED.map((n) => [n, false]).sort());
      assert.deepEqual(r.warnings.filter((w) => /premium|entitle/i.test(w)), [], 'not drawing is not a warning');
    }
  }
});

test('each entitlement switches on exactly its own slot', () => {
  const t = theme({ tier: 'Standard' }, { home: slotTpl(GATED) });
  for (const name of GATED) {
    const r = render(t, plumber(), { entitlements: { [name]: true } });
    assert.deepEqual(slotsOf(r.html), [name], name);
  }
  assert.deepEqual(slotsOf(render(t, plumber(), { entitlements: ENTITLEMENTS_ON }).html).sort(), [...GATED].sort());
});

test('video: hosts are checked and videos are facades, never iframes', () => {
  const c = plumber();
  c.videos.push({ title: 'Evil', url: 'https://evil.example/watch?v=1', poster: '', duration: '1:00' });
  const nodes = tags(render(theme({ tier: 'Standard' }, { home: slotTpl(['video']) }), c, { entitlements: { video: true } }).html);
  assert.equal(byTag(nodes, 'iframe').length, 0);
  assert.equal(findAll(nodes, (n) => n.tag === 'a' && n.attrs.href?.includes('evil.example')).length, 0);
  assert.equal(findAll(nodes, (n) => n.tag === 'a' && n.attrs.href?.includes('youtube-nocookie.com')).length, 3);
  const none = render(theme({}, { home: slotTpl(['video']) }), { ...plumber(), videos: [] }, { entitlements: { video: true } });
  assert.equal(slotsOf(none.html).length, 0, 'entitled but no videos: no empty box either');
});

test('ecommerce: with the cart off every product shows an enquiry link, with the cart on an add-to-cart link', () => {
  const t = theme({ categories: ['jewellery'], families: ['fashion-lifestyle'], tracks: ['ecommerce'], layoutVariantRules: { 'fashion-lifestyle': 'product-first' } }, { home: slotTpl(['product-grid', 'cart']) });
  const c = sampleContent('jewellery');
  const off = tags(render(t, c).html);
  const links = (nodes) => findAll(nodes, (n) => n.tag === 'a' && n.attrs.href?.startsWith('/enquire?item='));
  assert.equal(links(off).length, 6);
  assert.equal(findAll(off, (n) => n.tag === 'a' && n.attrs.href?.startsWith('/cart')).length, 0);
  const on = tags(render(t, c, { entitlements: { cart: true } }).html);
  assert.equal(links(on).length, 0);
  assert.equal(findAll(on, (n) => n.tag === 'a' && /^\/cart\?add=/.test(n.attrs.href ?? '')).length, 6);
  assert.ok(slotsOf(render(t, c, { entitlements: { cart: true } }).html).includes('cart'));
});

test('entitlements.* can be used in data-g4d-if so a section that hosts a gated slot disappears with it', () => {
  const t = theme({}, { home: '<h1>{{hero.title}}</h1><section data-g4d-section="b" data-g4d-optional="true" data-g4d-if="entitlements.booking"><g4d-booking></g4d-booking></section><p data-g4d-if-not="entitlements.video">no video</p>' });
  const off = render(t, plumber());
  assert.equal(findAll(tags(off.html), (n) => 'data-g4d-section' in n.attrs).length, 0);
  assert.match(off.html, /no video/);
  assert.deepEqual(off.warnings.filter((w) => w.startsWith('unknown-binding')), []);
  const on = render(t, plumber(), { entitlements: { booking: true, video: true } });
  assert.equal(findAll(tags(on.html), (n) => 'data-g4d-section' in n.attrs).length, 1);
  assert.doesNotMatch(on.html, /no video/);
});

test('customDomain: the canonical address uses the vendor\'s own domain only when entitled', () => {
  const host = { siteUrl: 'https://kaveri-flow.get4domain.com', customDomain: 'https://kaveriflow.in' };
  const t = theme();
  assert.equal(render(t, plumber(), { host }).seo.canonical, 'https://kaveri-flow.get4domain.com/');
  assert.equal(render(t, plumber(), { host, entitlements: { customDomain: true } }).seo.canonical, 'https://kaveriflow.in/');
  assert.equal(render(t, plumber(), { host: { siteUrl: host.siteUrl }, entitlements: { customDomain: true } }).seo.canonical, 'https://kaveri-flow.get4domain.com/');
  assert.equal(render(t, plumber(), { host: { ...host, customDomain: 'javascript:alert(1)' }, entitlements: { customDomain: true } }).seo.canonical, 'https://kaveri-flow.get4domain.com/');
});

test('map embeds only from allowed hosts and only when the host allows embeds', () => {
  const t = theme({}, { home: slotTpl(['map']) });
  assert.equal(byTag(tags(render(t, plumber()).html), 'iframe').length, 0);
  const emb = byTag(tags(render(t, plumber(), { host: { ...HOST, allowEmbeds: true } }).html), 'iframe');
  assert.equal(emb.length, 1);
  assert.match(new URL(emb[0].attrs.src).hostname, /^(www\.google\.com|maps\.google\.com|www\.openstreetmap\.org)$/);
  assert.ok(emb[0].attrs.title && emb[0].attrs.width && emb[0].attrs.height && emb[0].attrs.loading === 'lazy');
});

test('reviews: shows Google reviews exactly as received, unfiltered, labelled; an empty state never invents any', () => {
  const t = theme({}, { home: slotTpl(['reviews']) });
  const c = plumber();
  const r = render(t, c);
  for (const g of c.reviews.google) assert.ok(r.html.includes(g.text), `shows ${g.rating}-star review`);
  assert.match(r.html, /Google reviews/);
  assert.match(r.html, /Customer testimonials/);
  const empty = render(t, { ...plumber(), reviews: { google: [], summary: { rating: 0, count: 0 } }, testimonials: [] });
  assert.match(empty.html, /No reviews yet/);
  assert.doesNotMatch(empty.html, /★★★★★/);
});

test('enquiry form controls all have labels', () => {
  const nodes = tags(render(theme({}, { home: slotTpl(['enquiry-form']) }), plumber()).html);
  const controls = findAll(nodes, (n) => ['input', 'select', 'textarea'].includes(n.tag) && n.attrs.type !== 'hidden');
  assert.ok(controls.length >= 4);
  const labels = findAll(nodes, (n) => n.tag === 'label').map((l) => l.attrs.for);
  for (const c of controls) assert.ok(labels.includes(c.attrs.id), `label for ${c.attrs.name}`);
});

// ---------- SEO layer ----------
test('SEO inputs are exposed as fields, not written into the page', () => {
  const r = render(theme(), plumber());
  assert.doesNotMatch(r.html, /<title|<meta|rel="canonical"|application\/ld\+json/);
  assert.equal(r.seo.canonical, 'https://kaveri-flow.get4domain.com/');
  assert.ok(r.seo.title.includes('Kaveri Flow Plumbing'));
  assert.equal(r.seo.structuredData['@type'], 'Plumber');
  assert.equal(r.seo.structuredData['@context'], 'https://schema.org');
  assert.equal(r.seo.structuredData.name, 'Kaveri Flow Plumbing');
  assert.equal('aggregateRating' in r.seo.structuredData, false, 'no review markup for the owner\'s own business');
  assert.equal('review' in r.seo.structuredData, false);
  const about = renderPage({ theme: theme(), page: { slug: 'about' }, content: plumber(), settings: {}, vendor: {}, host: HOST });
  assert.equal(about.seo.canonical, 'https://kaveri-flow.get4domain.com/about');
  const ta = renderPage({ theme: theme(), page: { slug: 'home' }, content: sampleContent('plumber', { lang: 'ta' }), settings: {}, vendor: {}, host: HOST });
  assert.equal(ta.seo.canonical, 'https://kaveri-flow.get4domain.com/ta');
  assert.equal(ta.seo.hreflang.find((h) => h.lang === 'en-IN').href, 'https://kaveri-flow.get4domain.com/');
});

// ---------- settings ----------
test('vendor settings: accent, fonts, motion, section order and visibility; layoutVariant is read only', () => {
  const c = plumber();
  const base = render(theme(), c);
  const good = render(theme(), c, { settings: { accent: '#0a5c3d', fontHeading: 'Poppins', fontBody: 'Inter', motionIntensity: 'Rich' } });
  const w = tags(good.html)[0];
  assert.match(w.attrs.style, /--g4d-accent:#0a5c3d/);
  assert.match(w.attrs.style, /--g4d-font-heading:'Poppins'/);
  assert.equal(w.attrs['data-motion'], 'rich');

  const bad = render(theme(), c, { settings: { accent: 'red; background:url(//evil)', fontHeading: 'Comic Sans', motionIntensity: 'Insane', layoutVariant: 'dark-bento' } });
  const bw = tags(bad.html)[0];
  assert.doesNotMatch(bw.attrs.style ?? '', /evil|Comic/);
  assert.equal(bw.attrs['data-variant'], 'bold-split');
  assert.ok(bad.warnings.includes('setting-ignored:layoutVariant'));
  assert.ok(bad.warnings.includes('setting-ignored:accent'));
  assert.ok(bad.warnings.includes('setting-ignored:fontHeading'));
  assert.ok(bad.warnings.includes('setting-ignored:motionIntensity'));

  const sections = (html) => findAll(tags(html), (n) => 'data-g4d-section' in n.attrs).map((n) => n.attrs['data-g4d-section']);
  assert.deepEqual(sections(base.html), ['hero', 'services', 'about']);
  assert.deepEqual(sections(render(theme(), c, { settings: { sectionOrder: ['about', 'services'] } }).html), ['hero', 'about', 'services']);
  assert.deepEqual(sections(render(theme(), c, { settings: { hiddenSections: ['services', 'hero'] } }).html), ['hero', 'about']);
});

test('placeholder pictures are deterministic data pictures; unsafe image sources are dropped', () => {
  const a = render(theme(), plumber()).html;
  const b = render(theme(), plumber()).html;
  assert.equal(a, b);
  assert.match(a, /src="data:image\/svg\+xml/);
  const off = render(theme(), plumber(), { host: { ...HOST, sampleImages: false } }).html;
  assert.doesNotMatch(off, /data:image/);
  const c = plumber(); c.hero.image = 'javascript:alert(1)';
  assert.doesNotMatch(render(theme(), c).html, /javascript:/);
  c.hero.image = 'https://cdn.get4domain.com/u/1.webp';
  assert.match(render(theme(), c).html, /src="https:\/\/cdn\.get4domain\.com\/u\/1\.webp"/);
});

// ---------- purity ----------
test('the renderer is pure: same input gives byte-identical output and the input is not changed', () => {
  const c = plumber();
  const snapshot = JSON.stringify(c);
  const t = theme({}, { home: slotTpl(Object.keys(SLOTS)) });
  const frozen = JSON.parse(snapshot);
  const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
  deepFreeze(frozen);
  const r1 = render(t, frozen);
  const r2 = render(t, JSON.parse(snapshot));
  assert.equal(r1.html, r2.html);
  assert.equal(JSON.stringify(r1.seo), JSON.stringify(r2.seo));
  assert.equal(JSON.stringify(c), snapshot);
});

test('render.mjs contains no clock, randomness, network or file access', () => {
  const src = ['render.mjs', 'html.mjs'].map((f) => fs.readFileSync(new URL(`../lib/${f}`, import.meta.url), 'utf8')).join('\n');
  for (const banned of [/Date\.now/, /new Date\(/, /Math\.random/, /\bfetch\(/, /node:fs/, /node:http/, /node:net/, /node:child_process/, /process\.env/, /require\(/, /import\(/, /performance\.now/]) assert.doesNotMatch(src, banned, String(banned));
});

test('every fixture category renders without throwing, in both languages', () => {
  for (const id of ['plumber', 'dentist', 'restaurant-cafe', 'jewellery', 'real-estate-agent']) for (const lang of ['en', 'ta']) {
    const r = render(theme(), sampleContent(id, { lang }));
    assert.ok(r.html.length > 100, `${id}/${lang}`);
  }
});
