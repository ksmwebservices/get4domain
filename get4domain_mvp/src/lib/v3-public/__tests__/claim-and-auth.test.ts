import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { AUTH_ACTIONS, handleAuth, MOCK_LOGIN_EMAIL, MOCK_LOGIN_PASSWORD, MOCK_MAIL_OFF_EMAIL, MOCK_RESET_EXPIRED, MOCK_RESET_TOKEN, MOCK_TAKEN_EMAIL } from '../auth-proxy';
import { canClaim, choosable, codeOk, deriveListingState, emailOk, errorOf, isMailOff, passwordOk } from '../claim';
import { handleClaim } from '../claim-proxy';
import { gstinLine, getFirm } from '../firm';
import { MOCK_CODE_LOCKED, MOCK_CODE_OK, MOCK_SETUP_TOKEN, MOCK_TOKEN_MAIL_OFF, MOCK_TOKEN_OK, mockSearch } from '../mocks';
import { S } from '../strings';
import type { ListingState } from '../types';

const req = new Request('http://localhost/x');

describe('the four listing states have a screen each', () => {
  test('derived from the public facts', () => {
    assert.equal(deriveListingState({ claimed: false }), 'UNCLAIMED_LISTING');
    assert.equal(deriveListingState({ claimed: true }), 'CLAIMED');
    assert.equal(deriveListingState({ claimed: true, siteUrl: 'https://x.example.invalid' }), 'LIVE');
    assert.equal(deriveListingState({ claimed: true, siteState: 'PRO' }), 'LIVE');
    assert.equal(deriveListingState({ claimed: false, draft: true }), 'DRAFT_SITE');
  });

  test('only an unclaimed listing can start a claim', () => {
    const states: ListingState[] = ['UNCLAIMED_LISTING', 'DRAFT_SITE', 'CLAIMED', 'LIVE'];
    assert.deepEqual(states.filter(canClaim), ['UNCLAIMED_LISTING']);
  });

  test('every state has a title and a body in the strings module', () => {
    for (const k of ['unclaimed', 'draft', 'claimed', 'live'] as const) {
      assert.ok(S.claim.states[k].title.length > 5, k);
      assert.ok(S.claim.states[k].body.length > 10, k);
    }
  });

  test('the fixture search reaches all four states', () => {
    const states = new Set(mockSearch('', 'chennai').map((b) => b.state));
    assert.deepEqual([...states].sort(), ['CLAIMED', 'DRAFT_SITE', 'LIVE', 'UNCLAIMED_LISTING']);
    assert.ok(choosable(mockSearch('', 'chennai')).every((b) => b.state === 'UNCLAIMED_LISTING'));
  });

  test('a search with nothing typed finds nothing', () => {
    assert.deepEqual(mockSearch('', ''), []);
  });
});

describe('claim screens for each step and each failure', () => {
  test('every step and notice has text', () => {
    for (const t of [S.claim.request.title, S.claim.verify.title, S.claim.account.title, S.claim.approval.title, S.claim.live.title, S.claim.link.invalidTitle, S.claim.request.mailOffTitle, S.claim.start.title]) assert.ok(t.length > 3);
    assert.ok(S.claim.request.mailOff.length > 20);
    assert.ok(S.claim.startUnavailable.length > 20);
  });

  test('the email-switched-off state is recognised', () => {
    assert.equal(isMailOff(503, null), true);
    assert.equal(isMailOff(400, 'MAIL_DISABLED'), true);
    assert.equal(isMailOff(400, 'EMAIL_OFF'), true);
    assert.equal(isMailOff(400, 'OTP_INVALID'), false);
    assert.equal(isMailOff(200, null), false);
  });

  test('error bodies are read however they are wrapped', () => {
    assert.deepEqual(errorOf({ message: 'x', code: 'OTP_INVALID' }), { code: 'OTP_INVALID', message: 'x' });
    assert.deepEqual(errorOf({ success: false, data: { code: 'GRANT_INVALID', message: 'y' } }), { code: 'GRANT_INVALID', message: 'y' });
    assert.deepEqual(errorOf({ message: ['first', 'second'] }), { code: null, message: 'first' });
    assert.deepEqual(errorOf(null), { code: null, message: null });
  });

  test('input checks', () => {
    assert.equal(codeOk('123456'), true);
    assert.equal(codeOk('12345'), false);
    assert.equal(codeOk('12345a'), false);
    assert.equal(passwordOk('1234567'), false);
    assert.equal(passwordOk('12345678'), true);
    assert.equal(emailOk('a@b.co'), true);
    assert.equal(emailOk('not an email'), false);
  });
});

describe('the claim calls (sample mode)', () => {
  test('start works for an unclaimed listing and is refused for a claimed one or an unknown one', async () => {
    const ok = await handleClaim(req, 'start', { slug: 'sri-murugan-plumbing' });
    assert.equal(ok.ok, true);
    assert.equal((ok.data as { token: string }).token, MOCK_TOKEN_OK);
    assert.equal((await handleClaim(req, 'start', { slug: 'anand-electricals' })).code, 'DIRECTORY_STATE_INVALID');
    assert.equal((await handleClaim(req, 'start', { slug: 'nobody-here' })).code, 'DIRECTORY_NOT_FOUND');
    assert.equal((await handleClaim(req, 'start', { slug: 'Not A Slug' })).code, 'DIRECTORY_INVALID');
  });

  test('the code goes by email, and the email-off state is reachable', async () => {
    assert.equal((await handleClaim(req, 'otp-request', { token: MOCK_TOKEN_OK })).ok, true);
    const off = await handleClaim(req, 'otp-request', { token: MOCK_TOKEN_MAIL_OFF });
    assert.equal(off.ok, false);
    assert.equal(off.code, 'MAIL_DISABLED');
  });

  test('a wrong code, a locked code and a right code', async () => {
    assert.equal((await handleClaim(req, 'otp-verify', { token: MOCK_TOKEN_OK, code: '111111' })).code, 'OTP_INVALID');
    const locked = await handleClaim(req, 'otp-verify', { token: MOCK_TOKEN_OK, code: MOCK_CODE_LOCKED });
    assert.equal(locked.status, 429);
    assert.ok(locked.message);
    const good = await handleClaim(req, 'otp-verify', { token: MOCK_TOKEN_OK, code: MOCK_CODE_OK });
    assert.equal(good.ok, true);
    assert.equal((good.data as { setupToken: string }).setupToken, MOCK_SETUP_TOKEN);
  });

  test('setup needs the terms, a long enough password and a valid email when one is given', async () => {
    const base = { setupToken: MOCK_SETUP_TOKEN, password: 'long-enough-1' };
    assert.equal((await handleClaim(req, 'setup', { ...base, acceptTerms: false })).code, 'CLAIM_TERMS_REQUIRED');
    assert.equal((await handleClaim(req, 'setup', { ...base, password: 'short', acceptTerms: true })).code, 'DIRECTORY_INVALID');
    assert.equal((await handleClaim(req, 'setup', { ...base, acceptTerms: true, email: 'taken@example.invalid' })).code, 'CLAIM_EMAIL_TAKEN');
    assert.equal((await handleClaim(req, 'setup', { ...base, acceptTerms: true, email: 'bad' })).code, 'DIRECTORY_INVALID');
    const ok = await handleClaim(req, 'setup', { ...base, acceptTerms: true });
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.data, { next: 'LOGIN' });
  });

  test('bad input never reaches anywhere', async () => {
    assert.equal((await handleClaim(req, 'otp-request', { token: 'short' })).code, 'DIRECTORY_INVALID');
    assert.equal((await handleClaim(req, 'otp-verify', { token: MOCK_TOKEN_OK, code: 'abcdef' })).code, 'DIRECTORY_INVALID');
    assert.equal((await handleClaim(req, 'setup', { setupToken: 'x', password: 'a', acceptTerms: true })).code, 'DIRECTORY_INVALID');
  });
});

describe('sign in, sign up and password reset (sample mode)', () => {
  test('sign in', async () => {
    assert.equal((await handleAuth(req, 'login', { email: MOCK_LOGIN_EMAIL, password: MOCK_LOGIN_PASSWORD })).ok, true);
    assert.equal((await handleAuth(req, 'login', { email: MOCK_LOGIN_EMAIL, password: 'wrong-password' })).status, 401);
    assert.equal((await handleAuth(req, 'login', { email: 'nope', password: 'x' })).code, 'DIRECTORY_INVALID');
  });

  test('sign up checks the password rule, the industry and a taken address', async () => {
    const base = { name: 'A', email: 'new@example.invalid', password: 'Password1', businessName: 'B', industry: 'travel' };
    assert.equal((await handleAuth(req, 'register', base)).ok, true);
    assert.equal((await handleAuth(req, 'register', { ...base, password: 'password1' })).code, 'DIRECTORY_INVALID');
    assert.equal((await handleAuth(req, 'register', { ...base, industry: 'not-an-industry' })).code, 'DIRECTORY_INVALID');
    assert.equal((await handleAuth(req, 'register', { ...base, email: MOCK_TAKEN_EMAIL })).status, 409);
  });

  test('password reset answers the same for any valid address', async () => {
    assert.equal((await handleAuth(req, 'forgot', { email: 'someone@example.invalid' })).ok, true);
    assert.equal((await handleAuth(req, 'forgot', { email: 'bad' })).code, 'DIRECTORY_INVALID');
  });

  test('the reset request says email is switched off, and only that, when it is', async () => {
    const off = await handleAuth(req, 'forgot', { email: MOCK_MAIL_OFF_EMAIL });
    assert.equal(off.ok, false);
    assert.equal(off.code, 'MAIL_DISABLED');
    assert.deepEqual(await handleAuth(req, 'forgot', { email: 'known@example.invalid' }), await handleAuth(req, 'forgot', { email: 'unknown@example.invalid' }));
    assert.ok(S.auth.forgot.mailOff.length > 20 && S.auth.forgot.mailOffTitle.length > 3);
    assert.doesNotMatch(S.auth.forgot.sent, /does not exist|no account|not found|unknown/i);
  });

  test('reset confirm: a good link, an expired link, a weak password, a malformed token', async () => {
    const pw = 'Newpass123';
    assert.equal(AUTH_ACTIONS.includes('reset'), true);
    assert.equal((await handleAuth(req, 'reset', { token: MOCK_RESET_TOKEN, password: pw })).ok, true);
    const expired = await handleAuth(req, 'reset', { token: MOCK_RESET_EXPIRED, password: pw });
    assert.equal(expired.ok, false);
    assert.equal(expired.code, 'GRANT_INVALID');
    assert.equal((await handleAuth(req, 'reset', { token: 'unknown-but-well-formed-token', password: pw })).code, 'GRANT_INVALID');
    assert.equal((await handleAuth(req, 'reset', { token: MOCK_RESET_TOKEN, password: 'password1' })).code, 'DIRECTORY_INVALID');
    assert.equal((await handleAuth(req, 'reset', { token: 'short', password: pw })).code, 'DIRECTORY_INVALID');
    assert.equal((await handleAuth(req, 'reset', { token: 'has spaces and <script> in it', password: pw })).code, 'DIRECTORY_INVALID');
    assert.equal((await handleAuth(req, 'reset', { password: pw })).code, 'DIRECTORY_INVALID');
  });

  test('the reset screens have their text', () => {
    for (const t of [S.auth.reset.title, S.auth.reset.linkInvalidTitle, S.auth.reset.linkInvalid, S.auth.reset.missingToken, S.auth.reset.done, S.auth.reset.mismatch]) assert.ok(t.length > 10);
  });

  test('no answer carries a token or a password', async () => {
    const r = await handleAuth(req, 'login', { email: MOCK_LOGIN_EMAIL, password: MOCK_LOGIN_PASSWORD });
    assert.doesNotMatch(JSON.stringify(r), /token|password/i);
  });
});

describe('the firm identity', () => {
  test('is KSM QUANTUM TECHNOLOGIES at Tidel Park, Chennai, with no GSTIN line while it is pending', () => {
    const f = getFirm();
    assert.equal(f.name, 'KSM QUANTUM TECHNOLOGIES');
    assert.equal(f.address, 'Tidel Park, Chennai');
    assert.equal(f.gstin, null);
    assert.equal(gstinLine(f), null);
  });

  test('a GSTIN appears only when it is set', () => {
    assert.equal(gstinLine({ ...getFirm(), gstin: '  ' }), null);
    assert.equal(gstinLine({ ...getFirm(), gstin: '33ABCDE1234F1Z5' }), '33ABCDE1234F1Z5');
  });
});
