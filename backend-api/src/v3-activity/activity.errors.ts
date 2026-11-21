import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

/** Stable machine codes of the activity log and alerts (slice 5.20). A screen switches on `code`, never on the sentence. The exception filter passes them through. */
export const ACTIVITY_ERROR_CODES = ['ALERT_NOT_FOUND', 'ALERT_STALE', 'ALERT_INVALID', 'ALERT_RULE_UNKNOWN', 'ALERT_RULE_INVALID', 'ALERT_RULE_NEEDS_THRESHOLD'] as const;
export type ActivityErrorCode = (typeof ACTIVITY_ERROR_CODES)[number];
const body = (code: ActivityErrorCode, message: string, extra: Record<string, unknown> = {}): { message: string; code: ActivityErrorCode } & Record<string, unknown> => ({ message, code, ...extra });
export const alertNotFound = (): NotFoundException => new NotFoundException(body('ALERT_NOT_FOUND', 'That alert does not exist.'));
export const alertStale = (): ConflictException => new ConflictException(body('ALERT_STALE', 'Someone else changed this alert just now. Reload it and try again.'));
export const alertInvalid = (message: string): BadRequestException => new BadRequestException(body('ALERT_INVALID', message));
export const ruleUnknown = (): NotFoundException => new NotFoundException(body('ALERT_RULE_UNKNOWN', 'That alert rule does not exist.'));
export const ruleInvalid = (message: string): BadRequestException => new BadRequestException(body('ALERT_RULE_INVALID', message));
export const ruleNeedsThreshold = (key: string): BadRequestException => new BadRequestException(body('ALERT_RULE_NEEDS_THRESHOLD', 'This rule needs its numbers set before it can be switched on.', { problem: key }));
