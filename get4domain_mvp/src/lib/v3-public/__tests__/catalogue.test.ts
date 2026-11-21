import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { brandedTitle } from '../../metadata';
import { CATALOGUE, categoriesOfPack, categoryById, categoryPage, categoryPath, preselectableCategory, publishedCategories } from '../catalogue';
import { decideHost } from '../host-routing';
import { PACK_SLUGS, REGULATED_PACKS } from '../industries';
import { MARKETING } from '../marketing-strings';
import { PACKS } from '../packs';
import { siteSitemapEntries } from '../sitemap-paths';

const OFF = {};
const ON = { V3_REGULATED_PACKS_PUBLIC: 'true' };
const cfg = { main: 'main.example.invalid', directory: 'directory.main.example.invalid', app: null, admin: null, api: null, media: null };
const decide = (pathname: string, env: Record<string, string | undefined> = OFF) => decideHost({ host: 'main.example.invalid', pathname }, cfg, { V3_PUBLIC_ENABLED: 'true', ...env });
const fill = (t: string, v: Record<string, string>): string => t.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');

describe('the catalogue', () => {
  test('196 categories with unique, well-formed ids, names and known packs', () => {
    assert.equal(CATALOGUE.length, 196);
    assert.equal(new Set(CATALOGUE.map((c) => c.id)).size, 196);
    const packs = new Set(PACKS.map((p) => p.key));
    for (const c of CATALOGUE) {
      assert.match(c.id, /^[a-z0-9][a-z0-9-]{1,80}$/, c.id);
      assert.ok(c.name.length >= 3 && c.name.length <= 80, c.id);
      assert.ok(packs.has(c.packKey), `${c.id} -> ${c.packKey}`);
      assert.ok(c.family.length > 0, c.id);
    }
  });
  test('every pack has at least one category', () => {
    for (const p of PACKS) assert.ok(categoriesOfPack(p.key).length >= 1, p.key);
  });
  test('lookups', () => {
    assert.equal(categoryById('restaurant-cafe')?.packKey, 'FOOD_SERVICE');
    assert.equal(categoryById('nothing'), null);
    assert.equal(categoryPath(categoryById('restaurant-cafe')!), '/industries/food-service/restaurant-cafe');
  });
  test('no catalogue text breaks the copy rules', () => {
    const bad = /\b(workspace|bos|leadspace|leads?|best|top|leading|guaranteed?|discounts?|offers?|deals?|coupons?|reviews?|sale|bundle)\b|[₹%]/i;
    const hits = CATALOGUE.filter((c) => bad.test(c.name) || bad.test(c.family)).map((c) => `${c.id}: ${c.name} / ${c.family}`);
    assert.deepEqual(hits, []);
  });
});

describe('which category pages exist', () => {
  test('the regulated four packs have no category page by default and have them when published', () => {
    const regulated = CATALOGUE.filter((c) => REGULATED_PACKS.has(c.packKey));
    assert.ok(regulated.length > 0);
    for (const c of regulated) {
      assert.equal(categoryPage(PACK_SLUGS[c.packKey], c.id, OFF), null, c.id);
      assert.equal(categoryPage(PACK_SLUGS[c.packKey], c.id, ON)?.category.id, c.id, c.id);
    }
  });
  test('published categories are every category of a published pack; all 196 with the flag on', () => {
    assert.equal(publishedCategories(ON).length, 196);
    assert.equal(publishedCategories(OFF).length, CATALOGUE.filter((c) => !REGULATED_PACKS.has(c.packKey)).length);
  });
  test('the pack in the address must be the pack of the category; an unknown id has no page', () => {
    assert.equal(categoryPage('retail-and-ecommerce', 'restaurant-cafe', OFF), null);
    assert.equal(categoryPage('food-service', 'restaurant-cafe', OFF)?.industry.pack.key, 'FOOD_SERVICE');
    assert.equal(categoryPage('food-service', 'nothing', OFF), null);
    assert.equal(categoryPage('nothing', 'restaurant-cafe', OFF), null);
  });
  test('only a published, known category can be preselected on the register page', () => {
    assert.equal(preselectableCategory('restaurant-cafe', OFF)?.id, 'restaurant-cafe');
    assert.equal(preselectableCategory('nothing', OFF), null);
    assert.equal(preselectableCategory('', OFF), null);
    const reg = CATALOGUE.find((c) => REGULATED_PACKS.has(c.packKey))!;
    assert.equal(preselectableCategory(reg.id, OFF), null);
    assert.equal(preselectableCategory(reg.id, ON)?.id, reg.id);
  });
});

describe('host routing of the category pages', () => {
  test('a published category is rewritten to its internal page, anything else is a real 404', () => {
    assert.deepEqual(decide('/industries/food-service/restaurant-cafe'), { action: 'rewrite', pathname: '/v3-site/industries/food-service/restaurant-cafe' });
    assert.deepEqual(decide('/industries/food-service/restaurant-cafe/'), { action: 'rewrite', pathname: '/v3-site/industries/food-service/restaurant-cafe' });
    for (const p of ['/industries/food-service/nothing', '/industries/retail-and-ecommerce/restaurant-cafe', '/industries/travel/agency', '/industries/nothing/restaurant-cafe']) assert.deepEqual(decide(p), { action: 'not-found', host: 'main' }, p);
  });
  test('a regulated category is a real 404 by default and a page when published', () => {
    const c = CATALOGUE.find((x) => REGULATED_PACKS.has(x.packKey))!;
    const p = categoryPath(c);
    assert.deepEqual(decide(p, OFF), { action: 'not-found', host: 'main' });
    assert.deepEqual(decide(p, ON), { action: 'rewrite', pathname: `/v3-site${p}` });
  });
  test('every published category has a rewrite and the sitemap lists each once', () => {
    for (const { category } of publishedCategories(OFF)) assert.equal(decide(categoryPath(category))?.action, 'rewrite', category.id);
    const paths = siteSitemapEntries({ V3_PUBLIC_ENABLED: 'true' }).map((e) => e.path);
    assert.equal(new Set(paths).size, paths.length);
    for (const { category } of publishedCategories(OFF)) assert.ok(paths.includes(categoryPath(category)), category.id);
    assert.ok(!paths.some((p) => /clinic-and-patient-care\//.test(p)), 'no regulated category in the default sitemap');
    assert.ok(siteSitemapEntries(ON).map((e) => e.path).some((p) => /clinic-and-patient-care\//.test(p)));
  });
});

describe('category page copy', () => {
  test('the title with the brand is at most 60 characters and the description a sensible length for every category', () => {
    for (const c of CATALOGUE) {
      const title = `${c.name} website`;
      assert.ok(brandedTitle(title).length <= 60, `${c.id} ${brandedTitle(title).length}`);
      const d = fill(MARKETING.categoryPage.metaDescription, { name: c.name });
      assert.ok(d.length >= 60 && d.length <= 170, `${c.id} ${d.length}`);
    }
  });
  test('the filled templates keep the copy rules for every category', () => {
    const bad = /\b(workspace|bos|leadspace|leads?|best|top|leading|guaranteed?|discounts?|offers?|deals?|coupons?|reviews?|sale|bundle)\b|[₹%]|\b\d+\s*(?:days?|months?|hours?)\b/i;
    const C = MARKETING.categoryPage;
    for (const c of CATALOGUE) {
      const pack = PACKS.find((p) => p.key === c.packKey)!;
      const v = { name: c.name, pack: pack.name, family: c.family, gives: pack.gives.join(', ').toLowerCase() };
      const texts = [C.metaDescription, C.lead, C.groupLine, C.givesIntro, C.moreHeading, C.packLink, ...C.steps.map((s) => s.body), ...C.faq.flatMap((f) => [f.q, f.a])].map((t) => fill(t, v));
      for (const t of texts) assert.ok(!bad.test(t), `${c.id}: ${t}`);
      for (const t of texts) assert.ok(!/\{\w+\}/.test(t), `unfilled placeholder in ${c.id}: ${t}`);
    }
  });
});
