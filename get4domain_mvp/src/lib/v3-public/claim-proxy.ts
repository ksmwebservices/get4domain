import { errorOf, isMailOff, codeOk, emailOk, passwordOk } from './claim';
import { useMocks } from './flag';
import { accessTokenOf, requestHandoff } from './handoff-api';
import { MOCK_CODE_LOCKED, MOCK_CODE_OK, MOCK_HANDOFF_CODE, MOCK_NO_HANDOFF_EMAIL, MOCK_SETUP_TOKEN, MOCK_TOKEN_MAIL_OFF, MOCK_TOKEN_OK, mockListing } from './mocks';
import { callApi } from './proxy';
import type { ClaimCallResult } from './types';

/**
 * The claim calls of the browser, answered by the server. The browser talks only to this site: the API address, the rate-limit address and the API sentences stay here.
 * Every call checks its input before it goes anywhere, and the answer is one fixed shape (ClaimCallResult).
 */
export type ClaimAction = 'start' | 'otp-request' | 'otp-verify' | 'setup';
export const CLAIM_ACTIONS: readonly string[] = ['start', 'otp-request', 'otp-verify', 'setup'];

const TOKEN = /^[A-Za-z0-9_-]{16,200}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const res = <T>(ok: boolean, status: number, code: string | null, data: T | null = null, message: string | null = null): ClaimCallResult<T> => ({ ok, status, code, message, data });
const invalid = (): ClaimCallResult => res(false, 400, 'DIRECTORY_INVALID');

const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);

/** One claim call. `body` is the parsed JSON the browser sent. */
export async function handleClaim(req: Request, action: ClaimAction, body: Record<string, unknown>): Promise<ClaimCallResult> {
  switch (action) {
    case 'start': {
      const slug = text(body.slug, 100);
      if (!slug || !SLUG.test(slug)) return invalid();
      if (useMocks()) {
        const l = mockListing(slug);
        if (!l) return res(false, 404, 'DIRECTORY_NOT_FOUND');
        if (l.state !== 'UNCLAIMED_LISTING') return res(false, 409, 'DIRECTORY_STATE_INVALID');
        return res(true, 200, null, { token: slug === 'city-pipe-works' ? MOCK_TOKEN_MAIL_OFF : MOCK_TOKEN_OK });
      }
      // Assumed route (gap G1): POST /v3/claim/start { businessSlug } answers { token }. A 404 or 405 here means the route does not exist yet.
      const r = await callApi(req, '/v3/claim/start', { method: 'POST', body: { businessSlug: slug } });
      if (!r) return res(false, 0, null);
      const e = errorOf(r.json);
      const data = r.ok ? pick(r.json, 'token') : null;
      return res(r.ok && !!data, r.status, r.ok ? null : e.code, data ? { token: data } : null, r.status === 429 ? e.message : null);
    }
    case 'otp-request': {
      const token = text(body.token, 200);
      if (!token || !TOKEN.test(token)) return invalid();
      if (useMocks()) return token === MOCK_TOKEN_MAIL_OFF ? res(false, 503, 'MAIL_DISABLED') : res(true, 200, null, { sent: true });
      const r = await callApi(req, `/v3/claim/${encodeURIComponent(token)}/otp/request`, { method: 'POST', body: { channel: 'EMAIL' } });
      if (!r) return res(false, 0, null);
      const e = errorOf(r.json);
      if (r.ok) return res(true, r.status, null, { sent: true });
      return res(false, r.status, isMailOff(r.status, e.code) ? 'MAIL_DISABLED' : e.code, null, r.status === 429 ? e.message : null);
    }
    case 'otp-verify': {
      const token = text(body.token, 200);
      const code = text(body.code, 6);
      if (!token || !TOKEN.test(token) || !code || !codeOk(code)) return invalid();
      if (useMocks()) {
        if (code === MOCK_CODE_LOCKED) return res(false, 429, null, null, 'Too many wrong codes. Please request a new code later.');
        return code === MOCK_CODE_OK ? res(true, 200, null, { setupToken: MOCK_SETUP_TOKEN }) : res(false, 400, 'OTP_INVALID');
      }
      const r = await callApi(req, `/v3/claim/${encodeURIComponent(token)}/otp/verify`, { method: 'POST', body: { code } });
      if (!r) return res(false, 0, null);
      const e = errorOf(r.json);
      const setup = r.ok ? pick(r.json, 'setupToken') : null;
      return setup ? res(true, r.status, null, { setupToken: setup }) : res(false, r.status, e.code, null, r.status === 429 ? e.message : null);
    }
    case 'setup': {
      const setupToken = text(body.setupToken, 200);
      const password = text(body.password, 128);
      const email = body.email === undefined || body.email === '' ? null : text(body.email, 254);
      if (!setupToken || !TOKEN.test(setupToken) || !password || !passwordOk(password) || typeof body.acceptTerms !== 'boolean') return invalid();
      if (email && !emailOk(email)) return invalid();
      if (useMocks()) {
        if (body.acceptTerms !== true) return res(false, 400, 'CLAIM_TERMS_REQUIRED');
        if (email === 'taken@example.invalid') return res(false, 409, 'CLAIM_EMAIL_TAKEN');
        return res(true, 200, null, { next: 'LOGIN', handoff: email === MOCK_NO_HANDOFF_EMAIL ? null : MOCK_HANDOFF_CODE });
      }
      const r = await callApi(req, '/v3/claim/setup', { method: 'POST', body: { setupToken, password, acceptTerms: body.acceptTerms, ...(email ? { email } : {}) } });
      if (!r) return res(false, 0, null);
      const e = errorOf(r.json);
      if (!r.ok) return res(false, r.status, e.code, null, r.status === 429 ? e.message : null);
      // The account is ready. Sign the owner in with the password just typed (kept only for this call) to ask for a handoff code; any failure here is not a failure of the setup: no code, and the page sends the owner to the business app's login.
      const loginEmail = email ?? pick(r.json, 'loginEmail');
      let handoff: string | null = null;
      if (loginEmail) {
        const login = await callApi(req, '/auth/session/login', { method: 'POST', body: { email: loginEmail, password } });
        if (login?.ok) handoff = await requestHandoff(req, accessTokenOf(login.json));
      }
      return res(true, r.status, null, { next: 'LOGIN', handoff });
    }
  }
}

/** A field out of a plain or wrapped ({ data }) JSON answer. */
function pick(json: unknown, key: string): string | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  const inner = o.data && typeof o.data === 'object' ? (o.data as Record<string, unknown>) : o;
  const v = inner[key];
  return typeof v === 'string' && v ? v : null;
}
