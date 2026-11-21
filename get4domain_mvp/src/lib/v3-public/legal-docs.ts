import { LEGAL_DOCS } from './legal-strings';
import type { LegalDocDef } from './legal-meta';

/** Registry helpers. Pure: no framework import. The paths are the public addresses on the main host. */
export const LEGAL_DOC_PATHS: readonly string[] = LEGAL_DOCS.map((d) => d.path);

export function legalDocByPath(path: string): LegalDocDef | null {
  const key = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return LEGAL_DOCS.find((d) => d.path === key) ?? null;
}

/** The internal route (under the v3-site root) that renders a policy, for the host rewrite: `/terms` renders at `/v3-site/terms`. */
export function legalInternalRoute(path: string): string {
  return `/v3-site${path}`;
}

/** The slug segment of a doc path: `/terms` gives `terms`. */
export function legalSlug(path: string): string {
  return path.replace(/^\/+/, '');
}

/** Section ids of a document must be unique, lowercase and safe for an anchor. */
export function sectionIdsOk(doc: LegalDocDef): boolean {
  const ids = doc.sections.map((s) => s.id);
  return new Set(ids).size === ids.length && ids.every((i) => /^[a-z][a-z-]{0,60}$/.test(i));
}
