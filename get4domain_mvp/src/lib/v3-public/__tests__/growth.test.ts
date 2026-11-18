import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GROWTH_GROUPS, GROWTH_ONLY, GROWTH_SERVICES, GROWTH_STATUS_LABEL, servicesOf, statusLabels } from '../growth-config';
import { GROWTH } from '../growth-strings';
import { MARKETING } from '../marketing-strings';
import { fromPricing, MOCK_PRICING } from '../plans';
import { portalPlanRows } from '../portal-pricing';
import { billedLine, PORTAL, termOption } from '../portal-strings';
import { offersLd } from '../site-jsonld';
import { MARKETING_FIXED_PATHS } from '../site-routes';
import { SITE } from '../site-strings';
import { siteSitemapEntries } from '../sitemap-paths';

function walk(v: unknown, path: string, out: Array<{ path: string; text: string }>): void {
  if (typeof v === 'string') out.push({ path, text: v });
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`, out);
}
const growth: Array<{ path: string; text: string }> = [];
walk(GROWTH, 'GROWTH', growth);
walk(GROWTH_GROUPS, 'GROUPS', growth);
walk(GROWTH_SERVICES.map((s) => ({ name: s.name, summary: s.summary })), 'SERVICES', growth);
walk(GROWTH_STATUS_LABEL, 'STATUS', growth);
const everything = [...growth];
walk(SITE, 'SITE', everything);
walk(MARKETING, 'MARKETING', everything);
walk(PORTAL, 'PORTAL', everything);

// the only time phrase of the growth copy is "monthly or yearly allowance" (an allowance by plan, never a number); "annual plan" names the plan
const withoutAllowance = (t: string): string => t.replace(/monthly or yearly allowance/g, 'allowance').replace(/\b(on the )?annual plan\b/gi, 'plan').replace(/get4domain/gi, 'Get-Domain');

const RANKING_PROMISES = /\b(rank(?:s|ed|ing)? (?:first|higher|number one|#?1)|you will rank|first page|page one|guarantee[sd]?|number one|top (?:spot|rank|position|result)|more (?:traffic|visitors|customers|enquiries|sales)|increase (?:your )?(?:traffic|enquiries|sales)|boost (?:your )?(?:traffic|enquiries|sales))\b|#\s?1/i;

describe('copy rules over the growth copy', () => {
  test('there is growth copy to check', () => assert.ok(growth.length > 60, String(growth.length)));
  const RULES: Array<[string, RegExp]> = [
    ['"leads" (use enquiries)', /\bleads?\b/i],
    ['trial wording', /\btrial\b/i],
    ['a banned product word', /\b(workspace|bos|leadspace)\b/i],
    ['a digit or percentage', /\d|%/],
    ['a written price', /[₹$]|\brs\.?\s*\d|\binr\b/i],
    ['a timeframe or time word', /\b(annually|seconds?|minutes?|hours?|days?|weeks?|months?|monthly|years?|yearly|within|instantly|overnight|24\/7)\b/i],
    ['a discount or deal word', /\b(discounts?|coupons?|deals?|cashback|free of charge|bundle)\b/i],
    ['a rating, review, logo or count claim', /\b(reviews?|rated|stars?|testimonials?|logos?|thousands?|millions?|trusted by)\b/i],
  ];
  for (const [name, re] of RULES) test(`none contains ${name}`, () => assert.deepEqual(growth.filter((s) => re.test(withoutAllowance(s.text))).map((s) => `${s.path}: ${s.text}`), []));
});

describe('no ranking, traffic or enquiry promise anywhere on the public site', () => {
  test('no string promises a position, traffic or a number of enquiries', () => {
    assert.deepEqual(everything.filter((s) => RANKING_PROMISES.test(s.text)).map((s) => `${s.path}: ${s.text}`), []);
  });
  test('the guard itself catches the promises', () => {
    for (const bad of ['You will rank first on Google.', 'We rank higher.', 'Guaranteed results', 'Be #1 in your city', 'Get more traffic', 'Reach the first page', 'The top spot is yours']) assert.match(bad, RANKING_PROMISES, bad);
    for (const ok of ['We set up and manage your Google Business Profile.', 'Nothing here promises a position in search results.']) assert.doesNotMatch(ok, RANKING_PROMISES, ok);
  });
  test('the old trial wording and "leads" are gone from every public string', () => {
    assert.deepEqual(everything.filter((s) => /\bfree trial\b|\btrial sites?\b|\bleads?\b/i.test(s.text)).filter((s) => !/\.lead$/.test(s.path)).map((s) => s.path), []);
  });
  test('the honest line says we set up and manage, and promises nothing', () => {
    assert.match(GROWTH.honest, /We set up and manage/);
    assert.match(GROWTH.honest, /cannot promise/);
  });
});

describe('the growth config', () => {
  test('the five status labels are exactly the owner wording', () => {
    assert.deepEqual(GROWTH_STATUS_LABEL, { included: 'Included', team: 'Included, done by our team', allowance: 'Included, with an allowance by plan', soon: 'Launching soon', addon: 'Add-on pack' });
  });
  const keysOf = (st: string): string[] => GROWTH_SERVICES.filter((s) => s.statuses.includes(st as never)).map((s) => s.key).sort();
  test('Included: the directory listing, the category-in-area pages, and the base site and tools', () => {
    assert.deepEqual(keysOf('included'), ['dir-listing', 'dir-pages', 'sub-site', 'tools']);
  });
  test('done by our team: SEO, AEO and GEO (subdomain and directory), meta, local keywords, Business Profile, Analytics and Search Console, Merchant', () => {
    assert.deepEqual(keysOf('team'), ['analytics', 'dir-seo', 'gbp', 'local-keywords', 'merchant', 'meta', 'sub-seo']);
  });
  test('allowance by plan: spotlight, reels, poster, posts, blogs, content writing', () => {
    assert.deepEqual(keysOf('allowance'), ['blogs', 'poster', 'posts', 'reels', 'spotlight', 'writing']);
  });
  test('launching soon: directory ads, e-mail, SMS, WhatsApp, social posting', () => {
    assert.deepEqual(keysOf('soon'), ['dir-ads', 'email', 'sms', 'social-posting', 'whatsapp']);
  });
  test('add-on pack: custom-domain SEO and paid ads only', () => {
    assert.deepEqual(keysOf('addon'), ['cd-ads', 'cd-seo']);
  });
  test('every service has exactly one status', () => {
    for (const s of GROWTH_SERVICES) assert.equal(s.statuses.length, 1, s.key);
  });
  test('reels and the poster are on the annual plan', () => {
    for (const k of ['reels', 'poster']) assert.equal(GROWTH_SERVICES.find((x) => x.key === k)!.note, 'On the annual plan');
  });
  test('only the Merchant listing is Ecommerce-only', () => {
    assert.deepEqual(GROWTH_SERVICES.filter((s) => s.plans === 'ecommerce').map((s) => s.key), ['merchant']);
  });
  test('the Free plan has the directory listing, its pages and the subdomain site; everything else here is locked', () => {
    assert.deepEqual(GROWTH_SERVICES.filter((s) => s.free === 'included').map((s) => s.key).sort(), ['dir-listing', 'dir-pages', 'sub-site']);
  });
  test('every service belongs to a group, keys are unique, and the six groups are the page sections', () => {
    const keys = GROWTH_SERVICES.map((s) => s.key);
    assert.equal(new Set(keys).size, keys.length);
    for (const s of GROWTH_SERVICES) assert.ok(GROWTH_GROUPS.some((g) => g.key === s.group), s.key);
    for (const g of GROWTH_GROUPS) assert.ok(servicesOf(g.key).length > 0, g.key);
    assert.deepEqual(GROWTH_GROUPS.map((g) => g.name), ['Directory and local search', 'Your subdomain site', 'Google presence', 'Content and reels', 'Campaigns and social', 'Custom domain add-on']);
    assert.ok(GROWTH_ONLY.every((s) => !s.base));
    assert.deepEqual(statusLabels(GROWTH_SERVICES.find((s) => s.key === 'reels')!), ['Included, with an allowance by plan']);
  });
  test('the copy says promotion is for the subdomain and directory pages, never a custom domain, and has no allowance number', () => {
    assert.match(GROWTH.promotionNote, /subdomain/);
    assert.match(GROWTH.promotionNote, /directory pages/);
    assert.match(GROWTH.promotionNote, /custom domain are an add-on pack, price not set yet/);
    assert.match(GROWTH.allowanceNote, /monthly or yearly allowance by plan/);
  });
});

describe('the growth page is a marketing page', () => {
  test('it is a fixed path and is in the sitemap', () => {
    assert.ok(MARKETING_FIXED_PATHS.includes('/growth'));
    assert.ok(siteSitemapEntries({ V3_PUBLIC_ENABLED: 'true' }).some((e) => e.path === '/growth'));
  });
});

describe('plan prices: monthly price, billed line, saving and Offer data come from the real prices', () => {
  test('the monthly figure is the term price shared over its months', () => {
    const hand = portalPlanRows(fromPricing(MOCK_PRICING)).find((r) => r.key === 'handyman')!;
    assert.equal(hand.prices[12], '₹3,600');
    assert.equal(hand.monthly[12], '₹300');
    assert.equal(hand.monthly[3], '₹333');
  });
  test('a pending plan has no monthly number', () => {
    const e = portalPlanRows(fromPricing(MOCK_PRICING)).find((r) => r.key === 'ecommerce')!;
    assert.equal(e.pending, true);
    assert.equal(e.monthly[12], null);
  });
  test('the billed line and the dropdown option', () => {
    assert.equal(billedLine(12, '₹3,600'), 'billed annually ₹3,600 + GST');
    assert.equal(billedLine(6, '₹1,900'), 'billed half-yearly ₹1,900 + GST');
    assert.equal(billedLine(3, '₹1,000'), 'billed quarterly ₹1,000 + GST');
    assert.equal(termOption('Annual', 10), 'Annual (save 10%)');
    assert.equal(termOption('Annual', null), 'Annual');
  });
  test('Offer data lists only real prices, net of GST, and is null with none', () => {
    const ld = offersLd(fromPricing(MOCK_PRICING), PORTAL.home.terms) as { itemListElement: Array<{ item: { name: string; offers: Array<{ price: string; priceSpecification: { valueAddedTaxIncluded: boolean } }> } }> };
    const names = ld.itemListElement.map((x) => x.item.name);
    assert.ok(names.includes('Handyman'));
    assert.ok(!names.includes('Ecommerce'), 'a plan with no price has no Offer');
    const hand = ld.itemListElement.find((x) => x.item.name === 'Handyman')!.item.offers;
    assert.deepEqual(hand.map((o) => o.price), ['1000.00', '1900.00', '3600.00']);
    assert.ok(hand.every((o) => o.priceSpecification.valueAddedTaxIncluded === false));
    assert.equal(offersLd({ plans: [], terms: [], tax: null }, PORTAL.home.terms), null);
  });
});

describe('positioning: a local business directory and search with a web app (P4.8)', () => {
  const at = (path: string): string => everything.find((s) => s.path === path)?.text ?? '';
  test('the hero, home, about, product and meta texts say directory, search, web app, enquiry capture and promotion', () => {
    for (const t of [at('PORTAL.home.lead'), at('SITE.home.lead'), at('SITE.home.metaDescription'), at('MARKETING.product.lead'), at('MARKETING.product.metaDescription')]) {
      assert.match(t, /enquiry capture/, t);
      assert.match(t, /promotion/, t);
    }
    assert.match(at('PORTAL.home.eyebrow'), /directory, search and web app/);
    assert.match(at('PORTAL.home.lead'), /keyword and place/);
    assert.match(at('PORTAL.home.lead'), /subdomain directory/);
    assert.match(at('SITE.home.lead'), /local business directory and search/);
  });
  test('the About text is a directory and search engine with a web app, and names SEO keywords, directory pages and the subdomain', async () => {
    const { ABOUT_STRINGS } = await import('../company-strings');
    assert.match(ABOUT_STRINGS.intro, /local business directory and search engine/);
    assert.match(ABOUT_STRINGS.intro, /an enquiry capture system/);
    assert.match(ABOUT_STRINGS.intro, /SEO keywords, directory pages and the business subdomain/);
    assert.match(ABOUT_STRINGS.metaDescription, /local business directory and search/);
  });
  test('it is "enquiry capture", never "lead capture"', () => {
    assert.deepEqual(everything.filter((s) => /lead[- ]capture|capture leads?/i.test(s.text)).map((s) => s.path), []);
  });
  test('no other company or product is named or compared with', () => {
    assert.deepEqual(everything.filter((s) => /justdial|indiamart|sulekha|urbanclap|urban company|yelp|alibaba|amazon|facebook marketplace/i.test(s.text)).map((s) => s.path), []);
    assert.deepEqual(everything.filter((s) => /\b(like|unlike|than|versus|vs\.?|instead of|alternative to|better|cheaper|beats?)\b[^.]{0,40}\b(google|justdial|indiamart)\b/i.test(s.text)).map((s) => s.path), []);
  });
  test('Google is named only as services we set up (Business Profile, Analytics, Search Console, Merchant, ads) or as where search happens', () => {
    const bad = everything.filter((s) => /\bGoogle\b/.test(s.text)).filter((s) => !/Google (Business Profile|Analytics|Merchant|presence)|Google and Meta ads|Search Console|in Google|local-area Google|search engines?/i.test(s.text)).map((s) => s.path);
    assert.deepEqual(bad, []);
  });
});
