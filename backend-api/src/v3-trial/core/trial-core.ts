/**
 * Self-service signup naming (Wave 3 Part G). PURE: no database, no clock. The rules about WHICH names are allowed are validateSubdomainSlug (length, characters, look-alike folding, reserved and blocked words);
 * this file only turns a business name into candidate names and shapes the plain answers of the public availability check.
 */
export const SLUG_FALLBACK = 'site';

/** "Kumar & Sons Garage!" -> "kumar-sons-garage": lower case, letters and digits, single hyphens, at most `max` characters, never empty. */
export function slugFromName(name: unknown, max = 40): string {
  const base = String(name ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '');
  return base || SLUG_FALLBACK;
}

/** base, base-2, base-3 ... each kept within `max`, so the suffix never pushes a name over the limit. */
export function candidateSlug(base: string, n: number, max = 40): string {
  if (n <= 1) return base.slice(0, max).replace(/-+$/g, '') || SLUG_FALLBACK;
  const suffix = `-${n}`;
  return `${base.slice(0, Math.max(1, max - suffix.length)).replace(/-+$/g, '')}${suffix}`;
}

/** A name shorter than the minimum is lengthened with a neutral word, never padded with random characters. */
export function padToMinimum(slug: string, min: number): string { return slug.length >= min ? slug : `${slug}-${SLUG_FALLBACK}`.slice(0, Math.max(min, slug.length + SLUG_FALLBACK.length + 1)); }

export type AvailabilityReason = 'AVAILABLE' | 'INVALID' | 'RESERVED' | 'UNAVAILABLE';
export interface Availability { available: boolean; name: string | null; reason: AvailabilityReason; message: string }

export const AVAILABILITY_MESSAGES: Readonly<Record<AvailabilityReason, string>> = Object.freeze({
  AVAILABLE: 'That address is free.',
  INVALID: 'That name is not valid.',
  RESERVED: 'That name is reserved. Please choose another.',
  UNAVAILABLE: 'That address is not available.',
});

/** One answer for a taken name and a blocked one (UNAVAILABLE), so the check is not an oracle for who owns what or which words are blocked. */
export const availability = (reason: AvailabilityReason, name: string | null, message?: string): Availability => ({ available: reason === 'AVAILABLE', name: reason === 'AVAILABLE' ? name : null, reason, message: message ?? AVAILABILITY_MESSAGES[reason] });
