import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { INDUSTRIES } from '../../../data/industries-list';
import { brandedTitle } from '../../metadata';
import { decideHost } from '../host-routing';
import { readHostConfig } from '../hostnames';
import { ALL_INDUSTRY_SLUGS, industryBySlug, industryDescription, industryTitle, PACK_SLUGS, PACK_SUITS, publishedIndustries, REGULATED_PACKS, regulatedPacksPublic } from '../industries';
import { PACKS } from '../packs';
import { SITE } from '../site-strings';

const OFF = {};
const ON = { V3_REGULATED_PACKS_PUBLIC: 'true' };
const REGULATED = ['CLINIC', 'LAB', 'PHARMACY', 'PRACTICE_LEGAL_FINANCE'];

describe('which packs are published', () => {
  test('the regulated four are exactly CLINIC, LAB, PHARMACY and PRACTICE_LEGAL_FINANCE', () => {
    assert.deepEqual([...REGULATED_PACKS].sort(), [...REGULATED].sort());
  });
  test('by default 12 packs are published and none of the regulated four', () => {
    const keys = publishedIndustries(OFF).map((p) => p.pack.key);
    assert.equal(keys.length, 12);
    for (const k of REGULATED) assert.ok(!keys.includes(k), k);
  });
  test('the flag must be exactly "true"; anything else keeps them hidden', () => {
    for (const v of [undefined, '', '1', 'yes', 'false', 'TRUE ']) assert.equal(regulatedPacksPublic({ V3_REGULATED_PACKS_PUBLIC: v }) , v === 'TRUE ', String(v));
    assert.equal(publishedIndustries({ V3_REGULATED_PACKS_PUBLIC: 'yes' }).length, 12);
  });
  test('with the flag on all 16 are published', () => assert.equal(publishedIndustries(ON).length, 16));
  test('a regulated slug has no page by default and has one when published', () => {
    for (const k of REGULATED) {
      assert.equal(industryBySlug(PACK_SLUGS[k], OFF), null, k);
      assert.equal(industryBySlug(PACK_SLUGS[k], ON)?.pack.key, k);
    }
    assert.equal(industryBySlug('food-service', OFF)?.pack.key, 'FOOD_SERVICE');
    assert.equal(industryBySlug('nothing', ON), null);
  });
});

describe('slugs', () => {
  test('every pack has a unique, well-formed slug and suits list', () => {
    const slugs = PACKS.map((p) => PACK_SLUGS[p.key]);
    assert.equal(new Set(slugs).size, 16);
    for (const s of slugs) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const p of PACKS) assert.ok((PACK_SUITS[p.key] ?? []).length >= 2, p.key);
    assert.deepEqual([...ALL_INDUSTRY_SLUGS].sort(), [...slugs].sort());
  });
  test('no slug equals the id of a live industry page, so no live page is shadowed', () => {
    const live = new Set(INDUSTRIES.map((i: { id: string }) => i.id));
    for (const s of ALL_INDUSTRY_SLUGS) assert.ok(!live.has(s), s);
  });
});

describe('metadata', () => {
  test('every title, with the brand when it fits, is at most 60 characters; descriptions are a sensible length', () => {
    for (const p of publishedIndustries(ON)) {
      assert.ok(brandedTitle(industryTitle(p.pack.name)).length <= 60, p.pack.name);
      const d = industryDescription(p.pack.name);
      assert.ok(d.length > 50 && d.length <= 170, `${p.pack.name} ${d.length}`);
      assert.ok(d.includes(p.pack.name));
    }
  });
});

describe('copy of the landing pages', () => {
  const texts: string[] = [];
  for (const p of publishedIndustries(ON)) {
    texts.push(p.pack.name, ...p.pack.gives, ...p.suits, industryTitle(p.pack.name), industryDescription(p.pack.name));
    for (const f of SITE.industryPage.faq) texts.push(f.q.replace('{name}', p.pack.name), f.a.replace('{gives}', p.pack.gives.join(', ')));
  }
  for (const s of SITE.industryPage.steps) texts.push(s.title, s.body);
  texts.push(SITE.industryPage.note, SITE.industryPage.givesIntro, SITE.industryPage.cta, SITE.industryPage.ctaHeading);
  const RULES: Array<[string, RegExp]> = [
    ['a banned product word', /\b(workspace|bos|leadspace)\b/i],
    ['"leads"', /\bleads?\b/i],
    ['discount, offer, coupon or deal wording', /\b(discounts?|offers?|coupons?|deals?|promo(?:tion|tional)?s?|cashback|sale|save[sd]?|savings?|free of charge|bundle)\b/i],
    ['a timeframe', /\b\d+\s*(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b|\b(?:within|instantly|overnight|in minutes|24\/7|monthly|per month)\b/i],
    ['a ranking claim', /\b(best|top|number one|guaranteed?|leading|unmatched|world-class)\b/i],
    ['a written price or percentage', /[₹$%]|\binr\b/i],
    ['a rating, review or count claim', /\b(reviews?|rated|stars?|testimonials?|thousands?|millions?)\b|\d+\+?\s*(?:businesses|customers|clients|users)/i],
  ];
  for (const [name, re] of RULES) test(`none contains ${name}`, () => assert.deepEqual(texts.filter((t) => re.test(t)), []));
  test('the FAQ answers: what it gives, the trial, which plan, editing', () => {
    const q = SITE.industryPage.faq.map((f) => f.q).join(' | ');
    for (const w of [/give/i, /pay to try/i, /plan/i, /edit/i]) assert.match(q, w);
    assert.ok(SITE.industryPage.faq.some((f) => /informational/.test(f.a)));
  });
});

describe('host routing of the landing pages', () => {
  const env = { V3_PUBLIC_ENABLED: 'true' };
  const cfg = readHostConfig({ MAIN_HOST: 'main.example.invalid', DIRECTORY_HOST: 'directory.main.example.invalid' });
  const decide = (pathname: string, e: Record<string, string | undefined> = env) => decideHost({ host: 'main.example.invalid', pathname }, cfg, e);
  test('a published pack slug on the main host is rewritten to the internal page', () => {
    assert.deepEqual(decide('/industries/food-service'), { action: 'rewrite', pathname: '/v3-site/industries/food-service' });
    assert.deepEqual(decide('/industries/food-service/'), { action: 'rewrite', pathname: '/v3-site/industries/food-service' });
  });
  test('a regulated pack is a real not-found by default and is rewritten when published', () => {
    for (const k of REGULATED) {
      assert.deepEqual(decide(`/industries/${PACK_SLUGS[k]}`), { action: 'not-found', host: 'main' }, k);
      assert.deepEqual(decide(`/industries/${PACK_SLUGS[k]}`, { ...env, V3_REGULATED_PACKS_PUBLIC: 'true' }), { action: 'rewrite', pathname: `/v3-site/industries/${PACK_SLUGS[k]}` }, k);
    }
  });
  test('a live industry id and an unknown slug pass through untouched', () => {
    for (const p of ['/industries/travel', '/industries/retail', '/industries/whatever', '/industries/food-service/extra']) assert.deepEqual(decide(p), { action: 'pass', host: 'main' }, p);
  });
  test('with the flag off nothing is decided at all', () => assert.equal(decide('/industries/food-service', {}), null));
});
