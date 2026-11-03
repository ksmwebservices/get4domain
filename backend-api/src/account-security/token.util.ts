import { createHash, randomBytes } from 'crypto';

/** A fresh secret: 32 random bytes (256 bits), url-safe. `prefix` only helps humans and scanners recognise the kind of token. */
export function newToken(prefix = ''): string {
  return prefix + randomBytes(32).toString('base64url');
}

/** What the database stores instead of the token itself (a leaked table cannot be used to sign in or reset a password). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
