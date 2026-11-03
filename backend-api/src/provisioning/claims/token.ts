import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Claim token rules (docs/v3/V3_S3_PROVISIONING.md section 6): 32 random bytes as base64url (43 characters); only the SHA-256 is stored; the raw token lives
 * in memory for one run and in the message sent to the owner. Nothing in this module logs or stores a token.
 */
export const generateToken = (): string => randomBytes(32).toString('base64url');
export const hashToken = (raw: string): string => createHash('sha256').update(raw).digest('hex');
/** The only shape a token can have; anything else is refused before any lookup. */
export const isWellFormedToken = (raw: string): boolean => /^[A-Za-z0-9_-]{43}$/.test(raw);

/** Constant-time comparison of two hex digests. */
export function hashesEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8'); const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}
