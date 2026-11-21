import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

// ── public ──
export class UtmDto {
  @IsOptional() @IsString() @MaxLength(80) source?: string;
  @IsOptional() @IsString() @MaxLength(80) medium?: string;
  @IsOptional() @IsString() @MaxLength(80) campaign?: string;
}
class CommonDto {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(30) phone!: string;
  @IsOptional() @IsString() @MaxLength(254) email?: string | null;
  @IsString() @MaxLength(80) idempotencyKey!: string;
  /** the honeypot: a real form leaves it empty */
  @IsOptional() @IsString() @MaxLength(500) website?: string;
  @IsOptional() @IsString() @Matches(/^\d{6}$/) otp?: string;
  @IsObject() consent!: Record<string, unknown>;
  @IsOptional() @IsObject() utm?: UtmDto;
  @IsOptional() @IsString() @MaxLength(80) dirRef?: string;
}
export class SubmitRequestDto extends CommonDto {
  @IsString() @MaxLength(30) kind!: string;
  @IsObject() payload!: Record<string, unknown>;
}
export class OrderLineDto {
  @IsString() @MaxLength(80) productRef!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) qty!: number;
}
export class ShippingDto {
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(10) pincode?: string;
}
export class SubmitOrderDto extends CommonDto {
  @IsArray() items!: OrderLineDto[];
  @IsOptional() @IsString() @MaxLength(40) couponCode?: string;
  @IsOptional() @IsIn(['ONLINE', 'COD', 'AT_VISIT', 'MANUAL']) payWith?: 'ONLINE' | 'COD' | 'AT_VISIT' | 'MANUAL';
  @IsOptional() @IsObject() shipping?: ShippingDto;
}
export class ReportDto {
  @IsString() @MaxLength(253) host!: string;
  @IsOptional() @IsString() @MaxLength(40) reasonKind?: string;
  @IsOptional() @IsString() @MaxLength(500) text?: string;
  @IsOptional() @IsString() @MaxLength(254) contact?: string;
}

// ── vendor ──
const STATUSES = ['RECEIVED', 'DELIVERED', 'SEEN', 'RESPONDED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'EXPIRED', 'SPAM'];
export class InboxQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsIn(STATUSES) status?: string;
  @IsOptional() @IsIn(['ENQUIRY', 'APPOINTMENT', 'QUOTE', 'PRODUCT_ENQUIRY', 'ORDER_REQUEST', 'ORDER']) kind?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @IsString() @MaxLength(80) @Matches(/^[\p{L}\p{N} .'-]*$/u) q?: string;
}
export class RespondDto {
  @IsOptional() @IsIn(STATUSES) status?: string;
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
}
export class LinkDto {
  @IsOptional() @IsString() @MaxLength(64) customerId?: string;
  @IsOptional() @IsString() @MaxLength(64) bookingId?: string;
}
export class PaymentMethodDto {
  /** The gateway kinds are not offered to V3 vendors: the service rejects them with PAYMENT_METHOD_INVALID. They are accepted by the DTO only so the answer is the same plain message. */
  @IsIn(['UPI', 'PAY_ON_DELIVERY', 'PAY_AT_VISIT', 'BANK_TRANSFER', 'OWN_GATEWAY', 'GATEWAY_RAZORPAY', 'GATEWAY_CASHFREE', 'GATEWAY_PAYTM']) kind!: 'UPI' | 'PAY_ON_DELIVERY' | 'PAY_AT_VISIT' | 'BANK_TRANSFER';
  @IsString() @MinLength(2) @MaxLength(60) label!: string;
  /** UPI only: the vendor's own UPI id, for example name@bank */
  @IsOptional() @IsString() @MaxLength(300) upiId?: string;
  /** UPI only: the name the customer sees in their UPI app */
  @IsOptional() @IsString() @MaxLength(120) payeeName?: string;
  /** bank transfer only, write-only */
  @IsOptional() @IsString() @MaxLength(300) details?: string;
  /** bank transfer only: show the bank details to customers (default false) */
  @IsOptional() @IsBoolean() showToCustomers?: boolean;
}
export class PaymentMethodUpdateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) label?: string;
  @IsOptional() @IsIn(['UNVERIFIED', 'ACTIVE', 'DISABLED']) status?: 'UNVERIFIED' | 'ACTIVE' | 'DISABLED';
  @IsOptional() @IsString() @MaxLength(300) upiId?: string;
  @IsOptional() @IsString() @MaxLength(120) payeeName?: string;
  /** required true when upiId differs from the stored one */
  @IsOptional() @IsBoolean() confirmUpiChange?: boolean;
  @IsOptional() @IsString() @MaxLength(300) details?: string;
  @IsOptional() @IsBoolean() showToCustomers?: boolean;
}
export class OrderListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsIn(['PLACED', 'AWAITING_PAYMENT', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED_RECORDED']) status?: 'PLACED' | 'AWAITING_PAYMENT' | 'PAID' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'REFUNDED_RECORDED';
}
export class TrackingDto {
  @IsOptional() @IsString() @MaxLength(60) carrier?: string;
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
  @IsOptional() @IsString() @MaxLength(300) url?: string;
}
export class OrderStatusDto {
  @IsIn(['PLACED', 'AWAITING_PAYMENT', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED_RECORDED']) status!: 'PLACED' | 'AWAITING_PAYMENT' | 'PAID' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'REFUNDED_RECORDED';
  @IsOptional() @IsObject() tracking?: TrackingDto;
}
export class RefundDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000_000) amountPaise!: number;
}
export class VoidDto {
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
}
export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class OfferDto {
  @IsIn(['BANNER', 'COUPON']) kind!: 'BANNER' | 'COUPON';
  @IsString() @MinLength(2) @MaxLength(80) title!: string;
  @IsOptional() @IsString() @MaxLength(20) code?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) percentOff?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000_000) flatPaise?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000_000) minOrderPaise?: number;
  @IsOptional() @IsISO8601() startsAt?: string;
  @IsOptional() @IsISO8601() endsAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000) usageLimit?: number;
}
export class OfferUpdateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) title?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) percentOff?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000_000) flatPaise?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000_000) minOrderPaise?: number;
  @IsOptional() @IsISO8601() startsAt?: string;
  @IsOptional() @IsISO8601() endsAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000) usageLimit?: number;
  @IsOptional() @IsIn(['ACTIVE', 'PAUSED', 'ENDED']) status?: 'ACTIVE' | 'PAUSED' | 'ENDED';
}
export class StockDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) onHand!: number;
}

// ── staff ──
export class StaffRequestsQueryDto extends InboxQueryDto {
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
}
export class OutboxQueryDto extends PageDto {
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @IsString() @MaxLength(64) requestId?: string;
}
export class ReportsQueryDto extends PageDto {
  @IsOptional() @IsIn(['OPEN', 'REVIEWED', 'ACTIONED', 'REJECTED']) status?: 'OPEN' | 'REVIEWED' | 'ACTIONED' | 'REJECTED';
}
export class HandleReportDto {
  @IsIn(['REVIEWED', 'ACTIONED', 'REJECTED']) status!: 'REVIEWED' | 'ACTIONED' | 'REJECTED';
  /** with ACTIONED: suspend this vendor (public forms and checkout stop at once); needs a reason */
  @IsOptional() @IsString() @MaxLength(64) suspendVendorId?: string;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(300) reason?: string;
}
export class BlockDto {
  @IsIn(['PHONE', 'EMAIL', 'IP_HASH']) kind!: 'PHONE' | 'EMAIL' | 'IP_HASH';
  @IsString() @MaxLength(254) value!: string;
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
}
