import { BadRequestException, ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import { shortfallHint, WalletRuleError } from './core/wallet-core';

/**
 * Stable machine codes of the wallet and the services built on it (Batch 4). A screen switches on `code`, never on the sentence. The exception filter passes them through,
 * together with the numeric fields in WALLET_NUMERIC_FIELDS (the shortfall and the top-up hint).
 */
export const WALLET_ERROR_CODES = [
  'WALLET_NOT_ACTIVE', 'WALLET_FROZEN', 'INSUFFICIENT_WALLET', 'WALLET_TOPUP_NOT_CONFIGURED', 'WALLET_TOPUP_AMOUNT_INVALID', 'WALLET_TOPUP_NOT_FOUND', 'WALLET_TOPUP_STATE_INVALID',
  'WALLET_IDEMPOTENCY_CONFLICT', 'WALLET_AMOUNT_INVALID', 'WALLET_HOLD_INVALID', 'WALLET_ADJUST_INVALID', 'WALLET_REVERSAL_INVALID', 'WALLET_EXPIRY_INVALID', 'WALLET_PROFILE_INVALID', 'WALLET_STATEMENT_PERIOD_INVALID',
  'WALLET_RENEWAL_INVALID', 'TAX_NOT_CONFIGURED',
] as const;
export type WalletErrorCode = (typeof WALLET_ERROR_CODES)[number];
/** Numeric (or boolean) fields an error may carry to the client. */
export const WALLET_NUMERIC_FIELDS = ['shortfallPaise', 'suggestedTopupPaise', 'minTopupPaise', 'maxTopupPaise', 'availablePaise', 'requiredPaise'] as const;

export function walletError(code: WalletErrorCode, message: string, extra: Record<string, unknown> = {}): { message: string; code: WalletErrorCode } & Record<string, unknown> { return { message, code, ...extra }; }

export interface TopupLimits { minPaise: number | null; maxPaise: number | null }

/** The HTTP form of a rule error. An INSUFFICIENT_WALLET answer carries the exact shortfall and the top-up that would cover it inside the staff limits. */
export function walletHttpError(e: WalletRuleError, limits: TopupLimits = { minPaise: null, maxPaise: null }): HttpException {
  switch (e.code) {
    case 'AMOUNT_INVALID': return new BadRequestException(walletError('WALLET_AMOUNT_INVALID', e.message));
    case 'INSUFFICIENT_WALLET': {
      const shortfall = typeof e.extra.shortfallPaise === 'number' ? e.extra.shortfallPaise : 0;
      const h = shortfallHint(shortfall, limits.minPaise, limits.maxPaise);
      return new ConflictException(walletError('INSUFFICIENT_WALLET', 'Your wallet does not have enough available for this. Add credit to continue.', {
        shortfallPaise: h.shortfallPaise, ...(h.suggestedTopupPaise !== null ? { suggestedTopupPaise: h.suggestedTopupPaise, minTopupPaise: h.minTopupPaise, maxTopupPaise: h.maxTopupPaise } : {}),
        ...(typeof e.extra.availablePaise === 'number' ? { availablePaise: e.extra.availablePaise } : {}), ...(typeof e.extra.requiredPaise === 'number' ? { requiredPaise: e.extra.requiredPaise } : {}),
      }));
    }
    case 'HOLD_NOT_ENOUGH': return new ConflictException(walletError('WALLET_HOLD_INVALID', e.message));
    case 'ADJUST_UNDERCUTS_HOLDS': return new ConflictException(walletError('WALLET_ADJUST_INVALID', e.message, typeof e.extra.availablePaise === 'number' ? { availablePaise: e.extra.availablePaise } : {}));
    case 'REVERSAL_INVALID': return new ConflictException(walletError('WALLET_REVERSAL_INVALID', e.message));
    case 'EXPIRY_INVALID': return new ConflictException(walletError('WALLET_EXPIRY_INVALID', e.message));
  }
}

export const notActive = (): ForbiddenException => new ForbiddenException(walletError('WALLET_NOT_ACTIVE', 'Your wallet opens after your first Pro plan term is paid.'));
export const frozen = (): ForbiddenException => new ForbiddenException(walletError('WALLET_FROZEN', 'This wallet is on hold. Please contact support.'));
