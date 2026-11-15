/**
 * Stable machine codes of the SEO block (docs/v3/V3_SEO_DIRECTORY.md). A screen switches on `code`, never on the sentence. The HTTP exception filter passes them through.
 */
export const SEO_ERROR_CODES = ['SEO_INVALID', 'SEO_NOT_FOUND', 'SEO_DUPLICATE'] as const;
export type SeoErrorCode = (typeof SEO_ERROR_CODES)[number];

export function seoError(code: SeoErrorCode, message: string): { message: string; code: SeoErrorCode } { return { message, code }; }
