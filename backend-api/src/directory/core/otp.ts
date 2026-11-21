import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Pure OTP and phone rules (slice 5.7). Randomness is injected (`randomInt` from crypto in production), and so is the keyed hash pepper, so every rule is unit tested.
 * The code and the phone number are never stored: only keyed hashes (the code with a per-row salt).
 */
export function generateOtp(rand: (min: number, max: number) => number): string { return String(rand(0, 1_000_000)).padStart(6, '0'); }

export function hashCode(code: string, salt: string, pepper: string): string { return createHmac('sha256', pepper).update(`${salt}:${code}`).digest('hex'); }

export function hashPhone(e164: string, pepper: string): string { return createHmac('sha256', pepper).update(`phone:${e164}`).digest('hex'); }

/** Constant-time comparison; anything that is not exactly six digits, or a hash of the wrong shape, is simply false. */
export function verifyCodeHash(code: unknown, storedHash: string, salt: string, pepper: string): boolean {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code) || typeof storedHash !== 'string' || !/^[0-9a-f]{64}$/.test(storedHash)) return false;
  return timingSafeEqual(Buffer.from(hashCode(code, salt, pepper), 'hex'), Buffer.from(storedHash, 'hex'));
}

export interface ChallengeState { status: 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'LOCKED' | 'REVOKED'; attempts: number; maxAttempts: number; expiresAt: Date; usedAt: Date | null }
export type AttemptResult = { result: 'OK' | 'WRONG' | 'LOCKED' | 'EXPIRED' | 'USED'; attempts: number };

/** What one presented code does to a challenge. Locked, expired and used challenges refuse even the right code and do not count the attempt. */
export function evaluateAttempt(c: ChallengeState, now: Date, codeMatches: boolean): AttemptResult {
  if (c.usedAt || c.status === 'VERIFIED' || c.status === 'REVOKED') return { result: 'USED', attempts: c.attempts };
  if (c.status === 'LOCKED' || c.attempts >= c.maxAttempts) return { result: 'LOCKED', attempts: c.attempts };
  if (c.status === 'EXPIRED' || now.getTime() > c.expiresAt.getTime()) return { result: 'EXPIRED', attempts: c.attempts };
  const attempts = c.attempts + 1;
  if (codeMatches) return { result: 'OK', attempts };
  return { result: attempts >= c.maxAttempts ? 'LOCKED' : 'WRONG', attempts };
}

export function canResend(lastCreatedAt: Date | null, now: Date, cooldownSeconds: number): boolean { return !lastCreatedAt || now.getTime() - lastCreatedAt.getTime() >= cooldownSeconds * 1000; }

/** E.164 for Indian mobile numbers written the usual ways, and any number already in international form. null for everything else. */
export function normalisePhoneE164(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const t = input.trim();
  if (!t) return null;
  const digits = t.replace(/\D/g, '');
  if (t.startsWith('+')) return digits.length >= 8 && digits.length <= 15 && !digits.startsWith('0') ? `+${digits}` : null;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `+91${digits.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}
