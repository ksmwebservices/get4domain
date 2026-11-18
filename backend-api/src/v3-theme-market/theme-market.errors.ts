import { HttpException } from '@nestjs/common';
import type { PackageProblem } from './core/theme-package-core';

/** Stable machine codes of the theme marketplace. A screen switches on `code`, never on the sentence. Registered with the exception filter through BUSINESS_ERROR_CODES (see v3-business/business.errors.ts). */
export const THEME_MARKET_ERROR_CODES = [
  'THEME_PACKAGE_MISSING', 'THEME_PACKAGE_TOO_LARGE', 'THEME_PACKAGE_INVALID', 'THEME_KEY_RESERVED', 'THEME_VERSION_EXISTS', 'THEME_NOT_FOUND', 'THEME_STATE_INVALID', 'THEME_PUBLISH_BLOCKED',
  'THEME_VENDOR_NOT_FOUND', 'THEME_CONSENT_REQUIRED', 'THEME_PRIVATE_CONTENT', 'THEME_NOT_AVAILABLE', 'THEME_PREVIEW_FAILED', 'THEME_FILTER_INVALID',
] as const;
export type ThemeMarketErrorCode = (typeof THEME_MARKET_ERROR_CODES)[number];

export const themeError = (status: number, code: ThemeMarketErrorCode, message: string, extra: Record<string, unknown> = {}): HttpException => new HttpException({ message, code, ...extra }, status);

/** A refused package: one registered code, and EVERY problem with the file and the rule named (the filter passes `problems` through). */
export const packageInvalid = (problems: readonly PackageProblem[], code: 'THEME_PACKAGE_INVALID' | 'THEME_PUBLISH_BLOCKED' | 'THEME_PRIVATE_CONTENT' = 'THEME_PACKAGE_INVALID', status = 422): HttpException => {
  const shown = problems.slice(0, 100).map((p) => ({ file: p.file.slice(0, 200), rule: p.rule, message: p.message.slice(0, 300), source: p.source }));
  return themeError(status, code, `The theme package has ${problems.length} problem${problems.length === 1 ? '' : 's'}; fix them and upload again.`, { problems: shown, problemCount: problems.length });
};
