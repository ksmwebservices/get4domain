import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

/** Stable machine codes of the theme switch (slice 5.16d). A screen switches on `code`, never on the sentence. The exception filter passes them through. */
export const THEME_SWITCH_ERROR_CODES = [
  'THEME_ALREADY_ACTIVE', 'THEME_NOT_ALLOWED', 'THEME_SWITCH_PLAN_STATE', 'THEME_SWITCH_FAILED', 'THEME_SWITCH_INVALID', 'THEME_SWITCH_FREE_USE_DIRECT', 'THEME_SWITCH_NOT_FOUND', 'THEME_SWITCH_RETRY',
] as const;
export type ThemeSwitchErrorCode = (typeof THEME_SWITCH_ERROR_CODES)[number];
export const themeError = (code: ThemeSwitchErrorCode, message: string, extra: Record<string, unknown> = {}): { message: string; code: ThemeSwitchErrorCode } & Record<string, unknown> => ({ message, code, ...extra });
export const themeConflict = (code: ThemeSwitchErrorCode, message: string, extra: Record<string, unknown> = {}): ConflictException => new ConflictException(themeError(code, message, extra));
export const themeInvalid = (message: string, extra: Record<string, unknown> = {}): BadRequestException => new BadRequestException(themeError('THEME_SWITCH_INVALID', message, extra));
export const themeNotFound = (): NotFoundException => new NotFoundException(themeError('THEME_SWITCH_NOT_FOUND', 'That theme switch does not exist.'));
