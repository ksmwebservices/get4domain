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

/**
 * The Set-Cookie header for a valid code: the code alone, httpOnly (page script never reads it), first party (no Domain attribute), SameSite=Lax, site-wide path.
 * Secure except on localhost (development). Throws on anything that is not a plain code, so nothing else can ever be written into the cookie.
 */
export function referralCookieHeader(code: string, secure: boolean): string {
  if (!referralCodeOk(code)) throw new Error('not a referral code');
  return `${REFERRAL_COOKIE}=${code}; Path=/; Max-Age=${REFERRAL_MAX_AGE}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** The address a valid code goes to (the code itself is not in it) and the neutral page for every other case. */
export const REFERRAL_TARGET_VALID = '/register';
export const REFERRAL_TARGET_NEUTRAL = '/referral-link';

export interface ReferralCheck { valid: boolean; displayName: string | null }

/** Sample codes for review (mock mode only). */
export const MOCK_REFERRAL_VALID = 'SAMPLE-PARTNER';
export const MOCK_REFERRAL_DISABLED = 'SAMPLE-OFF';

/**
 * Asks the public referral route (GET /v3/public/referral/:code, answering `{ valid: true, source }` or `{ valid: false }`). 404 is an unknown code; any other failure is "could not check". Only the display name (`source`) is kept, trimmed and length limited:
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
  const name = valid && typeof o.source === 'string' ? o.source.trim().slice(0, 80) : '';
  return { kind: 'ok', data: { valid, displayName: name || null } };
}
