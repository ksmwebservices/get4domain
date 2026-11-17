import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MOCK_CATEGORIES, PACKS, categoriesByPack } from '../packs';
import { cleanSubdomain, mapRegisterFailure, messagesOf, passwordOk, phoneOk, subdomainProblem, subdomainStateOf, validateRegister, type RegisterInput } from '../register';
import { MOCK_REGISTER_HANDOFF, MOCK_TAKEN_EMAIL_REGISTER, handleRegister, handleSubdomainCheck, parseRegisterBody } from '../register-proxy';
import { SITE } from '../site-strings';

const good: RegisterInput = {
  businessName: 'Sri Murugan Plumbing', categoryKey: 'plumber', industry: 'field_service', subdomain: 'sri-murugan', name: 'Murugan', email: 'owner@example.invalid', phone: '',
  password: 'Password1', acceptedTerms: true, plan: 'professional', termMonths: 12,
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
    assert.deepEqual(mapRegisterFailure(500, {}), { fields: {}, general: 'general' });
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
  test('messagesOf reads strings and lists, plain or wrapped', () => {
    assert.deepEqual(messagesOf({ message: 'a' }), ['a']);
    assert.deepEqual(messagesOf({ message: ['a', 'b', 3] }), ['a', 'b']);
    assert.deepEqual(messagesOf({ data: { message: 'c' } }), ['c']);
    assert.deepEqual(messagesOf(null), []);
  });
});

describe('the register call in mock mode', () => {
  test('a good form is accepted and hands off', async () => {
    assert.deepEqual(await handleRegister(req, body()), { ok: true, fields: {}, general: null, handoff: MOCK_REGISTER_HANDOFF });
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
