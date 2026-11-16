import { INDUSTRIES } from '../../data/industries-list';
import { emailOk, errorOf, isMailOff } from './claim';
import { useMocks } from './flag';
import { accessTokenOf, requestHandoff } from './handoff-api';
import { MOCK_HANDOFF_CODE, MOCK_NO_HANDOFF_EMAIL } from './mocks';
import { callApi } from './proxy';
import type { ClaimCallResult } from './types';

/**
 * The sign-in, sign-up and password-reset-request calls of the browser, answered by the server. The browser talks only to this site.
 * Nothing is kept. A successful sign-in answers with a one-time handoff code (asked from POST /v3/auth/handoff while the owner's token is in hand, then dropped) or with none when that route is missing or fails; the page then sends the visitor to the business app with the code, or to its login (gap G2).
 */
export type AuthAction = 'login' | 'register' | 'forgot' | 'reset';
export const AUTH_ACTIONS: readonly string[] = ['login', 'register', 'forgot', 'reset'];

export const MOCK_LOGIN_EMAIL = 'owner@example.invalid';
export const MOCK_LOGIN_PASSWORD = 'Password1';
export const MOCK_TAKEN_EMAIL = 'taken@example.invalid';
/** Sample mode: this address gets the "email is switched off" answer on the reset request. */
export const MOCK_MAIL_OFF_EMAIL = 'mailoff@example.invalid';
/** Sample mode: a reset link that works, and one that has expired. */
export const MOCK_RESET_TOKEN = 'mock-reset-token-000000000';
export const MOCK_RESET_EXPIRED = 'mock-reset-expired-0000000';

/** A reset token is opaque to this site: only its shape is checked (letters, digits and . _ ~ -), never its meaning. */
export const RESET_TOKEN = /^[A-Za-z0-9._~-]{16,512}$/;

const res = (ok: boolean, status: number, code: string | null, message: string | null = null): ClaimCallResult => ({ ok, status, code, message, data: ok ? { ok: true } : null });
const invalid = (): ClaimCallResult => res(false, 400, 'DIRECTORY_INVALID');
const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim().length > 0 && v.length <= max ? v : null);

export const registerPasswordOk = (p: string): boolean => p.length >= 8 && p.length <= 128 && /[A-Z]/.test(p) && /\d/.test(p);

export async function handleAuth(req: Request, action: AuthAction, body: Record<string, unknown>): Promise<ClaimCallResult> {
  switch (action) {
    case 'login': {
      const email = text(body.email, 254);
      const password = text(body.password, 128);
      if (!email || !emailOk(email) || !password || password.length < 6) return invalid();
      if (useMocks()) {
        if (password !== MOCK_LOGIN_PASSWORD || (email !== MOCK_LOGIN_EMAIL && email !== MOCK_NO_HANDOFF_EMAIL)) return res(false, 401, null);
        return { ...res(true, 200, null), data: { ok: true, handoff: email === MOCK_LOGIN_EMAIL ? MOCK_HANDOFF_CODE : null } };
      }
      const r = await callApi(req, '/auth/session/login', { method: 'POST', body: { email, password } });
      if (!r) return res(false, 0, null);
      if (!r.ok) return res(false, r.status, null, r.status === 429 ? errorOf(r.json).message : null);
      return { ...res(true, 200, null), data: { ok: true, handoff: await requestHandoff(req, accessTokenOf(r.json)) } };
    }
    case 'register': {
      const name = text(body.name, 100);
      const email = text(body.email, 254);
      const password = text(body.password, 128);
      const businessName = text(body.businessName, 120);
      const industry = text(body.industry, 40);
      if (!name || !email || !emailOk(email) || !password || !registerPasswordOk(password) || !businessName || !industry) return invalid();
      if (!INDUSTRIES.some((i) => i.id === industry)) return invalid();
      if (useMocks()) return email === MOCK_TAKEN_EMAIL ? res(false, 409, null) : res(true, 200, null);
      const r = await callApi(req, '/auth/register', { method: 'POST', body: { name, email, password, businessName, industry } });
      if (!r) return res(false, 0, null);
      return r.ok ? res(true, 200, null) : res(false, r.status, null, r.status === 429 ? errorOf(r.json).message : null);
    }
    case 'forgot': {
      const email = text(body.email, 254);
      if (!email || !emailOk(email)) return invalid();
      if (useMocks()) return email === MOCK_MAIL_OFF_EMAIL ? res(false, 503, 'MAIL_DISABLED') : res(true, 200, null);
      const r = await callApi(req, '/v3/account/password/reset/request', { method: 'POST', body: { email } });
      if (!r) return res(false, 0, null);
      const e = errorOf(r.json);
      if (r.status === 429) return res(false, 429, null, e.message);
      // Email switched off is a fact about the service, not about the account, so it can be said. Every other answer is the same "sent" answer: no hint whether the address has an account.
      if (!r.ok && isMailOff(r.status, e.code)) return res(false, 503, 'MAIL_DISABLED');
      return res(true, 200, null);
    }
    case 'reset': {
      const token = text(body.token, 512);
      const password = text(body.password, 128);
      if (!token || !RESET_TOKEN.test(token) || !password || !registerPasswordOk(password)) return invalid();
      if (useMocks()) {
        if (token === MOCK_RESET_EXPIRED) return res(false, 400, 'GRANT_INVALID');
        return token === MOCK_RESET_TOKEN ? res(true, 200, null) : res(false, 400, 'GRANT_INVALID');
      }
      // Assumed body (gap G14): { token, password }.
      const r = await callApi(req, '/v3/account/password/reset/confirm', { method: 'POST', body: { token, password } });
      if (!r) return res(false, 0, null);
      if (r.ok) return res(true, 200, null);
      const e = errorOf(r.json);
      return res(false, r.status, e.code, r.status === 429 ? e.message : null);
    }
  }
}
