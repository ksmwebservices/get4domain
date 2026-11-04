import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../lib/render.mjs';
import { parse, findAll, byTag, textOf } from '../lib/html.mjs';
import { lintTheme } from '../lib/lint.mjs';
import { loadTheme, listVendorThemeIds } from '../lib/theme.mjs';
import { BINDINGS, IMAGE_BUDGET } from '../lib/vocabulary.mjs';
import { CATEGORIES } from '../lib/categories.mjs';
import { sampleContent, freeLimitContent, proMaxContent, ENTITLEMENTS_ON, ENTITLEMENTS_OFF } from '../fixtures/index.mjs';
import { minimalManifest } from './helpers/minimal-theme.mjs';

const THEMES = ['free-service-pro', 'free-practice', 'free-studio', 'free-hospitality', 'free-shop-lite'];
const imgs = (html) => byTag(parse(html), 'img');
const theme = (tpl) => ({ manifest: minimalManifest({ categories: ['plumber', 'jewellery'], families: ['home-services', 'fashion-lifestyle'], tracks: ['handyman', 'ecommerce'], layoutVariantRules: { 'home-services': 'bold-split', 'fashion-lifestyle': 'product-first' } }), templates: { home: tpl }, css: {} });
const render = (t, content, extra = {}) => renderPage({ theme: t, page: { slug: 'home' }, content, settings: {}, vendor: { id: 'v' }, host: { siteUrl: 'https://x.get4domain.com' }, ...extra, entitlements: { callsToAction: true, ...(extra.entitlements ?? {}) } });   // the share slot is a call to action: drawn only when callsToAction is on
const home = (id, content, ent) => renderPage({ theme: loadTheme(id), page: { slug: 'home' }, content, settings: {}, vendor: { id: 'v' }, host: { siteUrl: 'https://x.get4domain.com' }, entitlements: ent });

// ---------------------------------------------------------------- the budget and the two content sizes
test('the budget is 12 pictures on a Free home page and under 20 with the largest Pro content', () => {
  assert.deepEqual(IMAGE_BUDGET, { free: 12, pro: 19 });
});

test('fixtures: Free-limit content (8 services, 5 gallery images, 6 FAQs) and the largest Pro content, with a picture on everything', () => {
  for (const c of CATEGORIES) {
    const f = freeLimitContent(c.id);
    assert.deepEqual([f.items.length, f.gallery.length, f.faqs.length], [8, 5, 6], c.id);
    assert.ok(f.items.every((i) => i.image) && f.team.every((m) => m.image) && f.gallery.every((g) => g.src), `${c.id}: a picture on everything`);
    const p = proMaxContent(c.id);
    assert.ok(p.items.length >= 20 && p.gallery.length >= 12 && p.faqs.length >= 10 && p.team.length >= 6 && p.videos.length === 6, `${c.id} Pro max`);
    if (c.track === 'ecommerce') assert.ok(p.products.length >= 20, `${c.id} products`);
  }
});

// ---------------------------------------------------------------- loop helpers a template can use
test('every list entry knows its position, whether it is among the first three or the first eight, and its initial', () => {
  for (const b of ['item.featured', 'item.shown', 'member.initial', 'image.shown', 'image.featured']) {
    const [v] = b.split('.');
    assert.ok(Object.values({ items: 'item', team: 'member', gallery: 'image' }).includes(v));
  }
  const t = theme('<template data-g4d-each="items"><i class="x" data-n="{{item.n}}"><b data-g4d-if="item.featured">F</b><u data-g4d-if="item.shown">S</u></i></template><template data-g4d-each="team"><em class="m">{{member.initial}}</em></template>');
  const c = { ...sampleContent('plumber'), items: Array.from({ length: 10 }, (_, i) => ({ id: `i${i}`, name: `Item ${i}`, image: 'sample:item-1' })), team: [{ id: 'a', name: 'ravi k.' }, { id: 'b', name: 'பிரியா' }, { id: 'c', name: '' }] };
  const nodes = parse(render(t, c).html);
  const xs = findAll(nodes, (n) => n.attrs.class === 'x');
  assert.equal(xs.length, 10);
  assert.deepEqual(xs.map((x) => x.children.some((k) => k.tag === 'b')), [true, true, true, false, false, false, false, false, false, false], 'featured: first three');
  assert.deepEqual(xs.map((x) => x.children.some((k) => k.tag === 'u')), [true, true, true, true, true, true, true, true, false, false], 'shown: first eight');
  assert.deepEqual(findAll(nodes, (n) => n.attrs.class === 'm').map((m) => textOf([m])), ['R', 'ப', ''], 'initial: first letter, upper case');
  assert.ok(BINDINGS.length > 0);
});

// ---------------------------------------------------------------- slots keep their pictures under control
test('video: limit="3" shows three; the poster is a real picture with a meaningful alt, never decorative', () => {
  const t = theme('<g4d-video limit="3"></g4d-video>');
  const c = { ...sampleContent('plumber'), videos: Array.from({ length: 6 }, (_, i) => ({ title: `Video ${i + 1}`, url: `https://www.youtube-nocookie.com/watch?v=v${i}`, poster: `sample:video-${(i % 3) + 1}`, duration: '1:00' })) };
  const all = render(theme('<g4d-video></g4d-video>'), c, { entitlements: ENTITLEMENTS_ON });
  const three = render(t, c, { entitlements: ENTITLEMENTS_ON });
  assert.equal(imgs(all.html).length, 6);
  const posters = imgs(three.html);
  assert.equal(posters.length, 3);
  for (const p of posters) {
    assert.ok(p.attrs.alt && p.attrs.alt.length > 3 && !p.attrs.role, 'alt text, not role=presentation');
    assert.equal(p.attrs.loading, 'lazy');
    assert.ok(p.attrs.width && p.attrs.height);
  }
  assert.equal(findAll(parse(three.html), (n) => n.attrs.class === 'g4d-video').length, 3);
  assert.equal(imgs(render(theme('<g4d-video limit="99"></g4d-video>'), c, { entitlements: ENTITLEMENTS_ON }).html).length, 6, 'never more than six');
});

test('product-grid: images="3" gives only the first three products a picture, all lazy with a size', () => {
  const t = theme('<g4d-product-grid limit="12" images="3"></g4d-product-grid>');
  const many = { ...sampleContent('jewellery'), products: Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, price: '1', image: 'sample:item-1' })) };
  const html = render(t, many).html;
  assert.equal(findAll(parse(html), (n) => n.attrs.class === 'g4d-product').length, 12);
  const pics = imgs(html);
  assert.equal(pics.length, 3);
  assert.ok(pics.every((p) => p.attrs.loading === 'lazy' && p.attrs.width && p.attrs.height && p.attrs.alt));
  assert.equal(imgs(render(theme('<g4d-product-grid limit="12"></g4d-product-grid>'), many).html).length, 12, 'without images="N" every product has one');
});

test('the QR code is the only picture the share slot adds, and it is lazy with a size', () => {
  const pics = imgs(render(theme('<g4d-share-qr></g4d-share-qr>'), sampleContent('plumber')).html);
  assert.equal(pics.length, 1);
  assert.equal(pics[0].attrs.loading, 'lazy');
  assert.ok(pics[0].attrs.alt.length > 3 && pics[0].attrs.width && pics[0].attrs.height);
});

// ---------------------------------------------------------------- the five Standard themes
for (const id of THEMES) {
  test(`${id}: at most ${IMAGE_BUDGET.free} pictures on a Free home page and under 20 with the largest Pro content, in every one of its categories`, () => {
    const t = loadTheme(id);
    for (const cat of t.manifest.categories) {
      const free = imgs(home(id, freeLimitContent(cat), ENTITLEMENTS_OFF).html);
      assert.ok(free.length <= IMAGE_BUDGET.free, `${id}/${cat} Free: ${free.length} pictures`);
      const pro = imgs(home(id, proMaxContent(cat), ENTITLEMENTS_ON).html);
      assert.ok(pro.length <= IMAGE_BUDGET.pro, `${id}/${cat} Pro: ${pro.length} pictures`);
    }
  });

  test(`${id}: only the hero picture is eager; every other picture is lazy with a width and a height; nothing decorative is a picture`, () => {
    const t = loadTheme(id);
    for (const cat of [t.manifest.categories[0], t.manifest.categories.at(-1)]) {
      for (const [content, ent] of [[freeLimitContent(cat), ENTITLEMENTS_OFF], [proMaxContent(cat), ENTITLEMENTS_ON]]) {
        const nodes = parse(home(id, content, ent).html);
        const hero = findAll(nodes, (n) => n.attrs['data-g4d-section'] === 'hero')[0];
        const heroImgs = byTag(hero.children, 'img');
        assert.equal(heroImgs.length, 1, 'exactly one hero picture');
        assert.equal(heroImgs[0].attrs.fetchpriority, 'high');
        assert.notEqual(heroImgs[0].attrs.loading, 'lazy');
        for (const img of byTag(nodes, 'img')) {
          assert.ok(/^\d+$/.test(img.attrs.width ?? '') && /^\d+$/.test(img.attrs.height ?? ''), `${id}/${cat}: width and height`);
          assert.ok(img.attrs.alt && img.attrs.alt.length > 1, `${id}/${cat}: real alt text (decorative things are SVG or CSS)`);
          assert.ok(!img.attrs.role && img.attrs['aria-hidden'] !== 'true', `${id}/${cat}: not decorative`);
          if (!heroImgs.includes(img)) assert.equal(img.attrs.loading, 'lazy', `${id}/${cat}: ${img.attrs.alt} must be lazy`);
        }
      }
    }
  });

  test(`${id}: the gallery has one picture per photo; the lightbox is the same picture opened with :target`, () => {
    const t = loadTheme(id);
    const cat = t.manifest.categories[0];
    const nodes = parse(home(id, freeLimitContent(cat), ENTITLEMENTS_OFF).html);
    const gallery = findAll(nodes, (n) => n.attrs.id === 'gallery')[0];
    assert.equal(byTag(gallery.children, 'img').length, 5);
    const shots = findAll(gallery.children, (n) => /^photo-\d+$/.test(n.attrs.id ?? ''));
    assert.equal(shots.length, 5, 'each photo has its own target');
    for (const s of shots) { assert.equal(byTag(s.children, 'img').length, 1); assert.ok(findAll(s.children, (n) => n.tag === 'a' && n.attrs.href === '#gallery').length >= 1, 'a way to close it'); }
    const css = t.css.base;
    assert.match(css, /\.shot:target/);
    assert.doesNotMatch(css, /\.lightbox/);
  });
}

test('the Standard themes ship no decorative <img> in their templates at all', () => {
  for (const id of listVendorThemeIds()) {
    for (const [name, html] of Object.entries(loadTheme(id).templates)) {
      for (const img of byTag(parse(html), 'img')) assert.ok(img.attrs.alt && img.attrs.alt !== '' && !img.attrs.role, `${id}/${name}.html has a decorative picture`);
    }
  }
});

// ---------------------------------------------------------------- the lint rule
const starter = () => loadTheme('_starter');
const clone = (t, tpl) => ({ ...t, templates: { ...t.templates, home: tpl } });
const ruleFindings = (t, cats = ['plumber', 'jewellery']) => lintTheme(t, { categories: cats }).findings.filter((f) => f.rule === 'image-budget');
const EXTRA = (inner) => (t) => clone(t, t.templates.home.replace('</main>', `${inner}</main>`));

test('lint image-budget: the starter passes (it follows the same rules)', () => {
  assert.deepEqual(ruleFindings(starter()).map((f) => f.message), []);
});

test('lint image-budget: red fixtures', () => {
  const t = starter();
  const cases = {
    'too many pictures for a Free page': EXTRA('<ul><template data-g4d-each="items"><li><img src="{{item.image}}" alt="{{item.name}}" width="40" height="30" loading="lazy"></li></template></ul><ul><template data-g4d-each="gallery"><li><img src="{{image.src}}" alt="{{image.alt}}" width="40" height="30" loading="lazy"></li></template></ul>')(t),
    'too many pictures with the largest Pro content': EXTRA('<ul><template data-g4d-each="gallery"><li><img data-g4d-if="entitlements.video" src="{{image.src}}" alt="{{image.alt}}" width="40" height="30" loading="lazy"></li></template></ul><ul><template data-g4d-each="items"><li><img data-g4d-if="entitlements.video" src="{{item.image}}" alt="{{item.name}}" width="40" height="30" loading="lazy"></li></template></ul>')(t),
    'a picture below the first screen is not lazy': EXTRA('<img src="{{about.image}}" alt="{{about.imageAlt}}" width="40" height="30">')(t),
    'a decorative picture': EXTRA('<img src="{{about.image}}" alt="" role="presentation" width="40" height="30" loading="lazy">')(t),
    'a second eager hero picture': clone(t, t.templates.home.replace('</section>', '<img src="{{about.image}}" alt="{{about.imageAlt}}" width="40" height="30" fetchpriority="high"></section>')),
    'the hero picture is lazy': clone(t, t.templates.home.replace('fetchpriority="high"', 'loading="lazy"')),
  };
  for (const [name, theme_] of Object.entries(cases)) {
    const f = ruleFindings(theme_);
    assert.ok(f.length > 0, `${name}: expected an image-budget finding`);
    assert.ok(f.every((x) => x.level === 'error' && x.where.startsWith('render:home')), name);
  }
});

test('lint image-budget: the message says how many pictures and what to do', () => {
  const t = starter();
  const bad = EXTRA('<ul><template data-g4d-each="gallery"><li><img src="{{image.src}}" alt="{{image.alt}}" width="40" height="30" loading="lazy"></li></template></ul><ul><template data-g4d-each="items"><li><img src="{{item.image}}" alt="{{item.name}}" width="40" height="30" loading="lazy"></li></template></ul>')(t);
  const f = ruleFindings(bad)[0];
  assert.match(f.message, /\d+ pictures/);
  assert.match(f.message, /12|19/);
  assert.match(f.where, /Free limits|maximum Pro content/);
});
