import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const KEY = /^[A-Za-z0-9_:-]+$/;
const KEY_MSG = 'idempotencyKey may only hold letters, digits, dash, colon and underscore';

/** The service re-checks the amount against the staff limits; these keep absurd input out. */
export class CreateTopupDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000_000) amountPaise!: number;
  @IsString() @MinLength(8) @MaxLength(80) @Matches(KEY, { message: KEY_MSG }) idempotencyKey!: string;
}
export class ConfirmTopupDto {
  @IsString() @MaxLength(60) @Matches(/^pay_[A-Za-z0-9]+$/, { message: 'paymentId must be a payment id' }) paymentId!: string;
  @IsString() @MaxLength(200) @Matches(/^[0-9a-f]{64}$/, { message: 'signature must be the 64 character signature from the payment' }) signature!: string;
}
export class BillingProfileDto {
  @IsOptional() @IsString() @MaxLength(2) stateCode?: string;
  @IsOptional() @IsString() @MaxLength(15) gstin?: string;
}
export class WalletPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
/** A period for the usage statement: two dates (ISO), both optional. The service refuses an end before the start. */
export class UsageStatementDto {
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
}
export class AdminWalletsDto extends WalletPageDto {
  @IsOptional() @IsIn(['INACTIVE', 'ACTIVE', 'FROZEN']) status?: 'INACTIVE' | 'ACTIVE' | 'FROZEN';
}
export class AdjustWalletDto {
  @Type(() => Number) @IsInt() @Min(-1_000_000_000) @Max(1_000_000_000) amountPaise!: number;
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
  @IsString() @MinLength(8) @MaxLength(80) @Matches(KEY, { message: KEY_MSG }) idempotencyKey!: string;
}
export class FreezeWalletDto {
  @IsBoolean() frozen!: boolean;
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
}
