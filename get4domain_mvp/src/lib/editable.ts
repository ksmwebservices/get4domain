/**
 * Edit forms start from a loaded record, so the record's bookkeeping keys ride along in the form state. They must never be sent back as part of an
 * edit (Bug B1: the Website Manager's save was refused with "property id should not exist"). Send only what a person can change:
 *   api.updateDoctor(id, editable({ ...form, fee: Number(form.fee) }))
 *   api.updateVendorCMS(id, editable(cms, CMS_FIELDS))        // or an explicit allow-list
 * The server also ignores these keys on edits (EditTolerantValidationPipe), so this is belt and braces; the allow-list form is the strict one.
 */
export const READ_ONLY_KEYS = ['id', 'vendorId', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'nameNormalized', 'openingBalancePaise', 'deliveredAt', 'lastBilledPeriod'] as const;

/** The Website Manager's editable fields. Must equal the API's UpdateVendorCmsDto (minus `portfolio`, saved on its own); scripts/verify-payload-contract.mjs checks it. */
export const CMS_EDITABLE = ['businessName', 'tagline', 'about', 'logo', 'banner', 'themeId', 'favicon', 'seoTitle', 'seoDesc', 'seoKeywords', 'phone', 'email', 'address', 'businessHours', 'whatsapp', 'facebook', 'instagram', 'linkedin', 'youtube', 'googleMaps', 'googleAnalyticsId'] as const;

export function editable<T extends object>(record: T, allow?: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record as Record<string, unknown>)) {
    if (allow ? !allow.includes(k) : (READ_ONLY_KEYS as readonly string[]).includes(k)) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}
