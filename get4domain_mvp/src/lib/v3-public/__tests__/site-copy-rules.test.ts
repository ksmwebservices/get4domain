import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanPlans, formatRupees, fromPricing, MOCK_PRICING, MOCK_PLANS, netAmountPaise, priceFor, PUBLIC_TERMS, type PublicPlan } from '../plans';
import { MARKETING } from '../marketing-strings';
import { PAYMENT_NOTE, SITE } from '../site-strings';

function walk(v: unknown, path: string, out: Array<{ path: string; text: string }>): void {
  if (typeof v === 'string') out.push({ path, text: v });
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`, out);
}
const all: Array<{ path: string; text: string }> = [];
walk(SITE, 'SITE', all);
walk(MARKETING, 'MARKETING', all);
all.push({ path: 'PAYMENT_NOTE', text: PAYMENT_NOTE });

const RULES: Array<[string, RegExp]> = [
  ['the banned product words', /\b(workspace|bos|leadspace)\b/i],
  ['"leads" (use enquiries)', /\bleads?\b/i],
  ['discount, offer, coupon or deal wording', /\b(discounts?|offers?|coupons?|deals?|promo(?:tion|tional)?s?|cashback|sale|save[sd]?|savings?|free of charge|% off|bundle)\b/i],
  ['a timeframe', /\b\d+\s*(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b|\b(?:within|instantly|overnight|in minutes|24\/7|monthly|per month|a month)\b/i],
  ['a ranking claim', /\b(best|top|number one|no\. ?1|#1|guaranteed?|leading|unmatched|world-class)\b/i],
  ['a written price or percentage', /[₹$%]|\brs\.?\s*\d|\binr\b/i],
  ['a rating, review or count claim', /\b(reviews?|rated|stars?|testimonials?|thousands?|millions?|\d+\+?\s*(?:businesses|customers|clients|users))\b/i],
  ['a card or payment form field', /\b(card number|card expiry|expiry date|cvv|cvc|upi id|net banking)\b/i],
];

describe('copy rules over every string of the commercial pages', () => {
  test('there is copy to check', () => assert.ok(all.length > 100, String(all.length)));
  for (const [name, re] of RULES) {
    test(`none contains ${name}`, () => {
      const hits = all.filter((s) => re.test(s.text)).map((s) => `${s.path}: ${s.text}`);
      assert.deepEqual(hits, []);
    });
  }
  test('prices are said to exclude GST, and payment is said to happen in the business app', () => {
    assert.match(SITE.pricing.gstLine, /without GST/);
    assert.match(SITE.pricing.gstLine, /added at checkout/);
    assert.match(SITE.footer.note, /without GST/);
    assert.match(PAYMENT_NOTE, /inside your business app/);
    assert.ok(SITE.pricing.faq.some((f) => /never takes a payment/.test(f.a)));
  });
  test('the only billing terms are quarterly, half-yearly and annual', () => {
    assert.deepEqual(Object.keys(SITE.pricing.terms).map(Number), [3, 6, 12]);
    assert.deepEqual([...PUBLIC_TERMS], [3, 6, 12]);
  });
  test('the pricing FAQ answers the trial, paying, GST, plan end and terms', () => {
    const qs = SITE.pricing.faq.map((f) => f.q).join(' | ');
    for (const w of [/trial/i, /pay/i, /GST/, /plan ends/i, /billing terms/i]) assert.match(qs, w);
    assert.ok(SITE.pricing.faq.some((f) => /stops working/.test(f.a) && /subdomain/.test(f.a) && /kept/.test(f.a)), 'plan end: domain stops and redirects to the subdomain, data and theme kept');
  });
});

describe('pricing data from the Wave 3 route shape', () => {
  test('a pending term has no price row and no number; an available term is the price before GST', () => {
    const m = fromPricing(MOCK_PRICING);
    assert.deepEqual(m.plans.find((p) => p.key === 'ecommerce')!.prices, []);
    const h = m.plans.find((p) => p.key === 'handyman')!;
    assert.deepEqual(h.prices.map((p) => [p.termMonths, p.amountPaise, p.taxInclusive]), [[3, 100000, false], [6, 190000, false], [12, 360000, false]]);
    assert.deepEqual(m.tax, { name: 'GST', ratePercent: 18 });
  });
  test('gst null stays null, capabilities become plain included rows, add-ons carry a price only when available', () => {
    const m = fromPricing({ currency: 'INR', gst: null, terms: [3], plans: [{ key: 'a', name: 'A', capabilities: [{ key: 'x', name: 'X' }], terms: [{ termMonths: 3, state: 'AVAILABLE', price: { priceMinor: 5000, gstMinor: null, totalMinor: null }, purchasable: true }] }],
      addons: [{ key: 'S', name: 'S', state: 'PRICE_PENDING', price: null }, { key: 'T', name: 'T', state: 'AVAILABLE', price: { priceMinor: 9900 } }] });
    assert.equal(m.tax, null);
    assert.equal(priceFor(m.plans[0], 3, m.tax).paise, 5000);
    assert.deepEqual(m.plans[0].features.map((f) => [f.key, f.state]), [['x', 'ACTIVE']]);
    assert.deepEqual(m.addons!.map((a) => a.priceMinor), [null, 9900]);
  });
  test('missing arrays do not throw', () => {
    assert.deepEqual(fromPricing({}), { plans: [], terms: [], tax: null, addons: [] });
  });
});

describe('pricing data', () => {
  const plan = (over: Partial<PublicPlan> = {}): PublicPlan => ({ key: 'k', track: 't', level: 'PRO', name: 'K', description: null, prices: [], features: [], ...over });
  const tax = { name: 'GST', ratePercent: 18 };

  test('every term has a price for a priced plan and the numbers are the API numbers', () => {
    const h = MOCK_PLANS.plans[0];
    for (const t of PUBLIC_TERMS) {
      const r = priceFor(h, t, tax);
      assert.equal(r.pending, false);
      assert.equal(r.paise, h.prices.find((p) => p.termMonths === t)!.amountPaise);
    }
  });
  test('a plan with no price is pending: no number for any term', () => {
    const e = cleanPlans(MOCK_PLANS).plans.find((p) => p.key === 'ecommerce')!;
    for (const t of PUBLIC_TERMS) assert.deepEqual(priceFor(e, t, tax), { paise: null, pending: true });
  });
  test('a term the plan does not offer is not a price', () => {
    const p = plan({ prices: [{ termMonths: 12, amountPaise: 360000, currency: 'INR', taxInclusive: false }] });
    assert.deepEqual(priceFor(p, 3, tax), { paise: null, pending: false });
    assert.equal(priceFor(p, 12, tax).paise, 360000);
  });
  test('a tax-inclusive price is taken back to its amount without GST; without a tax rate it is not shown', () => {
    const inc = { termMonths: 3, amountPaise: 118000, currency: 'INR', taxInclusive: true };
    assert.equal(netAmountPaise(inc, tax), 100000);
    assert.equal(netAmountPaise(inc, null), null);
    assert.deepEqual(priceFor(plan({ prices: [inc] }), 3, null), { paise: null, pending: true });
  });
  test('zero, negative, not-a-number and non-rupee prices are never shown', () => {
    for (const amountPaise of [0, -5, Number.NaN]) assert.equal(netAmountPaise({ termMonths: 3, amountPaise, currency: 'INR', taxInclusive: false }, tax), null);
    assert.equal(netAmountPaise({ termMonths: 3, amountPaise: 1000, currency: 'USD', taxInclusive: false }, tax), null);
  });
  test('monthly rows and hidden features are dropped', () => {
    const c = cleanPlans({
      terms: [1, 3, 6, 12], tax,
      plans: [plan({ prices: [{ termMonths: 1, amountPaise: 100, currency: 'INR', taxInclusive: false }, { termMonths: 3, amountPaise: 300, currency: 'INR', taxInclusive: false }],
        features: [{ key: 'a', name: 'A', group: 'g', kind: 'BOOLEAN', unit: null, state: 'HIDDEN', limit: null, enumValue: null, upsellText: null }, { key: 'b', name: 'B', group: 'g', kind: 'BOOLEAN', unit: null, state: 'ACTIVE', limit: null, enumValue: null, upsellText: null }] })],
    });
    assert.deepEqual(c.terms, [3, 6, 12]);
    assert.deepEqual(c.plans[0].prices.map((p) => p.termMonths), [3]);
    assert.deepEqual(c.plans[0].features.map((f) => f.key), ['b']);
  });
  test('formatRupees', () => {
    assert.equal(formatRupees(100000), '₹1,000');
    assert.equal(formatRupees(123450), '₹1,234.50');
    assert.equal(formatRupees(1250000), '₹12,500');
  });
});
