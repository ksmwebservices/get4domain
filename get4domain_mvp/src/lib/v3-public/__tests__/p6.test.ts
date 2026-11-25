import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ABOUT_STRINGS, CONTACT_STRINGS } from '../company-strings';
import { GROWTH_GROUPS, GROWTH_SERVICES, GROWTH_STATUS_LABEL } from '../growth-config';
import { GROWTH } from '../growth-strings';
import { MARKETING } from '../marketing-strings';
import { PORTAL } from '../portal-strings';
import { SITE } from '../site-strings';
import { S } from '../strings';
import { brandedTitle } from '../../metadata';
import { siteConfig, BRAND_DESCRIPTION, BRAND_TITLE } from '../../../constants/site';
import manifest from '../../../app/manifest';
import { organizationLd, webSiteLd } from '../site-jsonld';
import { siteMetadata } from '../site-metadata';

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

describe('P6.2 titles and metadata', () => {
  const DEFAULT = 'Get4Domain | Local business and domain directory, domain search and web app';
  const pages: Array<[string, string, string]> = [
    ['home', SITE.home.metaTitle, SITE.home.metaDescription],
    ['pricing', SITE.pricing.metaTitle, SITE.pricing.metaDescription],
    ['growth', GROWTH.metaTitle, GROWTH.metaDescription],
    ['product', MARKETING.product.metaTitle, MARKETING.product.metaDescription],
    ['directory search', PORTAL.directory.metaTitle, PORTAL.directory.metaDescription],
    ['categories', SITE.industries.metaTitle, SITE.industries.metaDescription],
    ['how it works', SITE.how.metaTitle, SITE.how.metaDescription],
    ['guides', MARKETING.guides.metaTitle, MARKETING.guides.metaDescription],
    ['register', SITE.register.metaTitle, SITE.register.metaDescription],
    ['features', SITE.features.metaTitle, SITE.features.metaDescription],
  ];
  test('the home title is the owner default, used as written', () => {
    assert.equal(SITE.home.metaTitle, DEFAULT);
    const m = siteMetadata({ title: SITE.home.metaTitle, description: SITE.home.metaDescription, path: '/' });
    assert.deepEqual(m.title, { absolute: DEFAULT });
    assert.equal((m.openGraph as { title: string }).title, DEFAULT);
    assert.equal((m.twitter as { title: string }).title, DEFAULT);
  });
  test('every page has its own title and description, and a sensible length', () => {
    assert.equal(new Set(pages.map((p) => p[1])).size, pages.length, 'titles are unique');
    assert.equal(new Set(pages.map((p) => p[2])).size, pages.length, 'descriptions are unique');
    for (const [name, title, desc] of pages) {
      if (name !== 'home') assert.ok(brandedTitle(title).length <= 60 || brandedTitle(title) === title, name);
      assert.ok(desc.length >= 60 && desc.length <= 175, `${name} description ${desc.length}`);
    }
  });
  test('Open Graph and Twitter carry the same title and description as the page', () => {
    const m = siteMetadata({ title: 'Pro plans: business website and web app', description: 'A description of enough length to pass.', path: '/pricing' });
    const og = m.openGraph as { title: string; description: string; siteName: string };
    const tw = m.twitter as { card: string; title: string; description: string };
    assert.equal(og.title, (m.title as { absolute: string }).absolute);
    assert.equal(tw.title, og.title);
    assert.equal(tw.description, og.description);
    assert.equal(tw.card, 'summary_large_image');
    assert.equal(og.siteName, 'Get4Domain');
  });
  test('the named keywords appear in the metadata of the site', () => {
    const text = pages.map((p) => `${p[1]} ${p[2]}`).join(' ').toLowerCase();
    for (const k of ['local business directory', 'domain search', 'business website', 'business web app', 'enquiries', 'domain directory']) {
      assert.ok(text.includes(k) || (k === 'domain directory' && text.includes('business and domain directory')), k);
    }
    const kw = siteConfig.keywords.join(' ');
    for (const k of ['local business directory', 'domain directory', 'domain search', 'business website', 'business web app', 'enquiries']) assert.ok(kw.includes(k), `keyword ${k}`);
  });
  test('the brand strings, manifest and site structured data match', () => {
    assert.equal(BRAND_TITLE, DEFAULT);
    assert.match(BRAND_DESCRIPTION, /local business and domain directory/);
    assert.doesNotMatch(`${BRAND_DESCRIPTION} ${siteConfig.description} ${siteConfig.ogImage.alt}`, /\bleads?\b|₹|trusted by/i);
    const man = manifest();
    assert.equal(man.short_name, 'Get4Domain');
    assert.match(man.description ?? '', /domain names/);
    assert.match(man.name ?? '', /^Get4Domain \| Local business and domain directory/);
  });
  test('the WebSite block has a search action to the directory search, only when the directory address is set', () => {
    const saved = { m: process.env.MAIN_HOST, d: process.env.DIRECTORY_HOST };
    try {
      process.env.MAIN_HOST = 'main.example.invalid';
      process.env.DIRECTORY_HOST = 'directory.main.example.invalid';
      const w = webSiteLd() as { potentialAction?: { '@type': string; target: { urlTemplate: string }; 'query-input': string } };
      assert.equal(w.potentialAction?.['@type'], 'SearchAction');
      assert.equal(w.potentialAction?.target.urlTemplate, 'https://directory.main.example.invalid/search?q={search_term_string}');
      assert.equal(w.potentialAction?.['query-input'], 'required name=search_term_string');
      assert.match(JSON.stringify(organizationLd()), /local business and domain directory/);
      delete process.env.DIRECTORY_HOST;
      assert.equal((webSiteLd() as { potentialAction?: unknown }).potentialAction, undefined);
    } finally {
      if (saved.m === undefined) delete process.env.MAIN_HOST; else process.env.MAIN_HOST = saved.m;
      if (saved.d === undefined) delete process.env.DIRECTORY_HOST; else process.env.DIRECTORY_HOST = saved.d;
    }
  });
});

describe('P6.3 hero', () => {
  test('kicker, headline and sub line are the owner wording', () => {
    assert.equal(PORTAL.home.eyebrow.toUpperCase(), 'LOCAL BUSINESS DIRECTORY, DOMAIN SEARCH AND WEB APP');
    assert.equal(PORTAL.home.h1, 'Get4Domain: get your business online, found and getting enquiries.');
    assert.equal(PORTAL.home.lead, 'Search local businesses and domain names on the Get4Domain directory. Every business gets a website, business tools and promotion run by our team, in one Pro plan.');
  });
});

describe('P6.4 to P6.6 labels, sections and questions', () => {
  const svc = (k: string) => GROWTH_SERVICES.find((s) => s.key === k)!;
  test('the three labels, and the three groups with their labels', () => {
    assert.equal(GROWTH_STATUS_LABEL.pro, 'Included in Pro');
    assert.equal(GROWTH_STATUS_LABEL.addon, 'Add-on pack, price on request');
    assert.deepEqual(GROWTH_GROUPS.map((g) => g.label), ['Included in Pro', 'Included in Pro', 'Add-on pack, price on request']);
  });
  test('group (a) holds the owner list, in Included in Pro', () => {
    const run = GROWTH_SERVICES.filter((s) => s.group === 'run');
    assert.deepEqual(run.map((s) => s.key), ['campaigns', 'promotion', 'seo', 'spotlight', 'meta', 'analytics', 'merchant', 'reels', 'poster', 'posts', 'blogs', 'writing']);
    assert.ok(run.every((s) => s.statuses.join() === 'pro'));
    assert.equal(svc('merchant').plans, 'ecommerce');
    assert.equal(svc('reels').note, 'On the annual plan');
    assert.match(GROWTH_GROUPS[0].blurb, /with a monthly or yearly allowance by plan/);
  });
  test('group (b) lists only tools the vendor app has working; none of the unbuilt ones', () => {
    assert.deepEqual(GROWTH_SERVICES.filter((s) => s.group === 'tools').map((s) => s.key), ['sub-site', 'tools', 'enquiries', 'billing', 'team']);
    const names = GROWTH_SERVICES.map((s) => s.name.toLowerCase()).join(' | ');
    for (const gone of ['campaign builder', 'social posting', 'design studio', 'reports', 'automated']) assert.ok(!names.includes(gone), gone);
  });
  test('group (c) is the custom domain pack with a price on request and a link to the contact page', () => {
    assert.deepEqual(GROWTH_SERVICES.filter((s) => s.group === 'addon').map((s) => s.key), ['cd-seo', 'cd-social', 'cd-hub']);
    assert.equal(GROWTH.addonHref, '/contact');
    assert.match(GROWTH.addonBody, /price is on request/);
  });
  test('How you get found has the four steps, and Business tools has a heading', () => {
    assert.deepEqual(GROWTH.find.map((s) => s.title), ['Directory pages by category and area', 'Your Get4Domain subdomain', 'Campaigns run by Get4Domain', 'Enquiries captured in your business app']);
    assert.equal(GROWTH.findHeading, 'How you get found');
    assert.equal(GROWTH.toolsHeading, 'Business tools');
  });
  test('the two new questions are on the growth page and on pricing, with no guarantee and no chat assistant', () => {
    for (const faq of [GROWTH.faq, SITE.pricing.faq]) {
      const a = faq.find((f) => f.q === 'What does Get4Domain promote for me?');
      const b = faq.find((f) => f.q === 'What is the custom domain pack?');
      assert.ok(a && b);
      assert.match(a.a, /cannot promise/);
      assert.match(b.a, /price is on request/);
    }
    assert.doesNotMatch(JSON.stringify([GROWTH.faq, SITE.pricing.faq]), /chat assistant|live chat|chatbot/i);
    assert.match(SITE.pricing.faq.find((f) => f.q === 'How does the Free plan work?')!.a, /Pro plans/);
  });
});
