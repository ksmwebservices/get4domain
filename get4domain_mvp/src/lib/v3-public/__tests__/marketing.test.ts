import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { brandedTitle } from '../../metadata';
import { decideHost } from '../host-routing';
import { GUIDE_SLUGS, MARKETING_FIXED_PATHS, marketingRoute, PRODUCT_SLUGS } from '../site-routes';
import { MARKETING } from '../marketing-strings';
import { siteSitemapEntries } from '../sitemap-paths';
import { breadcrumbLd, faqLd } from '../site-jsonld';

const HOSTS = { MAIN_HOST: 'main.example.invalid', DIRECTORY_HOST: 'directory.main.example.invalid' };
const ENV = { V3_PUBLIC_ENABLED: 'true', ...HOSTS };
const cfg = { main: 'main.example.invalid', directory: 'directory.main.example.invalid', app: null, admin: null, api: null, media: null };
const decide = (pathname: string, host = 'main.example.invalid', env: Record<string, string | undefined> = ENV) => decideHost({ host, pathname }, cfg, env);

describe('marketing page data', () => {
  test('eight product pages with the decided slugs, five guides', () => {
    assert.deepEqual([...PRODUCT_SLUGS], ['website', 'search-visibility', 'enquiries', 'directory', 'reports', 'ai-studio', 'domains', 'business-tools']);
    assert.deepEqual(MARKETING.product.pages.map((p) => p.slug), [...PRODUCT_SLUGS]);
    assert.deepEqual(MARKETING.guides.pages.map((p) => p.slug), [...GUIDE_SLUGS]);
    assert.equal(GUIDE_SLUGS.length, 5);
  });
  test('every product page has content, an FAQ and related pages that exist', () => {
    for (const p of MARKETING.product.pages) {
      assert.ok(p.gives.length >= 3 && p.steps.length === 3 && p.faq.length >= 2 && p.plan.length > 20, p.slug);
      for (const r of p.related) assert.ok(PRODUCT_SLUGS.includes(r), `${p.slug} -> ${r}`);
      assert.ok(!p.related.includes(p.slug), p.slug);
    }
  });
  test('guide cross links point at guides that exist', () => {
    for (const g of MARKETING.guides.pages) { assert.ok(g.sections.length >= 3, g.slug); for (const l of g.links) assert.ok(GUIDE_SLUGS.includes(l), `${g.slug} -> ${l}`); }
  });
  test('titles with the brand are at most 60 characters; descriptions are a sensible length', () => {
    const items: Array<[string, string, string]> = [
      ['product', MARKETING.product.metaTitle, MARKETING.product.metaDescription],
      ['partners', MARKETING.partners.metaTitle, MARKETING.partners.metaDescription],
      ['guides', MARKETING.guides.metaTitle, MARKETING.guides.metaDescription],
      ...MARKETING.product.pages.map((p): [string, string, string] => [p.slug, p.metaTitle, p.metaDescription]),
      ...MARKETING.guides.pages.map((g): [string, string, string] => [g.slug, g.title, g.metaDescription]),
    ];
    for (const [name, title, desc] of items) {
      assert.ok(brandedTitle(title).length <= 60, `${name} title ${brandedTitle(title).length}`);
      assert.ok(desc.length >= 60 && desc.length <= 170, `${name} description ${desc.length}`);
    }
  });
  test('an FAQ becomes FAQPage JSON-LD and breadcrumbs become BreadcrumbList without a price or rating', () => {
    const ld = faqLd(MARKETING.product.pages[0].faq);
    assert.equal(ld['@type'], 'FAQPage');
    assert.ok(!/price|Offer|rating|review/i.test(JSON.stringify(ld)));
    const b = breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Product', path: '/product' }]);
    assert.equal(b === null || b['@type'] === 'BreadcrumbList', true);
  });
  test('the partner page writes no rate, slab or amount', () => {
    const text = JSON.stringify(MARKETING.partners).replace(/Get4Domain|"h1"/g, '');
    assert.ok(!/\d|%|₹/.test(text));
  });
});

describe('marketing routes', () => {
  test('which family an address belongs to', () => {
    assert.deepEqual(marketingRoute('/product'), { kind: 'fixed', path: '/product' });
    assert.deepEqual(marketingRoute('/guides/'), { kind: 'fixed', path: '/guides' });
    assert.deepEqual(marketingRoute('/product/website'), { kind: 'product', slug: 'website' });
    assert.deepEqual(marketingRoute('/guides/choosing-your-site-address'), { kind: 'guide', slug: 'choosing-your-site-address' });
    assert.deepEqual(marketingRoute('/industries/food-service/restaurant'), { kind: 'category', pack: 'food-service', id: 'restaurant' });
    for (const p of ['/', '/pricing', '/industries', '/industries/food-service', '/product/a/b', '/products', '/guide']) assert.equal(marketingRoute(p), null, p);
    assert.deepEqual([...MARKETING_FIXED_PATHS], ['/product', '/growth', '/partners', '/guides']);
  });
  test('on the main host a known page is rewritten to its internal page, an unknown slug is a real 404', () => {
    assert.deepEqual(decide('/product'), { action: 'rewrite', pathname: '/v3-site/product' });
    assert.deepEqual(decide('/partners'), { action: 'rewrite', pathname: '/v3-site/partners' });
    assert.deepEqual(decide('/guides'), { action: 'rewrite', pathname: '/v3-site/guides' });
    for (const s of PRODUCT_SLUGS) assert.deepEqual(decide(`/product/${s}`), { action: 'rewrite', pathname: `/v3-site/product/${s}` });
    for (const s of GUIDE_SLUGS) assert.deepEqual(decide(`/guides/${s}`), { action: 'rewrite', pathname: `/v3-site/guides/${s}` });
    assert.deepEqual(decide('/product/nothing'), { action: 'not-found', host: 'main' });
    assert.deepEqual(decide('/guides/nothing'), { action: 'not-found', host: 'main' });
    assert.deepEqual(decide('/Product/Website'), { action: 'pass', host: 'main' });
  });
  test('with the flag off nothing is routed', () => {
    assert.equal(decide('/product', 'main.example.invalid', { ...HOSTS }), null);
  });
  test('the directory host never serves the marketing pages', () => {
    for (const p of ['/product', '/product/website', '/guides', '/partners']) assert.notEqual(decide(p, 'directory.main.example.invalid')?.action, 'rewrite', p);
  });
  test('the sitemap lists the marketing pages once each', () => {
    const paths = siteSitemapEntries(ENV).map((e) => e.path);
    assert.equal(new Set(paths).size, paths.length);
    for (const p of ['/product', '/partners', '/guides', '/product/website', '/guides/from-free-to-paid-plan', '/industries/food-service', '/terms']) assert.ok(paths.includes(p), p);
  });
});
