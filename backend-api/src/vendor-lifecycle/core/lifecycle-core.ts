/**
 * Pure rules of slice 5.1d (owner rule 9). No clock, randomness, network or database in this file.
 *
 * A site or listing is hidden or deleted in exactly TWO cases: (a) the vendor personally asks for deletion (identity re-checked with a fresh one-time code), (b) staff delete an
 * EMPTY listing. Everything else (an expired plan, a suspension, a pending vendor) keeps the site and the listing live; Pro features stop.
 */

/** What exists on a business's listing. Names, categories and cities are NOT business details for this check (an empty listing still needs a name to be found). */
export interface ListingFacts {
  /** whether a directory business row exists at all */
  hasListing: boolean;
  phone: string | null;
  /** any non-empty address part: line, area, city is NOT counted (the city is how the listing was filed), pincode and street lines are */
  addressDetail: boolean;
  description: string | null;
  services: number;
  media: number;
}

export type ExistingDetail = 'PHONE' | 'ADDRESS' | 'DESCRIPTION' | 'SERVICES' | 'MEDIA';

/**
 * The exact rule for "an empty listing that has no business details": it has NO phone, NO address detail, NO description, NO services and NO media. Whitespace-only text
 * counts as nothing. A vendor with no listing at all is also empty (there is nothing to show). The refusal lists every detail that exists.
 */
export function emptyListingCheck(f: ListingFacts): { empty: boolean; existing: ExistingDetail[] } {
  const existing: ExistingDetail[] = [];
  if ((f.phone ?? '').trim().length > 0) existing.push('PHONE');
  if (f.addressDetail) existing.push('ADDRESS');
  if ((f.description ?? '').trim().length > 0) existing.push('DESCRIPTION');
  if (f.services > 0) existing.push('SERVICES');
  if (f.media > 0) existing.push('MEDIA');
  return { empty: existing.length === 0, existing };
}

/** Does an address object carry detail beyond the city? Keys other than city and state with a non-blank string count. */
export function addressHasDetail(address: unknown): boolean {
  if (!address || typeof address !== 'object') return false;
  return Object.entries(address as Record<string, unknown>).some(([k, v]) => !['city', 'state', 'country'].includes(k.toLowerCase()) && typeof v === 'string' && v.trim().length > 0);
}

/** New end of a grace period: from the LATER of now and the current grace end, plus the days. Bounded by the setting. */
export function extendedGraceEnd(args: { endsAt: Date | null; graceEndsAt: Date | null; graceDays: number; now: Date; addDays: number; maxDays: number }): Date {
  if (!Number.isInteger(args.addDays) || args.addDays < 1) throw new RangeError('days must be a whole number of at least 1');
  if (args.addDays > args.maxDays) throw new RangeError(`days cannot exceed ${args.maxDays}`);
  const DAY = 86_400_000;
  const currentEnd = args.graceEndsAt ?? (args.endsAt ? new Date(args.endsAt.getTime() + Math.max(0, args.graceDays) * DAY) : args.now);
  const base = currentEnd.getTime() > args.now.getTime() ? currentEnd : args.now;
  return new Date(base.getTime() + args.addDays * DAY);
}

export type DeletionStep = 'CODE_SENT' | 'REQUESTED';

/** A reason is mandatory for staff overrides. Trimmed, 5 to 300 characters. */
export function cleanReason(reason: unknown): string | null {
  if (typeof reason !== 'string') return null;
  const r = reason.trim();
  return r.length >= 5 && r.length <= 300 ? r : null;
}
