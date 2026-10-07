import * as crypto from 'crypto';

/**
 * Pay-link tokens: 256 bits of CSPRNG output (base64url, 43 chars). Only the SHA-256 is stored, so a
 * database leak cannot be replayed as pay links, and no list/API ever returns a token. A lost link is
 * re-issued (rotated), which invalidates the previous one.
 */
export const TOKEN_BYTES = 32;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function newPayToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashPayToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Cheap shape check so junk / probing input never reaches the database. */
export function isPlausiblePayToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_RE.test(token);
}

export function payUrl(token: string, base = process.env.FRONTEND_URL ?? 'https://get4domain.com'): string {
  return `${base.replace(/\/+$/, '')}/pay/${token}`;
}

/** One-way hash of a client IP for abuse correlation without storing the address. */
export function hashIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return crypto.createHash('sha256').update(`g4d-ip:${ip}`).digest('hex').slice(0, 32);
}
