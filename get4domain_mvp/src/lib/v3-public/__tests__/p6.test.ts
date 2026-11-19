import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ABOUT_STRINGS, CONTACT_STRINGS } from '../company-strings';
import { GROWTH_GROUPS, GROWTH_SERVICES, GROWTH_STATUS_LABEL } from '../growth-config';
import { GROWTH } from '../growth-strings';
import { MARKETING } from '../marketing-strings';
import { PORTAL } from '../portal-strings';
import { SITE } from '../site-strings';
import { S } from '../strings';

type Item = { path: string; text: string };
function walk(v: unknown, path: string, out: Item[]): void {
  if (typeof v === 'string') out.push({ path, text: v });
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`, out);
}
/** Every visible public string of the site (the legal document texts are a separate, counsel-owned set and are not in here). */
const PUBLIC: Item[] = [];
walk(SITE, 'SITE', PUBLIC); walk(PORTAL, 'PORTAL', PUBLIC); walk(GROWTH, 'GROWTH', PUBLIC); walk(MARKETING, 'MARKETING', PUBLIC);
walk(ABOUT_STRINGS, 'ABOUT', PUBLIC); walk(CONTACT_STRINGS, 'CONTACT', PUBLIC); walk(S, 'S', PUBLIC);
walk(GROWTH_GROUPS, 'GROUPS', PUBLIC); walk(GROWTH_STATUS_LABEL, 'STATUS', PUBLIC);
walk(GROWTH_SERVICES.map((s) => ({ name: s.name, summary: s.summary, note: s.note ?? '' })), 'SERVICES', PUBLIC);

/** The copy guard of P6 (words the public site never uses). */
export const GUARD: Array<[string, RegExp]> = [
  ['"paid plan" (say Pro plan)', /\bpaid[- ]plans?\b/i],
  ['a "soon" label (launching soon, coming soon, opens soon)', /\b(launching|coming|opens?|available) soon\b|^\s*soon\s*$/i],
  ['"automated campaign builder"', /automated campaign builder/i],
  ['a competitor name', /justdial|indiamart|sulekha|urbanclap|urban company|google business profile|google my business|meta business suite|facebook marketplace/i],
  ['"leads" (say enquiries)', /\bleads\b|\blead[- ]capture\b|\bcapture leads?\b/i],
  ['the retired labels', /Included, done by our team|Included, with an allowance by plan/i],
];
const hits = (re: RegExp): string[] => PUBLIC.filter((s) => re.test(s.text)).map((s) => `${s.path}: ${s.text}`);

describe('P6.1 Pro plan wording', () => {
  test('there is public copy to check', () => assert.ok(PUBLIC.length > 600, String(PUBLIC.length)));
  for (const [name, re] of GUARD) test(`no public string says ${name}`, () => assert.deepEqual(hits(re), []));
  test('the guard catches the banned phrase and passes the right one', () => {
    for (const bad of ['Move to a paid plan', 'Paid plans', 'the from-free-to-paid-plan guide']) assert.match(bad, GUARD[0][1], bad);
    for (const ok of ['Pro plans', 'A Pro plan', 'paid for', 'Paid ads for a custom domain']) assert.doesNotMatch(ok, GUARD[0][1], ok);
  });
  test('the other guards catch their phrases and pass clean text', () => {
    const bad: Record<number, string[]> = {
      1: ['Launching soon', 'Coming soon', 'Soon', 'Registering opens soon'],
      2: ['An Automated campaign builder'],
      3: ['Better than Justdial', 'IndiaMART', 'Google Business Profile setup'],
      4: ['Capture leads', 'Your leads'],
      5: ['Included, done by our team', 'Included, with an allowance by plan'],
    };
    for (const [i, list] of Object.entries(bad)) for (const t of list) assert.match(t, GUARD[Number(i)][1], t);
    for (const ok of ['Your site goes live as soon as you register.', 'Enquiry capture', 'Included in Pro', 'Campaigns run by Get4Domain', 'Google Merchant profile']) {
      for (const [name, re] of GUARD) assert.doesNotMatch(ok, re, `${name}: ${ok}`);
    }
  });
  test('the comparison says Free plan and Pro plans', () => {
    assert.equal(SITE.pricing.compareHeading, 'Compare Free and Pro plans');
    assert.equal(SITE.pricing.compareFree, 'Free plan');
    assert.equal(SITE.pricing.comparePaid, 'Pro plans');
    assert.equal(GROWTH.footerCompare, 'Compare Free and Pro plans');
  });
});
