// Server-side demo access pass. A short-lived, HMAC-signed, httpOnly cookie that is
// set ONLY after a real OTP verification (via /api/demo/verify). The middleware
// verifies it before any /demo/* content is served, so direct URL hits, bookmarks and
// shared links can never render demo content — and the pass is category-scoped so the
// visit category-lock is enforced at the URL level too. Web Crypto so it runs in the
// edge middleware runtime as well as Node route handlers.

const SECRET = process.env.DEMO_ACCESS_SECRET || 'g4d-demo-access-v1';
const TTL_MS = 45 * 60 * 1000; // 45 minutes
export const DEMO_PASS_COOKIE = 'g4d_demo_pass';
export const DEMO_PASS_TTL_SECONDS = Math.floor(TTL_MS / 1000);

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str: string): Uint8Array {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmac(msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return b64url(new Uint8Array(sig));
}

/** Sign a pass for a specific (main) category. */
export async function signDemoPass(category: string): Promise<string> {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ c: category, e: Date.now() + TTL_MS })));
  return `${payload}.${await hmac(payload)}`;
}

/** Verify a pass token; returns its category or null if missing/tampered/expired. */
export async function verifyDemoPass(token?: string | null): Promise<{ category: string } | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  if ((await hmac(payload)) !== sig) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as { c: string; e: number };
    if (!data.e || Date.now() > data.e) return null;
    return { category: data.c };
  } catch {
    return null;
  }
}
