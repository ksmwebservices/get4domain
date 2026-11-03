/**
 * Stable machine codes of the site publish slice (docs/v3/V3_S4_RENDERER_PUBLISH.md section 8). A screen switches on `code`, never on the sentence.
 * The HTTP exception filter passes these through (additive to the plan and provisioning codes), together with `missing` for PUBLISH_BLOCKED.
 * FEATURE_LOCKED (a plan lock) is the existing slice 5.1 code.
 */
export const SITE_ERROR_CODES = ['THEME_INVALID', 'THEME_LOCKED', 'SITE_BUDGET_EXCEEDED', 'PUBLISH_BLOCKED', 'PUBLICATION_NOT_FOUND'] as const;
export type SiteErrorCode = (typeof SITE_ERROR_CODES)[number];

export interface MissingField { code: string; label: string }

export function siteError(code: SiteErrorCode, message: string, extra: { missing?: MissingField[]; feature?: string; upsellText?: string | null } = {}): { message: string; code: SiteErrorCode; missing?: MissingField[] } {
  return { message, code, ...extra };
}
