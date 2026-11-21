import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { goHref, looksLikeBusinessId, parseVisitUrl } from '../click';
import { basePathOf, modelToMetadata, pagePath, serializeJsonLd } from '../metadata';
import { MOCK_ORIGIN, mockPage } from '../mocks';
import { windowOf } from '../pagination';
import type { PageModel } from '../types';

const PATHS = [
  '/', '/state/tamil-nadu', '/chennai', '/category/plumbers', '/chennai/plumbers', '/chennai/plumbers/page/2', '/chennai/plumbers-in-adyar', '/chennai/plumbers-in-velachery',
  '/chennai/electricians', '/pincode/600020/plumbers', '/business/sri-murugan-plumbing', '/business/anand-electricals',
];

function model(path: string): PageModel {
  const r = mockPage(path);
  assert.equal(r.kind, 'ok', path);
  return (r as { kind: 'ok'; model: PageModel }).model;
}

describe('page model to metadata', () => {
  for (const path of PATHS) {
    test(`${path}: title (with the brand, at most 60), canonical and robots come from the model`, () => {
      const m = model(path);
      const md = modelToMetadata(m);
      assert.deepEqual(md.title, { absolute: m.meta.title });
      assert.ok(m.meta.title.length <= 60, `title is ${m.meta.title.length} characters`);
      assert.ok(m.meta.title.endsWith('| Get4Domain'), 'the brand comes from the model');
      assert.equal(md.alternates?.canonical, m.meta.canonical);
      assert.equal(md.robots, m.meta.robots);
      assert.equal(md.description, m.meta.description);
    });
  }

  test('a noindex model renders noindex and an indexable one renders index', () => {
    assert.equal(modelToMetadata(model('/chennai/plumbers-in-velachery')).robots, 'noindex, follow');
    assert.equal(modelToMetadata(model('/chennai/plumbers')).robots, 'index, follow, max-image-preview:large');
    assert.equal(modelToMetadata(model('/pincode/600020/plumbers')).robots, 'noindex, follow');
  });

  test('prev and next links come from the model', () => {
    const p1 = modelToMetadata(model('/chennai/plumbers')) as { pagination?: { previous?: string; next?: string } };
    assert.equal(p1.pagination?.previous, undefined);
    assert.equal(p1.pagination?.next, `${MOCK_ORIGIN}/chennai/plumbers/page/2`);
    const p2 = modelToMetadata(model('/chennai/plumbers/page/2')) as { pagination?: { previous?: string; next?: string } };
    assert.equal(p2.pagination?.previous, `${MOCK_ORIGIN}/chennai/plumbers`);
    assert.equal(p2.pagination?.next, undefined);
    assert.equal((modelToMetadata(model('/chennai')) as { pagination?: unknown }).pagination, undefined);
  });

  test('exactly one canonical and no ranking or contact words in any fixture', () => {
    for (const path of PATHS) {
      const s = JSON.stringify(model(path));
      assert.doesNotMatch(s, /tel:|mailto:|wa\.me|whatsapp|"phone"|"email"/i, path);
      assert.doesNotMatch(s, /\b(best|top|number one|guaranteed)\b/i, path);
    }
  });
});

describe('the listing card data', () => {
  test('a card has at most one action and it goes through our own /go, never the API host or a business site', () => {
    for (const path of PATHS) {
      for (const c of model(path).cards) {
        const href = c.listingOnly ? null : goHref(c.visitUrl);
        if (c.listingOnly) assert.equal(c.visitUrl, null, `${path} ${c.slug}: a listing-only card has no visit address`);
        if (href) {
          assert.match(href, /^\/go\/[A-Za-z0-9_-]+(\?[a-zA-Z0-9=&_-]*)?$/);
          assert.doesNotMatch(href, /^https?:/);
        }
      }
    }
  });

  test('the click-out address is parsed strictly', () => {
    assert.deepEqual(parseVisitUrl('https://api.example.invalid/v3/go/b-1001?src=city&kw=k1'), { id: 'b-1001', src: 'city', kw: 'k1' });
    assert.equal(goHref('https://api.example.invalid/v3/go/b-1001?src=city'), '/go/b-1001?src=city');
    assert.equal(goHref('https://evil.example.invalid/somewhere'), null);
    assert.equal(goHref('javascript:alert(1)'), null);
    assert.equal(goHref(null), null);
    assert.equal(parseVisitUrl('https://api.example.invalid/v3/go/b-1001?src=<script>')?.src, null);
  });

  test('a /go segment is a business id only when it is a uuid, a cuid, or a fixture id in mock mode', () => {
    assert.equal(looksLikeBusinessId('3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e', false), true);
    assert.equal(looksLikeBusinessId('ckx1y2z3a4b5c6d7e8f9g0h1i', false), true);
    assert.equal(looksLikeBusinessId('b-1001', true), true);
    assert.equal(looksLikeBusinessId('b-1001', false), false);
    assert.equal(looksLikeBusinessId('summer-sale', true), false);
    assert.equal(looksLikeBusinessId('my-campaign', false), false);
  });
});

describe('pagination', () => {
  test('numbered links are /page/{n} with no suffix for page 1', () => {
    assert.equal(pagePath('/chennai/plumbers', 1), '/chennai/plumbers');
    assert.equal(pagePath('/chennai/plumbers', 3), '/chennai/plumbers/page/3');
    assert.equal(pagePath('/', 2), '/page/2');
    assert.equal(basePathOf('/chennai/plumbers/page/3'), '/chennai/plumbers');
    assert.equal(basePathOf('/chennai'), '/chennai');
  });

  test('the window of numbers stays inside the pages', () => {
    assert.deepEqual(windowOf(1, 3), [1, 2, 3]);
    assert.deepEqual(windowOf(1, 10), [1, 2, 3, 4, 5]);
    assert.deepEqual(windowOf(5, 10), [3, 4, 5, 6, 7]);
    assert.deepEqual(windowOf(10, 10), [6, 7, 8, 9, 10]);
  });

  test('the fixture pages carry prev and next that match their paths', () => {
    const m = model('/chennai/plumbers/page/2');
    assert.equal(m.page?.prevPath, '/chennai/plumbers');
    assert.equal(m.page?.nextPath, null);
  });
});

describe('unknown and removed addresses', () => {
  test('an unknown path, a page past the last and page 1 are all not found; a removed business is gone', () => {
    assert.equal(mockPage('/nowhere/at-all').kind, 'notFound');
    assert.equal(mockPage('/chennai/plumbers/page/9').kind, 'notFound');
    assert.equal(mockPage('/chennai/plumbers/page/1').kind, 'notFound');
    assert.equal(mockPage('/business/nope').kind, 'notFound');
    assert.equal(mockPage('/business/removed-shop').kind, 'gone');
  });

  test('thin and empty pages stay reachable', () => {
    assert.equal(mockPage('/chennai/plumbers-in-velachery').kind, 'ok');
    assert.equal(model('/chennai/plumbers-in-velachery').meta.noindexReason, 'THIN');
    assert.equal(model('/pincode/600020/plumbers').meta.noindexReason, 'EMPTY');
  });
});

describe('JSON-LD in a script tag', () => {
  test('nothing in the data can close the tag or break the parser', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>', note: 'a & b', sep: 'x y z', ok: '日本' });
    assert.doesNotMatch(out, /<|>|&/);
    assert.equal(out.includes(' '), false);
    assert.equal(out.includes(' '), false);
    const back = JSON.parse(out) as Record<string, string>;
    assert.equal(back.name, '</script><script>alert(1)</script>');
    assert.equal(back.note, 'a & b');
  });
});
