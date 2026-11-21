import { ConflictException, NotFoundException } from '@nestjs/common';

/** Stable machine codes of the service catalogue, the price book and the packs (slice 5.16b). A screen switches on `code`, never on the sentence. The exception filter passes them through. */
export const SERVICES_ERROR_CODES = [
  'SERVICE_NOT_FOUND', 'SERVICE_INVALID', 'SERVICE_KEY_TAKEN', 'SERVICE_PRICE_NOT_FOUND', 'SERVICE_PRICE_INVALID', 'SERVICE_PRICE_STATE', 'PACK_NOT_FOUND', 'PACK_INVALID', 'PACK_KEY_TAKEN',
  'PACK_NOT_PURCHASABLE', 'SERVICE_PRICE_NOT_SET', 'SERVICE_PLAN_STATE', 'SERVICE_TRACK',
] as const;
export type ServicesErrorCode = (typeof SERVICES_ERROR_CODES)[number];
export const servicesError = (code: ServicesErrorCode, message: string, extra: Record<string, unknown> = {}): { message: string; code: ServicesErrorCode } & Record<string, unknown> => ({ message, code, ...extra });

export const serviceNotFound = (): NotFoundException => new NotFoundException(servicesError('SERVICE_NOT_FOUND', 'That service does not exist.'));
export const packNotFound = (): NotFoundException => new NotFoundException(servicesError('PACK_NOT_FOUND', 'That pack does not exist.'));
export const priceNotFound = (): NotFoundException => new NotFoundException(servicesError('SERVICE_PRICE_NOT_FOUND', 'That price does not exist.'));
export const conflict = (code: ServicesErrorCode, message: string, extra: Record<string, unknown> = {}): ConflictException => new ConflictException(servicesError(code, message, extra));
