import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fromDomainAvailability, handleDomainAvailability, mockDomainAnswer } from '../domain-availability';
import { ABOUT_STRINGS, CONTACT_STRINGS } from '../company-strings';
import { GROWTH } from '../growth-strings';
import { MARKETING } from '../marketing-strings';
import { fetchSuggest, fromSuggest, resolveSearch, searchDirectory, toResultItem } from '../portal-search';
import { PORTAL } from '../portal-strings';
import { checkoutNextPath, categoriesForTrack, familyLabel, groupByFamily, planAfterPick, signInWithNext, type CatOption, type PlanChoice } from '../register-plan';
import { duplicateAskOf, duplicateClaimOf, gstinOk, pincodeOk, validateRegister, type RegisterInput } from '../register';
import { handleRegister, parseRegisterBody, siteCreatedOf } from '../register-proxy';
import { SITE } from '../site-strings';

const req = new Request('http://localhost/x');

describe('P5.1 search: suggest answer and the typed place', () => {
  test('the suggest answer keeps businesses (with id), categories and places, and drops rows without a name or slug', () => {
    const s = fromSuggest({ q: 'plu', businesses: [{ id: 'b-1', slug: 'a', name: 'A', category: 'Plumbers', city: 'Chennai' }, { slug: '', name: 'x' }], categories: [{ slug: 'plumbers', name: 'Plumbers', kind: 'category', parent: null }, { slug: 'pipe', name: 'Pipe fitting', kind: 'subcategory', parent: 'Plumbers' }], places: [{ slug: 'adyar', name: 'Adyar', kind: 'LOCALITY', path: 'tamil-nadu/chennai/adyar', label: 'Adyar, Chennai' }, { name: 'no path' }] });
    assert.equal(s.businesses.length, 1);
    assert.equal(s.businesses[0].id, 'b-1');
    assert.equal(s.categories[1].kind, 'subcategory');
    assert.equal(s.places.length, 1);
    assert.deepEqual(fromSuggest(null), { q: '', businesses: [], categories: [], places: [] });
  });
  test('the wrapped { data } answer is read too', () => assert.equal(fromSuggest({ data: { categories: [{ slug: 'x', name: 'X' }] } }).categories.length, 1));
  test('under two letters nothing is asked and nothing is returned', async () => {
    const r = await fetchSuggest('p', ['business', 'category', 'place']);
    assert.equal(r.kind, 'ok');
    if (r.kind === 'ok') assert.deepEqual(r.data.businesses, []);
  });
  test('sample mode suggests businesses, categories and places by the wanted kinds only', async () => {
    const r = await fetchSuggest('adyar', ['place']);
    assert.equal(r.kind, 'ok');
    if (r.kind === 'ok') { assert.ok(r.data.places.length > 0); assert.deepEqual(r.data.businesses, []); assert.deepEqual(r.data.categories, []); }
    const b = await fetchSuggest('plumbing', ['business']);
    if (b.kind === 'ok') assert.ok(b.data.businesses.length > 0 && b.data.businesses[0].id);
  });
  test('a result carries the business id', () => assert.equal(toResultItem({ id: 'b-9', slug: 's', name: 'N' })?.id, 'b-9'));
  test('a result without an id has none (never made up)', () => assert.equal(toResultItem({ slug: 's', name: 'N' })?.id, null));
  test('a typed place and a pincode are sent to the backend as typed', () => {
    assert.equal(resolveSearch(null, { what: 'plumber', where: 'Adyar Chennai' }).location, 'Adyar Chennai');
    const p = resolveSearch(null, { where: '600 020' });
    assert.equal(p.location, '600020');
    assert.equal(p.pincode, true);
  });
  test('the backend word locationUnknown reaches the screen; a known place does not carry it', async () => {
    const unknown = await searchDirectory(resolveSearch(null, { what: 'plumber', where: 'Atlantis' }), 1);
    assert.equal(unknown.kind === 'ok' && unknown.data.locationUnknown, true);
    const known = await searchDirectory(resolveSearch(null, { what: 'plumbing', where: 'Adyar' }), 1);
    assert.equal(known.kind === 'ok' && known.data.locationUnknown, false);
  });
});

describe('P5.2 domain search: never available unless the API says so', () => {
  const ok = { name: 'acme', subdomain: { state: 'AVAILABLE', name: 'acme', message: 'm', similarTo: null }, customDomain: { state: 'REGISTRAR_OFF', registrar: 'OFF', message: 'm', results: [] } };
  test('available subdomain and registrar off', () => {
    const a = fromDomainAvailability(ok);
    assert.equal(a.ok, true);
    assert.equal(a.subdomain?.state, 'AVAILABLE');
    assert.equal(a.subdomain?.name, 'acme');
    assert.equal(a.custom?.state, 'REGISTRAR_OFF');
    assert.equal(a.custom?.registrarOn, false);
  });
  test('taken has no name to create, and the similar-name warning is kept', () => {
    const a = fromDomainAvailability({ ...ok, subdomain: { state: 'TAKEN', name: 'acme', similarTo: 'acme-co' } });
    assert.equal(a.subdomain?.state, 'TAKEN');
    assert.equal(a.subdomain?.name, null);
    assert.equal(a.subdomain?.similarTo, 'acme-co');
  });
  test('an unknown or missing state is never read as available', () => {
    assert.equal(fromDomainAvailability({ subdomain: { state: 'MAYBE' }, customDomain: { state: 'SURE' } }).ok, false);
    assert.equal(fromDomainAvailability(null).ok, false);
    assert.equal(fromDomainAvailability({ available: true }).ok, false);
    assert.equal(fromDomainAvailability({ subdomain: { state: 'AVAILABLE' } }).custom, null);
  });
  test('registrar results keep their own states; an odd result state is UNKNOWN', () => {
    const a = fromDomainAvailability({ ...ok, customDomain: { state: 'AVAILABLE', registrar: 'ON', results: [{ domain: 'acme.in', state: 'AVAILABLE' }, { domain: 'acme.com', state: 'WHO KNOWS' }] } });
    assert.equal(a.custom?.registrarOn, true);
    assert.deepEqual(a.custom?.results.map((r) => r.state), ['AVAILABLE', 'UNKNOWN']);
  });
  test('sample mode: a taken label, a free label, a bad label; the registrar is off', () => {
    assert.equal(mockDomainAnswer('sample-pro').subdomain?.state, 'TAKEN');
    assert.equal(mockDomainAnswer('fresh-name').subdomain?.state, 'AVAILABLE');
    assert.equal(mockDomainAnswer('-bad-').subdomain?.state, 'INVALID');
    assert.equal(mockDomainAnswer('fresh-name.com').custom?.state, 'REGISTRAR_OFF');
  });
  test('nothing typed is not asked and not answered', async () => assert.equal((await handleDomainAvailability(req, '  ')).ok, false));
});

const good: RegisterInput = {
  businessName: 'Acme', categoryKey: 'plumber', industry: 'field_service', subdomain: 'acme-co', name: 'A', email: 'a@example.invalid', phone: '', password: 'Password1', acceptedTerms: true,
  plan: 'handyman', termMonths: 12, city: 'Chennai', area: 'Adyar', pincode: '600020', gstin: '', confirmDistinct: false,
};

describe('P5.3 register: city, area, pincode, GSTIN and "Is this your business?"', () => {
  test('city, area and pincode are required; GSTIN is optional but checked when given', () => {
    assert.deepEqual(validateRegister(good), {});
    assert.deepEqual(Object.keys(validateRegister({ ...good, city: '', area: ' ', pincode: '60' })).sort(), ['area', 'city', 'pincode']);
    assert.equal(validateRegister({ ...good, gstin: '33ABCDE1234F1Z5' }).gstin, undefined);
    assert.equal(validateRegister({ ...good, gstin: 'short' }).gstin, 'gstin');
  });
  test('pincode and GSTIN shapes', () => {
    assert.equal(pincodeOk('600020'), true);
    assert.equal(pincodeOk('060020'), false);
    assert.equal(pincodeOk('6000200'), false);
    assert.equal(gstinOk(''), true);
    assert.equal(gstinOk('33abcde1234f1z5'), true);
  });
  test('the body is parsed with the new fields, spaces closed in the pincode and GSTIN upper-cased', () => {
    const i = parseRegisterBody({ ...good, pincode: '600 020', gstin: '33abcde1234f1z5', confirmDistinct: true });
    assert.equal(i.pincode, '600020');
    assert.equal(i.gstin, '33ABCDE1234F1Z5');
    assert.equal(i.confirmDistinct, true);
    assert.equal(parseRegisterBody({ ...good, confirmDistinct: 'yes' }).confirmDistinct, false);
  });
  const dup = { status: 409, json: { message: 'm', code: 'DUPLICATE_POSSIBLE', candidates: [{ slug: 'sri-murugan-plumbing', name: 'Sri Murugan Plumbing', category: 'Plumbers', city: 'Chennai', area: 'Adyar', claimable: true }, { slug: 'Bad Slug', name: 'x' }], claim: { businessSlug: 'sri-murugan-plumbing', startPath: '/v3/claim/start' } } };
  test('a 409 DUPLICATE_POSSIBLE gives the public listing facts and the claim slug; nothing else', () => {
    const a = duplicateAskOf(dup.status, dup.json);
    assert.equal(a?.candidates.length, 1);
    assert.equal(a?.candidates[0].claimable, true);
    assert.equal(a?.claimSlug, 'sri-murugan-plumbing');
    assert.equal(duplicateAskOf(200, dup.json), null);
    assert.equal(duplicateAskOf(409, { code: 'DUPLICATE_BUSINESS' }), null);
    assert.equal(duplicateAskOf(409, { code: 'DUPLICATE_POSSIBLE', candidates: [] }), null);
  });
  test('a 409 DUPLICATE_BUSINESS gives only the claim slug', () => {
    assert.equal(duplicateClaimOf(409, { code: 'DUPLICATE_BUSINESS', claim: { businessSlug: 'x-y' } }), 'x-y');
    assert.equal(duplicateClaimOf(409, { code: 'DUPLICATE_BUSINESS', claim: null }), null);
  });
  test('sample mode: a likely duplicate asks first, "a different business" then goes through', async () => {
    const first = await handleRegister(req, { ...good, businessName: 'Adyar Plumbing House' });
    assert.equal(first.ok, false);
    assert.equal(first.duplicate?.candidates[0].slug, 'sri-murugan-plumbing');
    const second = await handleRegister(req, { ...good, businessName: 'Adyar Plumbing House', confirmDistinct: true });
    assert.equal(second.ok, true);
  });
  test('the site is called created only when the answer says so', () => {
    assert.equal(siteCreatedOf({ data: { site: { status: 'LIVE', published: false } } }), true);
    assert.equal(siteCreatedOf({ site: { published: true } }), true);
    assert.equal(siteCreatedOf({ site: { status: 'FAILED' } }), false);
    assert.equal(siteCreatedOf({ site: { status: 'NOT_SWITCHED_ON' } }), false);
    assert.equal(siteCreatedOf({}), false);
  });
});

const cat = (key: string, name: string, family: string, track: CatOption['track']): CatOption => ({ key, name, industry: family, family, track });
const LIST: CatOption[] = [cat('plumber', 'Plumber', 'FIELD_SERVICE', 'handyman'), cat('electrician', 'Electrician', 'FIELD_SERVICE', 'handyman'), cat('ca', 'Chartered accountant', 'PRACTICE_LEGAL_FINANCE', 'professional'), cat('store', 'General store', 'RETAIL', 'ecommerce'), cat('odd', 'Odd one', 'OTHER', null)];
const PLANS: PlanChoice[] = [
  { key: 'handyman', name: 'Handyman', track: 'handyman', pending: false, monthly: { 12: '₹300' }, total: { 12: '₹3,600' } },
  { key: 'professional', name: 'Professional', track: 'professional', pending: false, monthly: { 12: '₹600' }, total: { 12: '₹7,200' } },
];

describe('P5.9 category picker by track', () => {
  test('a Pro plan lists only its track', () => {
    assert.deepEqual(categoriesForTrack(LIST, 'handyman').map((c) => c.key), ['plumber', 'electrician']);
    assert.deepEqual(categoriesForTrack(LIST, 'professional').map((c) => c.key), ['ca']);
  });
  test('grouped by family, names in order, only what the search matches', () => {
    const g = groupByFamily(LIST, '');
    assert.deepEqual(g.map((x) => x.family), ['Field service', 'Other', 'Practice legal finance', 'Retail']);
    assert.deepEqual(g[0].items.map((c) => c.name), ['Electrician', 'Plumber']);
    assert.deepEqual(groupByFamily(LIST, 'plum').map((x) => x.items.map((c) => c.key)), [['plumber']]);
    assert.deepEqual(groupByFamily(LIST, 'field').flatMap((x) => x.items.map((c) => c.key)).sort(), ['electrician', 'plumber']);
    assert.deepEqual(groupByFamily(LIST, 'zzz'), []);
  });
  test('family labels read as words', () => { assert.equal(familyLabel('FIELD_SERVICE'), 'Field service'); assert.equal(familyLabel('Rentals and fleet'), 'Rentals and fleet'); assert.equal(familyLabel(''), 'Other'); });
  test('a category of another track switches the plan to that track, only when the price list has it', () => {
    const r = planAfterPick(PLANS, 'handyman', LIST[2]);
    assert.equal(r.switched, true);
    assert.equal(r.plan?.key, 'professional');
    assert.equal(planAfterPick(PLANS, 'handyman', LIST[3]).switched, false); // no ecommerce plan in this list
    assert.equal(planAfterPick(PLANS, 'handyman', LIST[0]).switched, false);
    assert.equal(planAfterPick(PLANS, 'handyman', LIST[4]).switched, false); // a category with no track never moves the plan
  });
});

describe('P5.10 continue to payment keeps the plan and term', () => {
  test('the checkout address carries a known plan and term only', () => {
    assert.equal(checkoutNextPath('professional', 12), '/app/more/plan?plan=professional&term=12');
    assert.equal(checkoutNextPath('free', 12), '/app/more/plan?term=12');
    assert.equal(checkoutNextPath('handyman', 5), '/app/more/plan?plan=handyman');
  });
  test('the sign-in link carries it as next; no vendor app address or a bad one gives no link', () => {
    const u = new URL(signInWithNext('https://app.example.invalid', 'professional', 12) as string);
    assert.equal(u.pathname, '/login');
    assert.equal(u.searchParams.get('next'), '/app/more/plan?plan=professional&term=12');
    assert.equal(signInWithNext(null, 'professional', 12), null);
    assert.equal(signInWithNext('javascript:alert(1)', 'professional', 12), null);
  });
});

describe('P5.7 and P5.8 wording', () => {
  const all: Array<{ path: string; text: string }> = [];
  const walk = (v: unknown, path: string): void => {
    if (typeof v === 'string') all.push({ path, text: v });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  walk(SITE, 'SITE'); walk(PORTAL, 'PORTAL'); walk(GROWTH, 'GROWTH'); walk(MARKETING, 'MARKETING'); walk(ABOUT_STRINGS, 'ABOUT'); walk(CONTACT_STRINGS, 'CONTACT');
  test('"Paid plans", "See paid plans" and "Move to a paid plan" are gone from the public site copy', () => {
    const hits = all.filter((s) => /\bPaid plans\b|\bSee paid plans\b|\bMove to a paid plan\b/.test(s.text)).map((s) => `${s.path}: ${s.text}`);
    assert.deepEqual(hits, []);
  });
  test('the Pro names are in place', () => {
    assert.equal(SITE.pricing.plansHeading, 'Pro plans');
    assert.equal(SITE.pricing.free.ctaPaid, 'See Pro plans');
    assert.equal(GROWTH.footerSeePlans, 'Pro plans');
    assert.equal(SITE.pricing.free.unlockHeading, 'Move to a Pro plan to unlock');
  });
  test('the Pro register strings never say "free site" or "Chosen plan"', () => {
    const pro = all.filter((s) => s.path.startsWith('SITE.register.pro') || s.path.startsWith('SITE.register.picker') || s.path.startsWith('SITE.register.duplicate') || s.path.startsWith('SITE.register.done.pro') || s.path === 'SITE.register.hints.subdomainPro');
    assert.ok(pro.length > 15);
    assert.deepEqual(pro.filter((s) => /free site|chosen plan|free plan/i.test(s.text)), []);
    assert.equal(SITE.register.pro.submit, 'Continue to payment');
    assert.equal(SITE.register.pro.title, 'Create your account for {plan}');
    assert.equal(SITE.register.submit, 'Create my account');
  });
});
