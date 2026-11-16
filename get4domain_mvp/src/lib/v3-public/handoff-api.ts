import { handoffCodeOk } from './handoff';
import { callApi } from './proxy';

/** A plain or wrapped ({ data }) JSON answer's string field. */
export function pickString(json: unknown, key: string): string | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  const inner = o.data && typeof o.data === 'object' ? (o.data as Record<string, unknown>) : o;
  const v = inner[key];
  return typeof v === 'string' && v ? v : null;
}

/**
 * Asks the API for a one-time handoff code for the owner who just signed in: POST /v3/auth/handoff with that owner's bearer token.
 * The token lives only inside this call (it is never stored and never sent to the browser); only the code goes back.
 * null for every failure (route missing, rejected, unreachable, an answer without a usable code): the caller then falls back to the vendor app's login.
 * Assumed answer (gap G2): { code } or { data: { code } }.
 */
export async function requestHandoff(req: Request, accessToken: string | null): Promise<string | null> {
  if (!accessToken) return null;
  const r = await callApi(req, '/v3/auth/handoff', { method: 'POST', body: {}, headers: { authorization: `Bearer ${accessToken}` } });
  if (!r || !r.ok) return null;
  const code = pickString(r.json, 'code');
  return handoffCodeOk(code) ? code : null;
}

/** The signed-in owner's bearer token out of a sign-in answer (assumed field: accessToken, as in POST /auth/login). */
export const accessTokenOf = (json: unknown): string | null => pickString(json, 'accessToken');
