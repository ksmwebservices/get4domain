import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { HostConfig } from '../hostnames';
import { decideHost } from '../host-routing';
import { MOCK_PLANS } from '../plans';
import { annualSavingPercent, portalPlanRows } from '../portal-pricing';
import { portalLinks } from '../portal-links';
import { flattenCategories, flattenPlaces, matchCategory, matchPlace, normalize, resolveSearch, searchDirectory, searchQueryString, suggest, toResultItem, treesFrom, type Trees } from '../portal-search';
import { mockTrees } from '../mocks';
import { PORTAL } from '../portal-strings';
import { directoryCandidate, isV3PublicPath } from '../routes';
import type { PublicPlan } from '../plans';

// ---- copy rules over every static string of the portal design (same rules as site-copy-rules.test.ts) ----
function walk(v: unknown, path: string, out: Array<{ path: string; text: string }>): void {
  if (typeof v === 'string') out.push({ path, text: v });
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`, out);
}
const all: Array<{ path: string; text: string }> = [];
walk(PORTAL, 'PORTAL', all);

const RULES: Array<[string, RegExp]> = [
  ['the banned product words', /\b(workspace|bos|leadspace)\b/i],
  ['"leads" (use enquiries)', /\bleads?\b/i],
  ['discount, offer, coupon or deal wording', /\b(discounts?|offers?|coupons?|deals?|promo(?:tion|tional)?s?|cashback|sale|save[sd]?|savings?|free of charge|% off|bundle)\b/i],
  ['a timeframe', /\b\d+\s*(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b|\b(?:within|instantly|overnight|in minutes|24\/7|monthly|per month|a month)\b/i],
  ['a ranking claim', /\b(best|top|number one|no\. ?1|#1|guaranteed?|leading|unmatched|world-class)\b/i],
  ['a written price or percentage', /[₹$%]|\brs\.?\s*\d|\binr\b/i],
  ['a rating, review or count claim', /\b(reviews?|rated|stars?|testimonials?|thousands?|millions?|\d+\+?\s*(?:businesses|customers|clients|users))\b/i],
];

describe('copy rules over the portal strings', () => {
  test('there is copy to check', () => assert.ok(all.length > 120, String(all.length)));
  for (const [name, re] of RULES) {
    test(`none contains ${name}`, () => assert.deepEqual(all.filter((s) => re.test(s.text)).map((s) => `${s.path}: ${s.text}`), []));
  }
  test('the only billing terms are quarterly, half-yearly and annual', () => assert.deepEqual(Object.keys(PORTAL.home.terms).map(Number), [3, 6, 12]));
  test('the GST line says prices are without GST', () => assert.match(PORTAL.home.gst, /without GST/));
  test('the domain note says new domain registration is not open yet and never claims availability', () => {
    assert.match(PORTAL.search.customNote, /opens soon/);
    assert.doesNotMatch(PORTAL.search.customNote + PORTAL.search.customCta, /available/i);
  });
});

// ---- the search ----
const trees: Trees = treesFrom(mockTrees().places, mockTrees().categories);

describe('place and category trees', () => {
  test('places keep their address path, a label and the kind', () => {
    const adyar = flattenPlaces(mockTrees().places).find((p) => p.name === 'Adyar')!;
    assert.equal(adyar.path, 'tamil-nadu/chennai/adyar');
    assert.equal(adyar.label, 'Adyar, Chennai');
    assert.equal(adyar.kind, 'LOCALITY');
    assert.equal(adyar.depth, 3);
  });
  test('nodes without a slug or a name are skipped', () => {
    assert.deepEqual(flattenPlaces([{ slug: '', name: 'x', children: [] }, { slug: 'a', name: '', children: [] }]), []);
    assert.deepEqual(flattenCategories([{ slug: 'a', name: 'A', children: [{ slug: 'b', name: 'B', children: [] }] }]).map((c) => [c.slug, c.parent]), [['a', null], ['b', 'a']]);
  });
  test('normalize', () => assert.equal(normalize('  Tuition   Centre!! '), 'tuition centre'));
});

describe('typed text becomes a category or a place', () => {
  test('a category name, singular or plural, becomes the category filter and no text query', () => {
    for (const w of ['plumber', 'Plumbers', 'plumbers ']) {
      const r = resolveSearch(trees, { what: w });
      assert.equal(r.category?.slug, 'plumbers', w);
      assert.equal(r.q, '');
    }
  });
  test('other words stay the text query', () => {
    const r = resolveSearch(trees, { what: 'Leak repair!' });
    assert.equal(r.category, null);
    assert.equal(r.q, 'leak repair');
  });
  test('a place name, slug or "Locality, City" becomes the place filter', () => {
    assert.equal(matchPlace(trees, 'chennai')?.path, 'tamil-nadu/chennai');
    assert.equal(matchPlace(trees, 'Adyar, Chennai')?.path, 'tamil-nadu/chennai/adyar');
    assert.equal(matchPlace(trees, 'Tamil Nadu')?.path, 'tamil-nadu');
    assert.equal(matchCategory(trees, 'zzz'), null);
  });
  test('a place that is not in the tree is reported, never turned into everywhere', () => {
    const r = resolveSearch(trees, { what: 'plumber', where: 'Atlantis' });
    assert.equal(r.unknownPlace, true);
    assert.equal(r.place, null);
  });
  test('a picked suggestion wins over the typed words', () => {
    const r = resolveSearch(trees, { what: 'something else', where: 'nowhere', c: 'electricians', l: 'tamil-nadu/chennai' });
    assert.equal(r.category?.slug, 'electricians');
    assert.equal(r.place?.path, 'tamil-nadu/chennai');
    assert.equal(r.unknownPlace, false);
  });
  test('without trees (the API did not answer) a typed place is not called unknown and the words go to the text query', () => {
    const r = resolveSearch(null, { what: 'dentist', where: 'Chennai' });
    assert.equal(r.unknownPlace, false);
    assert.equal(r.q, 'dentist');
  });
  test('input is cut to a safe length', () => assert.ok(resolveSearch(trees, { what: 'a'.repeat(500) }).what.length <= 120));
});

describe('suggestions', () => {
  test('names that start with the typed text come before names that contain it', () => {
    const s = suggest(trees, 'e');
    assert.ok(s.categories.length > 0 && s.categories[0].name.toLowerCase().startsWith('e'));
    const cities = suggest(trees, 'chen').places.map((p) => p.name);
    assert.deepEqual(cities, ['Chennai']);
  });
  test('nothing is suggested for empty text, and the list is capped', () => {
    assert.deepEqual(suggest(trees, ' '), { categories: [], places: [] });
    assert.ok(suggest(trees, 'a', 2).categories.length <= 2);
  });
});

describe('the directory search over the sample data', () => {
  test('a category and a city give the matching businesses with their own site address', async () => {
    const r = await searchDirectory(resolveSearch(trees, { what: 'plumber', where: 'chennai' }), 1);
    assert.equal(r.kind, 'ok');
    if (r.kind !== 'ok') return;
    assert.equal(r.data.total, 4);
    assert.ok(r.data.items.every((i) => i.category === 'Plumbers'));
    const withSite = r.data.items.filter((i) => i.siteUrl);
    assert.ok(withSite.length >= 3 && withSite.every((i) => /^https:\/\//.test(i.siteUrl!)));
    assert.ok(r.data.items.some((i) => i.listingOnly), 'a listing without a site is marked listing only');
  });
  test('words of the name are found by prefix', async () => {
    const r = await searchDirectory(resolveSearch(trees, { what: 'murugan' }), 1);
    assert.equal(r.kind === 'ok' && r.data.items[0]?.slug, 'sri-murugan-plumbing');
  });
  test('nothing matches: an honest empty result, not a made-up one', async () => {
    const r = await searchDirectory(resolveSearch(trees, { what: 'dentist', where: 'Chennai' }), 1);
    assert.equal(r.kind === 'ok' && r.data.total, 0);
  });
  test('an unknown place is an empty result', async () => {
    const r = await searchDirectory(resolveSearch(trees, { what: 'plumber', where: 'Atlantis' }), 1);
    assert.equal(r.kind === 'ok' && r.data.total, 0);
  });
  test('a bad page number falls back to page 1', async () => {
    const r = await searchDirectory(resolveSearch(trees, { what: 'plumber' }), Number.NaN);
    assert.equal(r.kind === 'ok' && r.data.page, 1);
  });
  test('a result keeps only an http(s) site address', () => {
    assert.equal(toResultItem({ slug: 'a', name: 'A', siteUrl: 'javascript:alert(1)' })?.siteUrl, null);
    assert.equal(toResultItem({ slug: 'a', name: 'A', siteUrl: 'https://a.example.invalid' })?.listingOnly, false);
    assert.equal(toResultItem({ name: 'no slug' }), null);
    assert.equal(toResultItem({ slug: 'a', name: 'A', sponsored: true, label: 'Sponsored' })?.sponsoredLabel, 'Sponsored');
  });
  test('the address of a results page carries only what was given', () => {
    assert.equal(searchQueryString({}), '');
    assert.equal(searchQueryString({ what: 'plumber', where: 'Chennai', page: 1 }), '?what=plumber&where=Chennai');
    assert.equal(searchQueryString({ what: 'a b', c: 'x', page: 3 }), '?what=a+b&c=x&page=3');
  });
});

// ---- prices ----
describe('plan cards come only from the price route', () => {
  test('the saving is worked out from two real prices and the pending plan has none', () => {
    const rows = portalPlanRows(MOCK_PLANS);
    assert.deepEqual(rows.map((r) => [r.key, r.pending, r.saving]), [['handyman', false, 10], ['professional', false, 10], ['ecommerce', true, null]]);
    assert.equal(rows[2].prices[12], null, 'a pending plan has no number');
  });
  test('no saving when the annual price is not lower, or a price is missing', () => {
    const mk = (p3: number | null, p12: number | null): PublicPlan => ({
      key: 'x', track: 'x', level: 'x', name: 'X', description: null, features: [],
      prices: [...(p3 === null ? [] : [{ termMonths: 3, amountPaise: p3, currency: 'INR', taxInclusive: false }]), ...(p12 === null ? [] : [{ termMonths: 12, amountPaise: p12, currency: 'INR', taxInclusive: false }])],
    });
    assert.equal(annualSavingPercent(mk(100000, 400000), null), null);
    assert.equal(annualSavingPercent(mk(100000, 450000), null), null);
    assert.equal(annualSavingPercent(mk(100000, null), null), null);
    assert.equal(annualSavingPercent(mk(null, 100000), null), null);
    assert.equal(annualSavingPercent(mk(150000, 400000), null), 33);
  });
});

// ---- addresses ----
const cfg = (over: Partial<HostConfig>): HostConfig => ({ main: null, directory: null, app: null, admin: null, api: null, media: null, ...over });
const ON = { V3_PUBLIC_ENABLED: 'true' };

describe('links across the two hosts', () => {
  test('with the host layer off every link is a path on the same host', () => {
    const l = portalLinks(cfg({}), ON);
    assert.equal(l.main('/pricing'), '/pricing');
    assert.equal(l.search, '/search');
    assert.equal(l.directoryHome, '/directory');
    assert.equal(l.claim, '/claim');
  });
  test('with two hosts a link to the other host is absolute', () => {
    const l = portalLinks(cfg({ main: 'main.example.invalid', directory: 'directory.main.example.invalid' }), ON);
    assert.equal(l.main('/pricing'), 'https://main.example.invalid/pricing');
    assert.equal(l.search, 'https://directory.main.example.invalid/search');
    assert.equal(l.directoryHome, 'https://directory.main.example.invalid/');
    assert.equal(l.login, 'https://main.example.invalid/login');
  });
});

describe('the search page route', () => {
  const c = cfg({ main: 'main.example.invalid', directory: 'directory.main.example.invalid' });
  test('/search is a fixed V3 public path, not a directory address', () => {
    assert.equal(isV3PublicPath('/search'), true);
    assert.equal(directoryCandidate('/search'), null);
    assert.equal(isV3PublicPath('/directory-api/suggest'), true);
  });
  test('the main host sends /search to the directory host with its query; the directory host serves it', () => {
    assert.deepEqual(decideHost({ host: 'main.example.invalid', pathname: '/search', search: '?what=plumber' }, c, ON), { action: 'redirect', to: 'https://directory.main.example.invalid/search?what=plumber', status: 308 });
    assert.deepEqual(decideHost({ host: 'directory.main.example.invalid', pathname: '/search', search: '?what=plumber' }, c, ON), { action: 'pass', host: 'directory' });
  });
});
