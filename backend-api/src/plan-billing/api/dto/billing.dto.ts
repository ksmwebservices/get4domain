import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateOrderDto {
  @IsString() @MaxLength(60) @Matches(/^[a-z][a-z0-9_]*$/, { message: 'planKey must be a plan key such as handyman_pro' }) planKey!: string;
  @Type(() => Number) @IsInt() @IsIn([3, 6, 12]) termMonths!: number;
  @IsString() @MinLength(8) @MaxLength(80) @Matches(/^[A-Za-z0-9_-]+$/, { message: 'idempotencyKey may only hold letters, digits, dash and underscore' }) idempotencyKey!: string;
}
/** Razorpay hands the browser a payment id and a signature, and both are required for it (the service refuses a missing one with PAYMENT_SIGNATURE_INVALID). Cashfree signs no return: the body may be empty and the server asks the gateway. */
export class ConfirmOrderDto {
  @IsOptional() @IsString() @MaxLength(60) @Matches(/^pay_[A-Za-z0-9]+$/, { message: 'paymentId must be a payment id' }) paymentId?: string;
  @IsOptional() @IsString() @MaxLength(200) @Matches(/^[0-9a-f]{64}$/, { message: 'signature must be the 64 character signature from the payment' }) signature?: string;
}
export class UpdateGatewayDto {
  @IsOptional() @IsIn(['razorpay', 'cashfree']) gateway?: 'razorpay' | 'cashfree';
  @IsOptional() @IsIn(['off', 'test', 'live']) mode?: 'off' | 'test' | 'live';
}
export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class AdminOrdersDto extends PageDto {
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @IsIn(['CREATED', 'PENDING_PAYMENT', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REVIEW']) status?: 'CREATED' | 'PENDING_PAYMENT' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REVIEW';
}
/** Wave 4 W2: the held payments list. Dates are days (YYYY-MM-DD); the range is by the day the payment was held. */
export class HeldListDto extends PageDto {
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @IsIn(['razorpay', 'cashfree']) gateway?: 'razorpay' | 'cashfree';
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be a day, YYYY-MM-DD' }) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be a day, YYYY-MM-DD' }) to?: string;
}
/**
 * Wave 4 W6: the keys of one gateway. Loose on purpose (every field optional here): the real checks (all fields required, length, no spaces, the Razorpay prefix of the mode, no unknown field) are in the pure
 * credentials core, so every refusal carries the registered code GATEWAY_CREDENTIALS_INVALID and names the FIELD, never a value. A property outside the five is refused by the validation pipe, which names the property and never a value.
 */
export class GatewayCredentialsDto {
  @IsOptional() keyId?: unknown;
  @IsOptional() keySecret?: unknown;
  @IsOptional() webhookSecret?: unknown;
  @IsOptional() appId?: unknown;
  @IsOptional() secretKey?: unknown;
}
/** Wave 4 W2: resolving a held payment. Every field is optional HERE on purpose: the real checks are in the pure held core, so every refusal carries the registered code HELD_PAYMENT_INVALID and names the fields. */
export class HeldResolveDto {
  @IsOptional() action?: unknown;
  @IsOptional() note?: unknown;
  @IsOptional() verifiedAmountPaise?: unknown;
  @IsOptional() gatewayPaymentId?: unknown;
}
export class AdminEventsDto extends PageDto {
  @IsOptional() @IsString() @MaxLength(64) orderId?: string;
}
/**
 * Wave 3 Part E: the cash an ADMIN confirms. Every field is optional HERE on purpose: the real checks (CASH only, the reference, the day received, the amount equal to the order total including GST, the
 * special-case acknowledgement and note) are in the pure cash core, so every refusal carries a registered code and names the fields to fix (a validator here would answer 400 with no code).
 */
export class CashConfirmDto {
  @IsOptional() method?: unknown;
  @IsOptional() reference?: unknown;
  @IsOptional() receivedOn?: unknown;
  @IsOptional() amountPaise?: unknown;
  @IsOptional() specialCase?: unknown;
  @IsOptional() reason?: unknown;
}
export class CreateCashOrderDto {
  @IsString() @MaxLength(60) @Matches(/^[a-z][a-z0-9_]*$/, { message: 'planKey must be a plan key such as handyman_pro' }) planKey!: string;
  @Type(() => Number) @IsInt() @IsIn([3, 6, 12]) termMonths!: number;
  @IsString() @MinLength(8) @MaxLength(80) @Matches(/^[A-Za-z0-9_-]+$/, { message: 'idempotencyKey may only hold letters, digits, dash and underscore' }) idempotencyKey!: string;
}
export class RefundDto {
  @Type(() => Number) @IsInt() @Min(1) amountPaise!: number;
  @IsString() @MinLength(3) @MaxLength(300) note!: string;
}
