import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { introFallback, isAreaPage, localBusinessListLd, showEmptyState, showListOrClaim } from '../area-page';
import { mockPage } from '../mocks';
import { modelToMetadata } from '../metadata';
import { PORTAL } from '../portal-strings';
import type { PageModel } from '../types';

const AREA_PATHS = ['/chennai/plumbers', '/chennai/plumbers-in-adyar', '/chennai/plumbers-in-velachery', '/chennai/electricians', '/pincode/600020/plumbers'];
const model = (p: string): PageModel => { const r = mockPage(p); assert.equal(r.kind, 'ok', p); return (r as { model: PageModel }).model; };

describe('category-in-area directory pages (P4.5)', () => {
  test('every area page has a title with the brand, a description, one heading that names the category, and canonical and robots from the model', () => {
    for (const p of AREA_PATHS) {
      const m = model(p);
      assert.ok(isAreaPage(m), p);
      assert.match(m.meta.title, /Get4Domain/, p);
      assert.ok(m.meta.description.length > 10, p);
      assert.ok(m.h1.length > 3, p);
      const md = modelToMetadata(m);
      assert.equal((md.title as { absolute: string }).absolute, m.meta.title, 'the title is the backend title, unchanged');
      assert.equal(md.robots, m.meta.robots, 'indexing is whatever the model says');
    }
  });
  test('the item list of local businesses has one LocalBusiness per card with only name, address and locality', () => {
    const m = model('/chennai/plumbers');
    const ld = localBusinessListLd(m) as { '@type': string; numberOfItems: number; itemListElement: Array<{ position: number; item: Record<string, unknown> }> };
    assert.equal(ld['@type'], 'ItemList');
    assert.equal(ld.numberOfItems, m.cards.length);
    assert.deepEqual(ld.itemListElement.map((x) => x.position), m.cards.map((_, i) => i + 1));
    for (const e of ld.itemListElement) {
      assert.equal(e.item['@type'], 'LocalBusiness');
      assert.match(String(e.item.url), /^https:\/\//);
      assert.equal(e.item.telephone, undefined);
      assert.equal(e.item.aggregateRating, undefined);
    }
  });
  test('no item list on an empty page, and none is added when the model already has one', () => {
    assert.equal(localBusinessListLd(model('/pincode/600020/plumbers')), null);
    const m = model('/chennai/plumbers');
    const own = { ...m, jsonLd: [...m.jsonLd, { '@type': 'ItemList' }] };
    assert.equal(localBusinessListLd(own), null);
  });
  test('an empty area page shows the honest empty state even if it carries links; a page with businesses does not', () => {
    assert.equal(showEmptyState(model('/pincode/600020/plumbers')), true);
    const withLinks = { ...model('/chennai/plumbers'), cards: [] };
    assert.equal(showEmptyState(withLinks), true);
    assert.equal(showEmptyState(model('/chennai/plumbers')), false);
  });
  test('every area page offers to list or claim; other pages do not', () => {
    for (const p of AREA_PATHS) assert.equal(showListOrClaim(model(p)), true, p);
    assert.equal(showListOrClaim(model('/')), false);
    assert.match(PORTAL.directory.missingList, /List your business/);
    assert.match(PORTAL.directory.missingClaim, /Claim a listing/);
  });
  test('an empty intro falls back to plain words from the heading', () => {
    assert.equal(introFallback({ h1: 'Plumbers in Adyar', intro: 'Given intro.' }), 'Given intro.');
    assert.match(introFallback({ h1: 'Plumbers in Adyar', intro: '  ' }), /^Plumbers in Adyar: the businesses listed/);
  });
});
