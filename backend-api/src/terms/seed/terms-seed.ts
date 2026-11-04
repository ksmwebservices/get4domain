import { PLACEHOLDER_BODY, TERMS_KINDS, TermsKind } from '../core/terms-core';
import { TermsStore } from '../terms.store';

export interface TermsSeedReport { existing: TermsKind[]; missing: TermsKind[]; created: TermsKind[] }

/**
 * The idempotent loader behind scripts/seed-v3-terms.js: one DRAFT version 1 per kind that has no row at all, with the body "To be supplied by counsel". A dry run (the default) writes nothing.
 * It never changes, publishes or retires an existing row, and it has no way to set a status other than DRAFT: only staff publish, through the API, and the API refuses the placeholder.
 */
export async function seedTermsDrafts(store: TermsStore, o: { apply: boolean }): Promise<TermsSeedReport> {
  const have = new Set((await store.listDocuments({})).map((d) => d.kind));
  const missing = TERMS_KINDS.filter((k) => !have.has(k));
  const created = o.apply && missing.length > 0 ? await store.seedMissingDrafts(missing, PLACEHOLDER_BODY) : [];
  return { existing: TERMS_KINDS.filter((k) => have.has(k)), missing, created };
}
