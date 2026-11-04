/** Pure indexability rules (slice 5.7). The thresholds come from editable settings; this only applies them. */
export interface BusinessForIndexing { status: string; name: string; categoryId: string | null; locationId: string | null; phoneE164: string | null; addressLine: string; descriptionText: string }
export interface IndexingRules { indexUnclaimed: boolean; minDescriptionChars: number }
export type IndexingMissing = 'NAME' | 'CATEGORY' | 'LOCATION' | 'CONTACT' | 'DESCRIPTION' | 'CLAIM' | 'STATUS';

export function evaluateBusinessIndexing(b: BusinessForIndexing, rules: IndexingRules): { indexable: boolean; missing: IndexingMissing[] } {
  if (b.status === 'DRAFT' || b.status === 'SUSPENDED' || b.status === 'REMOVED') return { indexable: false, missing: ['STATUS'] };
  const missing: IndexingMissing[] = [];
  if (!b.name || !b.name.trim()) missing.push('NAME');
  if (!b.categoryId) missing.push('CATEGORY');
  if (!b.locationId) missing.push('LOCATION');
  if (!b.phoneE164 && !(b.addressLine ?? '').trim()) missing.push('CONTACT');
  if ((b.descriptionText ?? '').trim().length < rules.minDescriptionChars) missing.push('DESCRIPTION');
  if (b.status === 'UNCLAIMED' && !rules.indexUnclaimed) missing.push('CLAIM');
  return { indexable: missing.length === 0, missing };
}

/** A location or category page with fewer businesses than the threshold is thin: noindex (it stays reachable). */
export function evaluateListingPageIndexing(businessCount: number, minBusinesses: number): { indexable: boolean; reason: 'THIN' | null } {
  return businessCount < minBusinesses ? { indexable: false, reason: 'THIN' } : { indexable: true, reason: null };
}
