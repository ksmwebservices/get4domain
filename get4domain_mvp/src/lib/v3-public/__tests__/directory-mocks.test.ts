import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { looksLikeBusinessId, parseVisitUrl } from '../click';
import { modelToMetadata } from '../metadata';
import { MOCK_BUSINESS_IDS, MOCK_ORIGIN, mockPage } from '../mocks';
import type { PageModel } from '../types';

/** Every page of the fixture directory reachable from its home by the links the pages themselves carry. */
function reachable(): Map<string, PageModel> {
  const seen = new Map<string, PageModel>();
  const queue = ['/'];
  while (queue.length) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    const r = mockPage(path);
    assert.equal(r.kind, 'ok', `a link leads to ${path}, which the fixtures do not have (${r.kind})`);
    if (r.kind !== 'ok') continue;
    seen.set(path, r.model);
    const m = r.model;
    const out = [
      ...m.facets.flatMap((f) => f.items.map((i) => i.path)), ...m.cards.map((c) => c.profilePath), ...m.breadcrumbs.map((c) => c.path),
      ...m.related.nearbyLocalities.map((i) => i.path), ...m.related.relatedCategories.map((i) => i.path), ...m.related.parents.map((i) => i.path),
      ...(m.page?.nextPath ? [m.page.nextPath] : []), ...(m.page?.prevPath ? [m.page.prevPath] : []),
    ];
    for (const p of out) if (!seen.has(p)) queue.push(p === '/directory' ? '/' : p);
  }
  return seen;
}

describe('the fixture directory is a connected, realistic set', () => {
  const pages = reachable();
  const models = [...pages.values()];

  test('no link on any fixture page leads nowhere', () => assert.ok(pages.size > 25, String(pages.size)));
  test('four cities in two states, several categories, and a business page for every fixture business', () => {
    for (const p of ['/chennai', '/coimbatore', '/madurai', '/bengaluru', '/state/tamil-nadu', '/state/karnataka', '/category/plumbers', '/category/electricians', '/category/salons', '/category/tutors', '/category/restaurants']) assert.ok(pages.has(p), p);
    const businesses = models.filter((m) => m.type === 'business');
    assert.equal(businesses.length, MOCK_BUSINESS_IDS.length);
  });
  test('every page keeps its title within 60 characters with the brand, and its canonical is its own address', () => {
    for (const [path, m] of pages) {
      assert.ok(m.meta.title.length <= 60 && m.meta.title.endsWith('| Get4Domain'), `${path}: ${m.meta.title}`);
      assert.equal(m.meta.canonical, `${MOCK_ORIGIN}${path === '/' ? '' : path}`, path);
      assert.equal(modelToMetadata(m).robots, m.meta.robots, path);
    }
  });
  test('a page with fewer than two businesses is thin and noindex; one with more is indexable by the model', () => {
    for (const [path, m] of pages) {
      if (m.type !== 'cityCategory' && m.type !== 'city' && m.type !== 'category') continue;
      if (['/chennai', '/chennai/electricians', '/chennai/plumbers', '/category/plumbers'].includes(path)) continue; // hand-built cases keep their own state
      assert.equal(m.meta.indexable, m.cards.length > 1, `${path} has ${m.cards.length} cards`);
    }
  });
  test('the only action on a card is the click-out; no contact details, and the click-out id is a fixture id', () => {
    for (const m of models) {
      const text = JSON.stringify(m);
      assert.ok(!/tel:|mailto:|wa\.me|"phone"|"email"|whatsapp/i.test(text), m.path);
      for (const c of m.cards) {
        if (c.listingOnly) { assert.equal(c.visitUrl, null, c.slug); continue; }
        const out = parseVisitUrl(c.visitUrl);
        assert.ok(out && looksLikeBusinessId(out.id, true), c.slug);
      }
    }
  });
  test('breadcrumbs end at the page itself and the JSON-LD list matches them', () => {
    for (const [path, m] of pages) {
      assert.equal(m.breadcrumbs.at(-1)!.path, path === '/' ? '/directory' : path.replace(/\/page\/\d+$/, ''), path);
      const ld = m.jsonLd.find((x) => (x as { '@type'?: string })['@type'] === 'BreadcrumbList') as { itemListElement: unknown[] } | undefined;
      assert.equal(ld?.itemListElement.length, m.breadcrumbs.length, path);
    }
  });
  test('an unknown city, category or combination is not found', () => {
    for (const p of ['/nowhere', '/coimbatore/nothing', '/madurai/salons', '/category/nothing', '/state/nothing']) assert.equal(mockPage(p).kind, 'notFound', p);
  });
});
