import { SITE_FIELDS } from './site-doc.constants';

/** The vendor's site as it would look if the draft were published: the published row with the pending edits laid over it. */
export function overlayDraft<T extends { draft?: unknown }>(row: T): Omit<T, 'draft'> {
  const { draft, ...live } = row;
  const patch = (draft && typeof draft === 'object' && !Array.isArray(draft) ? draft : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...live };
  for (const f of SITE_FIELDS) if (f in patch) out[f] = patch[f];
  return out as Omit<T, 'draft'>;
}

/** True when the draft holds at least one change from what is live. */
export function draftDiffers(row: { draft?: unknown } & Record<string, unknown>): boolean {
  const patch = (row.draft && typeof row.draft === 'object' && !Array.isArray(row.draft) ? row.draft : {}) as Record<string, unknown>;
  return SITE_FIELDS.some((f) => f in patch && JSON.stringify(patch[f] ?? null) !== JSON.stringify(row[f] ?? null) && !(patch[f] === '' && (row[f] === null || row[f] === undefined)));
}
