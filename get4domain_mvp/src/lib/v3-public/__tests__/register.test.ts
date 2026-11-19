import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MOCK_CATEGORIES, PACKS, categoriesByPack } from '../packs';
import { DEFAULT_TRACK, TRACKS, cleanSubdomain, trackOfTier, mapRegisterFailure, messagesOf, passwordOk, phoneOk, subdomainProblem, subdomainStateOf, validateRegister, type RegisterInput } from '../register';
import { MOCK_REGISTER_HANDOFF, MOCK_TAKEN_EMAIL_REGISTER, handleRegister, handleSubdomainCheck, parseRegisterBody, siteStateOf, trackFor } from '../register-proxy';
import { SITE } from '../site-strings';

const good: RegisterInput = {
  businessName: 'Sri Murugan Plumbing', categoryKey: 'plumber', industry: 'field_service', subdomain: 'sri-murugan', name: 'Murugan', email: 'owner@example.invalid', phone: '',
  password: 'Password1', acceptedTerms: true, plan: 'professional', termMonths: 12,
  city: 'Chennai', area: 'Adyar', pincode: '600020', gstin: '', confirmDistinct: false,
};
const req = new Request('http://localhost/x');
const body = (o: Partial<RegisterInput> = {}): Record<string, unknown> => ({ ...good, ...o });

describe('the form rules', () => {
  test('a complete form has no problems', () => assert.deepEqual(validateRegister(good), {}));
  test('every field is checked and all problems come back together', () => {
    const e = validateRegister({ ...good, businessName: ' ', categoryKey: '', subdomain: '', name: '', email: 'nope', phone: 'abc', password: 'short', acceptedTerms: false });
    assert.deepEqual(Object.keys(e).sort(), ['businessName', 'category', 'email', 'owner', 'password', 'phone', 'subdomain', 'terms']);
  });
  test('password: 8 or more, a capital letter and a number', () => {
    for (const bad of ['Short1', 'alllowercase1', 'NoDigitsHere', '']) assert.equal(passwordOk(bad), false, bad);
    assert.equal(passwordOk('Password1'), true);
  });
  test('phone is optional and plain', () => {
    assert.equal(phoneOk(''), true);
    assert.equal(phoneOk('+91 98765 43210'), true);
    assert.equal(phoneOk('98765-43210'), true);
    for (const bad of ['1', 'call me', '+', '12345678901234567890123']) assert.equal(phoneOk(bad), false, bad);
  });
});

describe('the site address', () => {
  test('shape', () => {
    assert.equal(subdomainProblem('sri-murugan'), null);
    assert.equal(subdomainProblem('  SRI-Murugan '), null, 'trimmed and lower cased');
    assert.equal(subdomainProblem(''), 'subdomain');
    assert.equal(subdomainProblem('ab'), 'subdomainShort');
    for (const bad of ['-start', 'end-', 'a--b', 'has space', 'under_score', 'dot.ted', 'ü-umlaut', 'a'.repeat(41)]) assert.equal(subdomainProblem(bad), 'subdomainInvalid', bad);
  });
  test('reserved names are refused with their own message, including V2 client names', () => {
    for (const r of ['api', 'app', 'admin', 'gapi', 'directory', 'media', 'mail', 'send', 'www', 'mrtravels', 'stepnrock']) assert.equal(subdomainProblem(r), 'subdomainReserved', r);
  });
  test('cleaning', () => assert.equal(cleanSubdomain('  AbC '), 'abc'));
  test('the answer of the availability route to a state', () => {
    assert.equal(subdomainStateOf(200, { available: true }), 'available');
    assert.equal(subdomainStateOf(200, { data: { available: true } }), 'available');
    assert.equal(subdomainStateOf(200, { available: false, reason: 'UNAVAILABLE' }), 'taken');
    assert.equal(subdomainStateOf(200, { data: { available: true, name: 'abc', reason: 'AVAILABLE', message: 'ok' } }), 'available');
    assert.equal(subdomainStateOf(200, { available: false, reason: 'RESERVED' }), 'reserved');
    assert.equal(subdomainStateOf(200, { available: false, reason: 'INVALID' }), 'invalid');
    assert.equal(subdomainStateOf(200, { available: false, reason: 'TOO_SHORT' }), 'short');
    assert.equal(subdomainStateOf(200, { available: false }), 'taken');
    for (const s of [404, 405, 500]) assert.equal(subdomainStateOf(s, {}), 'unknown', String(s));
    assert.equal(subdomainStateOf(200, {}), 'unknown');
  });
  test('the server answers local rules without the API and samples in mock mode', async () => {
    assert.deepEqual(await handleSubdomainCheck(req, 'api'), { state: 'reserved' });
    assert.deepEqual(await handleSubdomainCheck(req, 'ab'), { state: 'short' });
    assert.deepEqual(await handleSubdomainCheck(req, 'bad name'), { state: 'invalid' });
    assert.deepEqual(await handleSubdomainCheck(req, 'taken-site'), { state: 'taken' });
    assert.deepEqual(await handleSubdomainCheck(req, 'fresh-shop'), { state: 'available' });
  });
});

describe('API refusals become field errors in plain words', () => {
  test('a list of validation sentences maps to their fields', () => {
    const f = mapRegisterFailure(400, { statusCode: 400, message: ['Password must include an uppercase letter and a number', 'email must be an email', 'businessName should not be empty'] });
    assert.deepEqual(f, { fields: { password: 'password', email: 'email', businessName: 'businessName' }, general: null });
  });
  test('a single sentence, plain or wrapped', () => {
    assert.deepEqual(mapRegisterFailure(400, { message: 'Phone number is not valid' }).fields, { phone: 'phone' });
    assert.deepEqual(mapRegisterFailure(400, { data: { message: 'Terms must be accepted' } }).fields, { terms: 'terms' });
  });
  test('the address: taken, reserved, short, invalid, by words or by code', () => {
    assert.deepEqual(mapRegisterFailure(409, { message: 'That subdomain is already taken' }).fields, { subdomain: 'subdomainTaken' });
    assert.deepEqual(mapRegisterFailure(400, { message: 'This subdomain is reserved' }).fields, { subdomain: 'subdomainReserved' });
    assert.deepEqual(mapRegisterFailure(400, { message: 'subdomain must be at least 3 characters' }).fields, { subdomain: 'subdomainShort' });
    assert.deepEqual(mapRegisterFailure(400, { message: 'subdomain has invalid characters' }).fields, { subdomain: 'subdomainInvalid' });
    assert.deepEqual(mapRegisterFailure(400, { code: 'SUBDOMAIN_RESERVED', message: 'Not allowed' }).fields, { subdomain: 'subdomainReserved' });
    assert.deepEqual(mapRegisterFailure(409, { code: 'SUBDOMAIN_TAKEN' }).fields, { subdomain: 'subdomainTaken' });
    // Wave 3 codes: 409 HOST_UNAVAILABLE is a taken address (never the email message), 400 SUBDOMAIN_INVALID / SUBDOMAIN_RESERVED
    assert.deepEqual(mapRegisterFailure(409, { code: 'HOST_UNAVAILABLE', message: 'Host unavailable' }).fields, { subdomain: 'subdomainTaken' });
    assert.deepEqual(mapRegisterFailure(409, { success: false, statusCode: 409, code: 'HOST_UNAVAILABLE' }).fields, { subdomain: 'subdomainTaken' });
    assert.deepEqual(mapRegisterFailure(400, { code: 'SUBDOMAIN_INVALID' }).fields, { subdomain: 'subdomainInvalid' });
    assert.deepEqual(mapRegisterFailure(400, { code: 'SUBDOMAIN_RESERVED' }).fields, { subdomain: 'subdomainReserved' });
  });
  test('email already registered, with or without words', () => {
    assert.deepEqual(mapRegisterFailure(409, { message: 'Email already registered' }).fields, { email: 'emailTaken' });
    assert.deepEqual(mapRegisterFailure(409, {}).fields, { email: 'emailTaken' });
  });
  test('category and owner name', () => {
    assert.deepEqual(mapRegisterFailure(400, { message: ['industry must be a string'] }).fields, { category: 'category' });
    assert.deepEqual(mapRegisterFailure(400, { message: ['name must be a string'] }).fields, { owner: 'owner' });
  });
  test('a sentence naming no field is the one general message, never the API sentence', () => {
    assert.deepEqual(mapRegisterFailure(400, { message: 'Something odd' }), { fields: {}, general: 'general' });
    assert.deepEqual(mapRegisterFailure(500, {}), { fields: {}, general: 'server' });
  });
  test('rate limit, and an API that is missing or down', () => {
    assert.deepEqual(mapRegisterFailure(429, {}), { fields: {}, general: 'rate' });
    for (const s of [0, 404, 405, 501, 502, 503, 504]) assert.deepEqual(mapRegisterFailure(s, {}), { fields: {}, general: 'notAvailable' }, String(s));
  });
  test('every key it can return has words', () => {
    const keys = new Set<string>();
    for (const s of [400, 409, 429, 0, 500]) for (const j of [{}, { message: 'x' }, { message: ['password', 'email already', 'phone', 'business name', 'category', 'terms', 'name', 'subdomain reserved'] }]) {
      const f = mapRegisterFailure(s, j);
      Object.values(f.fields).forEach((k) => keys.add(k as string));
      if (f.general) keys.add(f.general);
    }
    for (const k of keys) assert.ok((SITE.register.errors as Record<string, string>)[k], k);
  });
  test('a business that exists, a likely duplicate, mail off and a server error each have their own words', () => {
    assert.deepEqual(mapRegisterFailure(409, { code: 'DUPLICATE_BUSINESS', message: 'x' }), { fields: {}, general: 'businessDuplicate' });
    assert.deepEqual(mapRegisterFailure(409, { success: false, data: { code: 'DUPLICATE_BUSINESS' } }), { fields: {}, general: 'businessDuplicate' });
    assert.deepEqual(mapRegisterFailure(409, { code: 'DUPLICATE_POSSIBLE' }), { fields: {}, general: 'businessPossible' });
    for (const c of ['MAIL_DISABLED', 'EMAIL_NOT_CONFIGURED', 'EMAIL_NOT_LIVE']) assert.deepEqual(mapRegisterFailure(503, { code: c }), { fields: {}, general: 'mailNotReady' }, c);
    assert.deepEqual(mapRegisterFailure(500, { message: 'Internal server error' }), { fields: {}, general: 'server' });
    assert.deepEqual(mapRegisterFailure(409, { message: 'A vendor with this email already exists' }).fields, { email: 'emailTaken' });
    assert.deepEqual(mapRegisterFailure(400, { message: ['Password must be at least 8 characters'] }).fields, { password: 'password' });
  });
  test('a duplicate answer never leaks the other business: no name, candidate, id or phone reaches the result or the words', () => {
    const leak = { code: 'DUPLICATE_POSSIBLE', message: 'x', data: { candidates: [{ businessName: 'Secret Traders', phone: '9876543210', vendorId: 'v-123' }], claim: { token: 'tok' } } };
    const f = mapRegisterFailure(409, leak);
    const text = JSON.stringify(f) + SITE.register.errors[f.general!];
    assert.doesNotMatch(text, /Secret|9876543210|v-123|tok|candidates/);
    const own = JSON.stringify([SITE.register.errors.businessDuplicate, SITE.register.errors.businessPossible]);
    assert.doesNotMatch(own, /\d{6,}|@/);
  });
  test('every general message is honest in tone: none says the account or site exists, none is the old catch-all for a server error', () => {
    const e = SITE.register.errors;
    assert.notEqual(e.server, e.general);
    assert.notEqual(e.fieldsSummary, e.general);
    for (const k of ['businessDuplicate', 'businessPossible', 'mailNotReady', 'server'] as const) assert.ok(e[k].length > 20, k);
  });
  test('messagesOf reads strings and lists, plain or wrapped', () => {
    assert.deepEqual(messagesOf({ message: 'a' }), ['a']);
    assert.deepEqual(messagesOf({ message: ['a', 'b', 3] }), ['a', 'b']);
    assert.deepEqual(messagesOf({ data: { message: 'c' } }), ['c']);
    assert.deepEqual(messagesOf(null), []);
  });
});

describe('the register call in mock mode', () => {
  test('a good form is accepted and hands off', async () => {
    assert.deepEqual(await handleRegister(req, body()), { ok: true, fields: {}, general: null, handoff: MOCK_REGISTER_HANDOFF, site: 'pending', siteCreated: false, duplicate: null, claimSlug: null });
  });
  test('the server checks the form again', async () => {
    const r = await handleRegister(req, body({ password: 'weak', acceptedTerms: false }));
    assert.equal(r.ok, false);
    assert.deepEqual(r.fields, { password: 'password', terms: 'terms' });
  });
  test('a taken address and a taken email', async () => {
    assert.deepEqual((await handleRegister(req, body({ subdomain: 'taken-site' }))).fields, { subdomain: 'subdomainTaken' });
    assert.deepEqual((await handleRegister(req, body({ email: MOCK_TAKEN_EMAIL_REGISTER }))).fields, { email: 'emailTaken' });
  });
  test('a reserved address is refused before any call', async () => {
    assert.deepEqual((await handleRegister(req, body({ subdomain: 'admin' }))).fields, { subdomain: 'subdomainReserved' });
  });
  test('the body is read defensively: unknown plan is free, unknown term is none, wrong types are empty', () => {
    const p = parseRegisterBody({ ...good, plan: 'gold', termMonths: 7 });
    assert.equal(p.plan, 'free');
    assert.equal(p.termMonths, null);
    const q = parseRegisterBody({ businessName: 5, email: {}, acceptedTerms: 'true' });
    assert.equal(q.businessName, '');
    assert.equal(q.email, '');
    assert.equal(q.acceptedTerms, false);
  });
  test('the answer never carries the password or a token', async () => {
    const text = JSON.stringify(await handleRegister(req, body()));
    assert.doesNotMatch(text, /Password1|accessToken|token/i);
  });
});

describe('the site state of a registration answer', () => {
  test('only the API saying published makes it live; anything else is pending', () => {
    assert.equal(siteStateOf({ data: { site: { published: true } } }), 'live');
    assert.equal(siteStateOf({ site: { published: true } }), 'live');
    for (const j of [null, {}, { data: { accessToken: 't', user: { subdomain: 'x' } } }, { data: { site: { published: false } } }, { data: { site: 'live' } }]) assert.equal(siteStateOf(j), 'pending', JSON.stringify(j));
  });
  test('the real registration answer of today (token and user only) is pending, and the result never says live', async () => {
    const saved = { fetch: globalThis.fetch, mocks: process.env.V3_PUBLIC_USE_MOCKS, base: process.env.API_BASE_URL };
    process.env.V3_PUBLIC_USE_MOCKS = 'false'; process.env.API_BASE_URL = 'http://api.invalid';
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      const json = u.endsWith('/auth/register') ? { data: { accessToken: 'tok-1', user: { subdomain: 'x' } } } : u.endsWith('/v3/public/pack-categories') ? { success: true, data: [{ categoryKey: 'plumber', name: 'Plumber', family: 'FIELD_SERVICE', packKey: 'FIELD_SERVICE', minTier: 'HANDYMAN' }] } : {};
      return new Response(JSON.stringify(json), { status: u.endsWith('/auth/register') || u.endsWith('/pack-categories') ? (u.endsWith('/auth/register') ? 201 : 200) : 404, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    try {
      const r = await handleRegister(req, body());
      assert.equal(r.ok, true);
      assert.equal(r.site, 'pending');
    } finally {
      globalThis.fetch = saved.fetch;
      if (saved.mocks === undefined) delete process.env.V3_PUBLIC_USE_MOCKS; else process.env.V3_PUBLIC_USE_MOCKS = saved.mocks;
      if (saved.base === undefined) delete process.env.API_BASE_URL; else process.env.API_BASE_URL = saved.base;
    }
  });
  test('the pending words never claim the site is live', () => {
    assert.match(SITE.register.done.pendingBody, /setting up your site/);
    assert.match(SITE.register.done.pendingBody, /not live yet/);
    assert.doesNotMatch(SITE.register.done.pendingTitle, /live/i);
  });
});

describe('packs and categories', () => {
  test('sixteen packs, each with something to give, no offer wording', () => {
    assert.equal(PACKS.length, 16);
    assert.equal(new Set(PACKS.map((p) => p.key)).size, 16);
    for (const p of PACKS) { assert.ok(p.gives.length >= 3, p.key); assert.doesNotMatch([p.name, ...p.gives].join(' '), /\boffers?\b|\bdiscounts?\b|\bcoupons?\b|\bdeals?\b/i, p.key); }
  });
  test('every sample category belongs to a real pack and groups by pack', () => {
    const keys = new Set(PACKS.map((p) => p.key));
    for (const c of MOCK_CATEGORIES) assert.ok(keys.has(c.packKey), c.categoryKey);
    assert.equal(categoriesByPack(MOCK_CATEGORIES).get('CLINIC')?.length, 2);
  });
});

describe('the validation 400 names its fields in data.fields (Wave 4 contract)', () => {
  const v = (fields: unknown, message = 'Please fix the form.') => ({ success: false, statusCode: 400, message, data: { fields } });
  test('a message that names nothing still lands on the fields the API listed', () => {
    assert.deepEqual(mapRegisterFailure(400, v(['name', 'email', 'password', 'businessName', 'industry', 'phone'])), {
      fields: { owner: 'owner', email: 'email', password: 'password', businessName: 'businessName', category: 'category', phone: 'phone' }, general: null,
    });
  });
  test('names with no form field (referralCode, track, unknown) fall to the general message', () => {
    assert.deepEqual(mapRegisterFailure(400, v(['referralCode', 'track', 'extra'])), { fields: {}, general: 'general' });
  });
  test('data null (fields cannot be named) is the general message, and the message words still win when they name a field', () => {
    assert.deepEqual(mapRegisterFailure(400, { statusCode: 400, message: 'Something odd', data: null }), { fields: {}, general: 'general' });
    assert.deepEqual(mapRegisterFailure(400, v(['name'], 'Email does not look right.')).fields, { email: 'email' });
  });
  test('only a 400 reads the list', () => {
    assert.deepEqual(mapRegisterFailure(500, v(['email'])), { fields: {}, general: 'server' });
  });
});

describe('real mode: POST /auth/register answers 201 with data.accessToken (Wave 4 A3-1)', () => {
  const saved = { fetch: globalThis.fetch, mocks: process.env.V3_PUBLIC_USE_MOCKS, base: process.env.API_BASE_URL };
  const calls: { url: string; body: unknown }[] = [];
  const stub = (answers: Record<string, { status: number; json: unknown }>): void => {
    calls.length = 0;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, body: init?.body ? JSON.parse(String(init.body)) : null });
      const key = Object.keys(answers).find((k) => u.includes(k));
      const a = key ? answers[key] : { status: 404, json: {} };
      return new Response(JSON.stringify(a.json), { status: a.status, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
  };
  const restore = (): void => {
    globalThis.fetch = saved.fetch;
    if (saved.mocks === undefined) delete process.env.V3_PUBLIC_USE_MOCKS; else process.env.V3_PUBLIC_USE_MOCKS = saved.mocks;
    if (saved.base === undefined) delete process.env.API_BASE_URL; else process.env.API_BASE_URL = saved.base;
  };
  const cats = (rows: Array<[string, string]>) => ({ '/v3/public/pack-categories': { status: 200, json: { success: true, data: rows.map(([categoryKey, minTier]) => ({ categoryKey, name: categoryKey, family: 'x', packKey: 'RETAIL', minTier })) } } });
  const real = (): void => { process.env.V3_PUBLIC_USE_MOCKS = 'false'; process.env.API_BASE_URL = 'http://api.invalid'; };

  test('201 with the login-shaped answer signs the owner in and sends only the contract fields', async () => {
    real();
    try {
      stub({ ...cats([['plumber', 'PROFESSIONAL']]), '/auth/register': { status: 201, json: { success: true, statusCode: 201, data: { accessToken: 'tok-1', user: { id: 'u', name: 'M', email: 'e', role: 'VENDOR', businessName: 'B', industry: 'plumber', subdomain: 'sri-murugan' } } } }, '/v3/auth/handoff': { status: 200, json: { data: { code: 'h'.repeat(32) } } } });
      const r = await handleRegister(req, body());
      assert.equal(r.ok, true);
      const sent = calls.find((c) => c.url.endsWith('/auth/register'))!.body as Record<string, unknown>;
      const allowed = new Set(['name', 'email', 'password', 'businessName', 'industry', 'phone', 'referralCode', 'subdomain', 'product', 'track', 'city', 'area', 'pincode', 'gstin', 'confirmDistinct']);
      for (const k of Object.keys(sent)) assert.ok(allowed.has(k), `unknown field sent: ${k}`);
      assert.equal(sent.track, 'professional');
      assert.equal(sent.subdomain, 'sri-murugan');
    } finally { restore(); }
  });

  const okAnswer = { '/auth/register': { status: 201, json: { data: { accessToken: 'tok-1', user: { subdomain: 'x' } } } } };
  const sentTrack = (): unknown => (calls.find((c) => c.url.endsWith('/auth/register'))!.body as Record<string, unknown>).track;

  test('a free signup sends the track of the chosen category (handyman, professional, ecommerce)', async () => {
    real();
    try {
      for (const [key, tier, track] of [['plumber', 'HANDYMAN', 'handyman'], ['chartered-accountant', 'PROFESSIONAL', 'professional'], ['general-store', 'ECOMMERCE', 'ecommerce']] as const) {
        stub({ ...okAnswer, ...cats([[key, tier]]) });
        await handleRegister(req, body({ plan: 'free', termMonths: null, categoryKey: key }));
        assert.equal(sentTrack(), track, key);
      }
    } finally { restore(); }
  });
  test('a paid plan keeps its own track, whatever the category says', async () => {
    real();
    try {
      stub({ ...okAnswer, ...cats([['plumber', 'HANDYMAN']]) });
      await handleRegister(req, body({ plan: 'ecommerce', categoryKey: 'plumber' }));
      assert.equal(sentTrack(), 'ecommerce');
    } finally { restore(); }
  });
  test('a category the list does not carry is refused (P7), and a known one with an unreadable tier still sends the smallest track', async () => {
    real();
    try {
      stub({ ...okAnswer, ...cats([['x', 'GOLD']]) });
      const r = await handleRegister(req, body({ plan: 'free', termMonths: null, categoryKey: 'unknown-one' }));
      assert.equal(r.ok, false);
      assert.equal(r.fields.category, 'category');
      assert.equal(calls.some((c) => c.url.endsWith('/auth/register')), false);
      await handleRegister(req, body({ plan: 'free', termMonths: null, categoryKey: 'x' }));
      assert.equal(sentTrack(), DEFAULT_TRACK, 'an unknown tier is not passed on');
    } finally { restore(); }
  });
  test('the track values are the three the API accepts, and only those', () => {
    assert.deepEqual([...TRACKS], ['handyman', 'professional', 'ecommerce']);
    assert.equal(trackOfTier('PROFESSIONAL'), 'professional');
    for (const v of ['free', '', undefined, null, 'leadspace', 'GOLD']) assert.equal(trackOfTier(v as string), null, String(v));
  });
  test('trackFor in sample mode: free falls to the category tier of the samples', async () => {
    assert.equal(await trackFor('free', 'plumber'), 'handyman');
    assert.equal(await trackFor('professional', 'plumber'), 'professional');
  });

  test('the documented refusals reach the right field', async () => {
    real();
    try {
      const L = cats([['plumber', 'PROFESSIONAL']]);
      stub({ ...L, '/auth/register': { status: 409, json: { success: false, statusCode: 409, code: 'HOST_UNAVAILABLE', message: 'That address is not available.' } } });
      assert.deepEqual((await handleRegister(req, body())).fields, { subdomain: 'subdomainTaken' });
      stub({ ...L, '/auth/register': { status: 409, json: { success: false, statusCode: 409, message: 'A vendor with this email already exists' } } });
      assert.deepEqual((await handleRegister(req, body())).fields, { email: 'emailTaken' });
      stub({ ...L, '/auth/register': { status: 400, json: { success: false, statusCode: 400, message: 'Please check the form.', data: { fields: ['email'] } } } });
      assert.deepEqual((await handleRegister(req, body())).fields, { email: 'email' });
      stub({ ...L, '/auth/register': { status: 429, json: {} } });
      assert.equal((await handleRegister(req, body())).general, 'rate');
    } finally { restore(); }
  });
});
