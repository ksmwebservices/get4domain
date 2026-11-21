/**
 * Where a visitor goes after signing in or finishing claim setup (pure: the browser and the tests both use it).
 * With a one-time handoff code the visitor goes to the vendor app address with the code in the URL fragment (#handoff=), which no server or log ever sees.
 * Without one (the handoff route is missing or failed) the visitor goes to the vendor app's own login. No vendor app address means no target.
 */
export const HANDOFF_PARAM = 'handoff';
export const VENDOR_LOGIN_PATH = '/login';

/** A code is opaque here; only the characters that are safe in a fragment are accepted. */
export const handoffCodeOk = (c: unknown): c is string => typeof c === 'string' && /^[A-Za-z0-9._~-]{8,512}$/.test(c);

export function handoffTarget(vendorUrl: string | null, code: string | null): string | null {
  if (!vendorUrl) return null;
  let u: URL;
  try { u = new URL(vendorUrl); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.search = '';
  if (handoffCodeOk(code)) {
    u.hash = `${HANDOFF_PARAM}=${encodeURIComponent(code)}`;
    return u.toString();
  }
  u.hash = '';
  u.pathname = `${u.pathname.replace(/\/+$/, '')}${VENDOR_LOGIN_PATH}`;
  return u.toString();
}
