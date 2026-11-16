import { getJson, unwrap } from './api';
import { apiBase } from './config';
import { useMocks } from './flag';
import type { Fetched } from './types';

/**
 * Referral links. The public site only carries the code: the first-party cookie holds the code and nothing else (no name, no source details, no personal data),
 * and registration sends it on. The backend does the attribution.
 */
export const REFERRAL_COOKIE = 'g4d_ref';
/** The cookie lives for thirty days (seconds). */
export const REFERRAL_MAX_AGE = 60 * 60 * 24 * 30;

const CODE = /^[A-Za-z0-9_-]{1,64}$/;
export const referralCodeOk = (c: unknown): c is string => typeof c === 'string' && CODE.test(c);

/** The code out of a Cookie header, or null when absent or not a plain code. */
export function readReferral(cookieHeader: string | null | undefined): string | null {
  for (const part of String(cookieHeader ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== REFERRAL_COOKIE) continue;
    const v = part.slice(i + 1).trim();
    return referralCodeOk(v) ? v : null;
  }
  return null;
}

/** The cookie to set for a valid code: httpOnly (the page script never reads it), first party, lax, the code alone. */
export function referralCookie(code: string, secure: boolean): { name: string; value: string; httpOnly: true; sameSite: 'lax'; path: '/'; maxAge: number; secure: boolean } {
  return { name: REFERRAL_COOKIE, value: code, httpOnly: true, sameSite: 'lax', path: '/', maxAge: REFERRAL_MAX_AGE, secure };
}

export interface ReferralCheck { valid: boolean; displayName: string | null }

/** Sample codes for review (mock mode only). */
export const MOCK_REFERRAL_VALID = 'SAMPLE-PARTNER';
export const MOCK_REFERRAL_DISABLED = 'SAMPLE-OFF';

/**
 * Asks the (assumed, gap G29) public referral route. 404 is an unknown code; any other failure is "could not check". Only the display name is kept, trimmed and length limited:
 * no source details beyond it.
 */
export async function checkReferral(code: string): Promise<Fetched<ReferralCheck>> {
  if (!referralCodeOk(code)) return { kind: 'notFound' };
  if (useMocks()) {
    if (code === MOCK_REFERRAL_VALID) return { kind: 'ok', data: { valid: true, displayName: 'Sample Partner' } };
    if (code === MOCK_REFERRAL_DISABLED) return { kind: 'ok', data: { valid: false, displayName: null } };
    return { kind: 'notFound' };
  }
  const base = apiBase();
  if (!base) return { kind: 'error', status: null };
  const r = await getJson<unknown>(`${base}/v3/public/referral/${encodeURIComponent(code)}`, 60);
  if (r.kind !== 'ok') return r;
  const o = unwrap<Record<string, unknown>>(r.data);
  const valid = !!o && o.valid === true;
  const name = valid && typeof o.displayName === 'string' ? o.displayName.trim().slice(0, 80) : '';
  return { kind: 'ok', data: { valid, displayName: name || null } };
}
