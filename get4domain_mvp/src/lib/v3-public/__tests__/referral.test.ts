import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { GET } from '../../../app/(v3site)/v3-site/r/[code]/route';
import { MOCK_REFERRAL_DISABLED, MOCK_REFERRAL_VALID, REFERRAL_COOKIE, REFERRAL_MAX_AGE, REFERRAL_TARGET_NEUTRAL, REFERRAL_TARGET_VALID, checkReferral, readReferral, referralCodeOk, referralCookieHeader } from '../referral';

const call = (code: string, host = 'main.example.invalid'): Promise<Response> =>
  GET(new Request(`https://${host}/v3-site/r/${code}`, { headers: { host } }), { params: Promise.resolve({ code }) });

describe('referral codes and the cookie', () => {
  test('a code is plain: letters, digits, hyphen, underscore, up to 64', () => {
    for (const ok of ['ABC123', 'sample-partner', 'a_b-c', 'x'.repeat(64)]) assert.equal(referralCodeOk(ok), true, ok);
    for (const bad of ['', 'x'.repeat(65), 'has space', 'semi;colon', 'new\nline', 'a=b', '<script>', 'ü', null, 5]) assert.equal(referralCodeOk(bad), false, String(bad));
  });
  test('the cookie holds the code and nothing else', () => {
    const h = referralCookieHeader('SAMPLE-PARTNER', true);
    assert.equal(h, `${REFERRAL_COOKIE}=SAMPLE-PARTNER; Path=/; Max-Age=${REFERRAL_MAX_AGE}; HttpOnly; SameSite=Lax; Secure`);
    assert.equal(h.split(';')[0], 'g4d_ref=SAMPLE-PARTNER');
    assert.doesNotMatch(h, /Domain=/i, 'first party: no Domain attribute');
    assert.doesNotMatch(referralCookieHeader('abc', false), /Secure/);
  });
  test('nothing but a plain code can be written into it', () => {
    for (const bad of ['a; Domain=evil.invalid', 'x\r\nSet-Cookie: y=1', 'a b', '']) assert.throws(() => referralCookieHeader(bad, true), /not a referral code/);
  });
  test('reading it back', () => {
    assert.equal(readReferral('a=1; g4d_ref=ABC-1; b=2'), 'ABC-1');
    assert.equal(readReferral('g4d_ref=bad value'), null);
    assert.equal(readReferral('other=ABC'), null);
    assert.equal(readReferral(null), null);
    assert.equal(readReferral('g4d_refx=ABC'), null);
  });
});

describe('the referral check (sample mode)', () => {
  test('valid, disabled, unknown and malformed', async () => {
    assert.deepEqual(await checkReferral(MOCK_REFERRAL_VALID), { kind: 'ok', data: { valid: true, displayName: 'Sample Partner' } });
    assert.deepEqual(await checkReferral(MOCK_REFERRAL_DISABLED), { kind: 'ok', data: { valid: false, displayName: null } });
    assert.deepEqual(await checkReferral('NOPE'), { kind: 'notFound' });
    assert.deepEqual(await checkReferral('bad code'), { kind: 'notFound' });
  });
});

describe('/r/{code}', () => {
  let saved: string | undefined;
  beforeEach(() => { saved = process.env.V3_PUBLIC_ENABLED; process.env.V3_PUBLIC_ENABLED = 'true'; });
  afterEach(() => { if (saved === undefined) delete process.env.V3_PUBLIC_ENABLED; else process.env.V3_PUBLIC_ENABLED = saved; });

  test('a valid code sets the code-only cookie and goes to register', async () => {
    const r = await call(MOCK_REFERRAL_VALID);
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), REFERRAL_TARGET_VALID);
    const c = r.headers.get('set-cookie') ?? '';
    assert.equal(c.split(';')[0], `${REFERRAL_COOKIE}=${MOCK_REFERRAL_VALID}`);
    assert.match(c, /HttpOnly/);
    assert.match(c, /SameSite=Lax/);
    assert.match(c, /Secure/);
    assert.doesNotMatch(c, /Sample Partner/i, 'no name in the cookie');
    assert.doesNotMatch(r.headers.get('location') ?? '', /SAMPLE/, 'the code is not in the address');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.match(r.headers.get('x-robots-tag') ?? '', /noindex/);
  });
  test('localhost gets no Secure attribute (development)', async () => {
    assert.doesNotMatch((await call(MOCK_REFERRAL_VALID, 'localhost:3000')).headers.get('set-cookie') ?? '', /Secure/);
  });
  test('a disabled, unknown or malformed code sets no cookie and goes to the neutral page without the code', async () => {
    for (const code of [MOCK_REFERRAL_DISABLED, 'NOPE', 'bad%20code', 'a;b']) {
      const r = await call(code);
      assert.equal(r.status, 302, code);
      assert.equal(r.headers.get('location'), REFERRAL_TARGET_NEUTRAL, code);
      assert.equal(r.headers.get('set-cookie'), null, code);
    }
  });
  test('flag off: a plain 404 and no cookie', async () => {
    delete process.env.V3_PUBLIC_ENABLED;
    const r = await call(MOCK_REFERRAL_VALID);
    assert.equal(r.status, 404);
    assert.equal(r.headers.get('set-cookie'), null);
  });
});
