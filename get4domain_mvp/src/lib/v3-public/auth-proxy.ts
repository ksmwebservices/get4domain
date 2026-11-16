import { INDUSTRIES } from '../../data/industries-list';
import { emailOk, errorOf } from './claim';
import { useMocks } from './flag';
import { callApi } from './proxy';
import type { ClaimCallResult } from './types';

/**
 * The sign-in, sign-up and password-reset-request calls of the browser, answered by the server. The browser talks only to this site.
 * Nothing is kept: a successful sign-in only tells the page to continue to the business app, which signs the owner in itself (there is no token handoff yet, gap G2).
 */
export type AuthAction = 'login' | 'register' | 'forgot';
export const AUTH_ACTIONS: readonly string[] = ['login', 'register', 'forgot'];

export const MOCK_LOGIN_EMAIL = 'owner@example.invalid';
export const MOCK_LOGIN_PASSWORD = 'Password1';
export const MOCK_TAKEN_EMAIL = 'taken@example.invalid';

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
      if (useMocks()) return email === MOCK_LOGIN_EMAIL && password === MOCK_LOGIN_PASSWORD ? res(true, 200, null) : res(false, 401, null);
      const r = await callApi(req, '/auth/session/login', { method: 'POST', body: { email, password } });
      if (!r) return res(false, 0, null);
      return r.ok ? res(true, 200, null) : res(false, r.status, null, r.status === 429 ? errorOf(r.json).message : null);
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
      if (useMocks()) return res(true, 200, null);
      const r = await callApi(req, '/auth/password/forgot', { method: 'POST', body: { email } });
      if (!r) return res(false, 0, null);
      // The API answers the same whether or not the address has an account, so the page does too.
      return r.status === 429 ? res(false, 429, null, errorOf(r.json).message) : res(true, 200, null);
    }
  }
}
