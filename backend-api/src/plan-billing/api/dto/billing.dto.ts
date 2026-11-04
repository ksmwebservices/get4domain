import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateOrderDto {
  @IsString() @MaxLength(60) @Matches(/^[a-z][a-z0-9_]*$/, { message: 'planKey must be a plan key such as handyman_pro' }) planKey!: string;
  @Type(() => Number) @IsInt() @IsIn([3, 6, 12]) termMonths!: number;
  @IsString() @MinLength(8) @MaxLength(80) @Matches(/^[A-Za-z0-9_-]+$/, { message: 'idempotencyKey may only hold letters, digits, dash and underscore' }) idempotencyKey!: string;
  @IsOptional() @IsString() @MaxLength(40) promoCode?: string;
}
export class ConfirmOrderDto {
  @IsString() @MaxLength(60) @Matches(/^pay_[A-Za-z0-9]+$/, { message: 'paymentId must be a payment id' }) paymentId!: string;
  @IsString() @MaxLength(200) @Matches(/^[0-9a-f]{64}$/, { message: 'signature must be the 64 character signature from the payment' }) signature!: string;
}
export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class AdminOrdersDto extends PageDto {
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @IsIn(['CREATED', 'PENDING_PAYMENT', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REVIEW']) status?: 'CREATED' | 'PENDING_PAYMENT' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REVIEW';
}
export class AdminEventsDto extends PageDto {
  @IsOptional() @IsString() @MaxLength(64) orderId?: string;
}
export class MarkPaidDto {
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}
export class RefundDto {
  @Type(() => Number) @IsInt() @Min(1) amountPaise!: number;
  @IsString() @MinLength(3) @MaxLength(300) note!: string;
}
