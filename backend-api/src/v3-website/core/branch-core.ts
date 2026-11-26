import { buildDirectionsUrl } from './location-core';

/**
 * Branches (Website Manager lane A, item e), pure. A business can list several places: each has a name, an address line, the village or locality, the area, the city, a pincode and
 * the Google Maps link the owner pasted. The main address stays in the single `location`; branches are extra. A branch with no pasted map link gets the same built directions
 * link as the main location (a search for its address), never a fetched one.
 */
export const BRANCHES_MAX = 30;
export interface BranchRow { name: string; addressLine?: string; locality?: string; area?: string; city?: string; pincode?: string; mapLink?: string }

/** The parts of a branch row that are more than plain text. Null when fine. */
export function branchProblem(row: Record<string, string | boolean>): { message: string; field: string } | null {
  const pin = String(row.pincode ?? '');
  if (pin !== '' && !/^\d{6}$/.test(pin)) return { message: 'The pincode must be six digits.', field: 'pincode' };
  const link = String(row.mapLink ?? '');
  if (link !== '' && !/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(link)) return { message: 'Paste the link you get from Google Maps (it starts with https://www.google.com/maps or https://maps.app.goo.gl).', field: 'mapLink' };
  return null;
}

/** The address as one line: address line, locality, area, city and pincode, empty parts left out. */
export const branchAddress = (b: Pick<BranchRow, 'addressLine' | 'locality' | 'area' | 'city' | 'pincode'>): string =>
  [b.addressLine, b.locality, b.area, b.city, b.pincode].map((s) => String(s ?? '').trim()).filter(Boolean).join(', ');

/** The pasted map link when there is one, else a built directions link for the address, else nothing. */
export function directionsFor(b: BranchRow): string {
  const pasted = String(b.mapLink ?? '').trim();
  if (pasted) return pasted;
  return buildDirectionsUrl({ addressLine1: b.addressLine, addressLine2: [b.locality, b.area].filter(Boolean).join(', '), city: b.city, pincode: b.pincode }) ?? '';
}
