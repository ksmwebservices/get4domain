import * as crypto from 'crypto';

/**
 * "Preview my site" link: a short-lived token that lets the public site renderer fetch the vendor's DRAFT (never the public).
 * Signed with the server secret, tied to one vendor, valid for 30 minutes. It carries no personal data.
 */
const TTL_MS = 30 * 60_000;
const secret = (): string => `${process.env.JWT_SECRET ?? 'dev-secret'}:site-preview`;
const sign = (payload: string): string => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

export function makePreviewToken(vendorId: string, now = Date.now()): string {
  const payload = `${vendorId}.${now + TTL_MS}`;
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
}

/** The vendor id inside a valid, unexpired token; otherwise null. */
export function readPreviewToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [p, sig] = token.split('.');
  if (!p || !sig) return null;
  let payload: string;
  try { payload = Buffer.from(p, 'base64url').toString('utf8'); } catch { return null; }
  const expect = sign(payload);
  const a = Buffer.from(sig); const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [vendorId, exp] = payload.split('.');
  if (!vendorId || !Number.isFinite(Number(exp)) || Number(exp) < now) return null;
  return vendorId;
}
