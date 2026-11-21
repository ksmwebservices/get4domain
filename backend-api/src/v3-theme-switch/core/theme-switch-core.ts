/**
 * The pure rules of the Theme Switch Service (slice 5.16d, owner rule 4). PURE: no database, no Nest, no clock. Nothing here knows a price.
 *
 * One theme is included in the Pro subscription: the FIRST switch (the first Pro theme, also the one made at the Free to Pro upgrade). A renewal does NOT give another. Every later switch is charged by the
 * Theme Switch Service fee from the price book. A staff gift (COMPLIMENTARY_STAFF) and a restore after a lapse (RESTORE) are neither: they neither use up the included switch nor count as a paid one.
 * Only APPLIED switches count: a pending or failed one never happened, so it neither uses the included switch nor is charged.
 */
export type SwitchKind = 'FREE_INCLUDED' | 'PAID' | 'COMPLIMENTARY_STAFF' | 'RESTORE';
export type SwitchStatus = 'PENDING' | 'APPLIED' | 'FAILED';
export interface PriorSwitch { kind: SwitchKind; status: SwitchStatus }

/** The two kinds that are real switches in the sense of the rule. */
export const countsAsSwitch = (kind: SwitchKind): boolean => kind === 'FREE_INCLUDED' || kind === 'PAID';

export function feeDecision(prior: readonly PriorSwitch[], o: { restore: boolean; staffComplimentary: boolean }): { kind: SwitchKind } {
  if (o.restore) return { kind: 'RESTORE' };
  if (o.staffComplimentary) return { kind: 'COMPLIMENTARY_STAFF' };
  const used = prior.some((p) => p.status === 'APPLIED' && countsAsSwitch(p.kind));
  return { kind: used ? 'PAID' : 'FREE_INCLUDED' };
}

// ───────────────────────────────────────────────────────────────────────────────────────── what a theme draws
const SLOT = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)/g;
const DIRECTIVE = /data-g4d-(?:each|if)\s*=\s*"\s*([A-Za-z_][A-Za-z0-9_]*)/g;

/**
 * The top-level content names a theme's templates draw: the first name of every {{slot}} and of every data-g4d-each / data-g4d-if. A heuristic over the theme's own templates (this repository
 * has no separate map of editable fields); it only decides what is LISTED as "not shown by this theme". It never decides what is kept: nothing the vendor wrote is ever removed.
 */
export function usedFieldsOfTemplates(templates: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const t of templates) { for (const m of t.matchAll(SLOT)) out.add(m[1]); for (const m of t.matchAll(DIRECTIVE)) out.add(m[1]); }
  return out;
}

/** The vendor's content fields the new theme does not draw, sorted, once each. When the theme's use of fields is unknown (null) nothing is claimed to be hidden. */
export function hiddenFields(contentFields: readonly string[], used: ReadonlySet<string> | null): string[] {
  if (used === null) return [];
  return [...new Set(contentFields.filter((f) => !used.has(f)))].sort();
}
