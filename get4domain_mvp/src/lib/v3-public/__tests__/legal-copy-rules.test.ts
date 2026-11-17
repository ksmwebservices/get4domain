import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ABOUT_STRINGS, CONTACT_STRINGS } from '../company-strings';
import { LEGAL_DOCS, LEGAL_UI } from '../legal-strings';

/** Every string of the legal and company pages, with where it is. */
function walk(v: unknown, at: string, out: Array<{ at: string; text: string }>): void {
  if (typeof v === 'string') out.push({ at, text: v });
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`, out);
}
const all: Array<{ at: string; text: string }> = [];
for (const d of LEGAL_DOCS) walk(d, d.path, all);
walk(LEGAL_UI, 'LEGAL_UI', all);
walk(ABOUT_STRINGS, 'about', all);
walk(CONTACT_STRINGS, 'contact', all);

const policyText = (path: string): string => {
  const d = LEGAL_DOCS.find((x) => x.path === path)!;
  const parts: string[] = [d.title, d.intro];
  for (const s of d.sections) parts.push(s.heading, ...(s.paragraphs ?? []), ...(s.bullets ?? []));
  return parts.join('\n');
};
const NEGATABLE = /\b(discounts?|coupons?|offers?|promo(?:tion|tional)?s?|guarantee[sd]?)\b/i;
const NEGATION = /\b(no|not|never|nor|without|cannot|neither)\b|n't/i;

const RULES: Array<[string, RegExp]> = [
  ['a banned product word (workspace, BOS, LeadSpace)', /\b(workspace|bos|leadspace)\b/i],
  ['"leads" (use enquiries)', /\bleads?\b/i],
  ['a digit (no number is decided, so policy text carries none; the brand name Get4Domain is the one exception)', /\d/],
  ['a timeframe or time word', /\b(seconds?|minutes?|hours?|days?|weeks?|months?|years?|within|instantly|immediately|overnight|24\/7|a month|per month)\b/i],
  ['a price, currency or percentage', /[₹$%]|\brs\.?\s|\binr\b|\bpercent\b/i],
  ['an arbitration clause', /\barbitra\w*/i],
  ['a section number', /\bsections?\s+(?:\d|[ivx]+\b)/i],
  ['a placeholder', /\bx{3,}\b|\btbd\b|\btodo\b|lorem ipsum|\[[^\]]*\]|\{[^}]*\}|<[^>]*>/i],
  ['a ranking or superlative claim', /\b(best|top[- ](?:rated|ranked|tier)|number one|no\. ?1|#1|leading|unmatched|world-class|awards?|rated|customer reviews?|testimonials?|stars?)\b/i],
  ['the word GSTIN in prose (it is shown only as a company detail, and only when set)', /\bgstin\b/i],
  ['a card or payment form field', /\b(card number|card expiry|cvv|cvc|upi id)\b/i],
  ['a medical claim', /\b(cure|diagnos\w+|treatment of|prescrib\w+)\b/i],
];

describe('copy rules over every string of the legal and company pages', () => {
  test('there is text to check', () => assert.ok(all.length > 150, String(all.length)));
  for (const [name, re] of RULES) {
    test(`none contains ${name}`, () => {
      const hits = all.filter((s) => (name.startsWith('the word GSTIN') ? s.at !== 'LEGAL_UI.rows.gstin' : true) && re.test(s.text.replace(/Get4Domain/g, 'Get-Domain'))).map((s) => `${s.at}: ${s.text.slice(0, 100)}`);
      assert.deepEqual(hits, []);
    });
  }
  test('a discount, coupon, offer, promotion or guarantee is mentioned only to say there is none', () => {
    const bad: string[] = [];
    for (const s of all) for (const sentence of s.text.split(/(?<=[.!?])\s+/)) if (NEGATABLE.test(sentence) && !NEGATION.test(sentence)) bad.push(`${s.at}: ${sentence}`);
    assert.deepEqual(bad, []);
  });
  test('sentences are short (a sentence of more than 45 words is hard to read)', () => {
    const long: string[] = [];
    for (const s of all) for (const sentence of s.text.split(/(?<=[.!?])\s+/)) if (sentence.split(/\s+/).length > 45) long.push(`${s.at}: ${sentence.slice(0, 80)}...`);
    assert.deepEqual(long, []);
  });
});

describe('the decided business facts are in the texts', () => {
  test('terms: gateway only, GST on top, invoice after payment, wallet, no discounts, Chennai courts, no arbitration', () => {
    const t = policyText('/terms');
    for (const re of [/Razorpay or Cashfree/, /GST is added on top at checkout/, /invoice after a successful payment/, /prepaid platform credit/, /not refundable and cannot be withdrawn as cash/, /No discounts, coupons or offers exist/, /courts at Chennai, Tamil Nadu have exclusive jurisdiction/, /laws of India/, /A failed or cancelled order does not start a plan/, /cash payment that an administrator of Get4Domain has confirmed/, /quarterly, half-yearly or annually/, /Free site is informational/]) assert.match(t, re);
  });
  test('refund: gateway refund to the original payment method, held payments, wallet, no promised refund window', () => {
    const t = policyText('/refund-policy');
    for (const re of [/through the payment gateway to the original payment method/, /held for review/, /not refundable and cannot be taken out as cash/, /as shown at checkout or as agreed in writing/, /does not start a plan/, /administrator of Get4Domain confirms/, /courts at Chennai, Tamil Nadu/]) assert.match(t, re);
  });
  test('payments: gateway only, no card form on the site, GST, invoice, held and failed payments, wallet, cash when confirmed', () => {
    const t = policyText('/payments-and-billing');
    for (const re of [/only through an online payment gateway, Razorpay or Cashfree/, /does not ask for card, UPI or bank details/, /GST is added on top at checkout/, /invoice after a successful payment/, /held for review/, /does not start a plan/, /not refundable, cannot be taken out as cash/, /administrator of Get4Domain has confirmed/, /No discounts, coupons or offers exist/]) assert.match(t, re);
  });
  test('delivery: digital service, no shipping, activation after the gateway confirms payment', () => {
    const t = policyText('/delivery-policy');
    for (const re of [/no physical goods/, /after the payment gateway confirms/, /does not activate a plan/]) assert.match(t, re);
  });
  test('privacy: gateways, hosting, directory shows no contact data, rights under the data protection law, no retention number, children', () => {
    const t = policyText('/privacy-policy');
    for (const re of [/Razorpay or Cashfree/, /does not show a phone number, email address or messaging link/, /Digital Personal Data Protection Act/, /for as long as it is needed/, /Children/, /do not receive or store your card, UPI or bank details/]) assert.match(t, re);
  });
  test('the disclaimer and acceptable use make no professional claim; the disclaimer says so', () => {
    assert.match(policyText('/disclaimer'), /Nothing on this website is professional, medical, legal, tax or financial advice/);
  });
  test('every policy that governs a dispute names India and Chennai', () => {
    for (const p of ['/terms', '/privacy-policy', '/refund-policy', '/disclaimer']) assert.match(policyText(p), /courts at Chennai, Tamil Nadu have exclusive jurisdiction/, p);
  });
  test('the only laws named are the four allowed ones, without section numbers', () => {
    const allowed = /Information Technology Act|Digital Personal Data Protection Act|Consumer Protection \(E-Commerce\) Rules|Central Goods and Services Tax Act/g;
    for (const s of all) assert.doesNotMatch(s.text.replace(allowed, ''), /\b(?:Act|Rules)\b/, `${s.at}: ${s.text.slice(0, 80)}`);
  });
});

describe('the company and partner pages', () => {
  test('partner terms: independent partners, slabs set by the admin, counted once on the first successful paid plan payment, monthly payouts, TDS, no discounts, no contact data, termination', () => {
    const t = policyText('/partner-terms');
    for (const re of [/A partner is independent/, /not an employee, agent or representative/, /administrator of Get4Domain sets the slabs/, /once, on its first successful paid plan payment/, /paid out monthly/, /Tax is deducted at source as the law requires/, /No discounts, coupons or offers exist/, /does not show a partner the contact details/, /Ending the arrangement/, /courts at Chennai, Tamil Nadu/]) assert.match(t, re);
  });
  test('directory and listing terms: no contact data, no enquiries passed on, claim code to the contact held, no ranking, removal through the contact held', () => {
    const t = policyText('/directory-listing-terms');
    for (const re of [/does not show a phone number, an email address or a messaging link/, /does not pass on enquiries/, /We send a code to that contact/, /never send a code to an address typed into the page/, /does not rate or review businesses/, /confirm the request through the contact we hold/, /Free site is informational/, /courts at Chennai, Tamil Nadu/]) assert.match(t, re);
  });
  test('about: says what Get4Domain is and who operates it, and invents no history, number or team', () => {
    const t = JSON.stringify(ABOUT_STRINGS);
    assert.match(t, /software-as-a-service platform for small businesses/);
    assert.match(t, /operated by KSM QUANTUM TECHNOLOGIES, Tidel Park, Chennai, Tamil Nadu, India/);
    assert.doesNotMatch(t, /(founded|since|years|team|clients|customers|award|trusted by|established)/i);
  });
  test('contact: help text exists for both the filled and the empty support details', () => {
    assert.ok(CONTACT_STRINGS.otherHelpWithDetails.length > 10 && CONTACT_STRINGS.otherHelpNoDetails.length > 10);
    assert.match(CONTACT_STRINGS.grievanceBody, /grievance officer/);
  });
});

