import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

const PLANS = ['WORKSPACE', 'BOS'] as const;
const CYCLES = ['MONTHLY', 'HALF_YEARLY', 'ANNUAL', 'CUSTOM_MONTHS'] as const;
const GST = ['EXCLUSIVE', 'INCLUSIVE', 'NONE'] as const;
const CHANNELS = ['RAZORPAY', 'UPI_QR', 'OFFLINE'] as const;
const KINDS = ['ACTIVATION', 'RENEWAL', 'PLAN_CHANGE', 'ADDON', 'MANAGED_SERVICE'] as const;

export class AddonLineDto {
  @IsIn(['ADDON', 'CUSTOM']) kind!: 'ADDON' | 'CUSTOM';
  @IsString() @MinLength(1) @MaxLength(120) label!: string;
  /** Admin-entered line amount in paise (admin-only tool). */
  @IsInt() @Min(1) @Max(100_00_00_000) amountPaise!: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000) qty?: number;
}

export class DiscountDto {
  @IsIn(['NONE', 'PERCENT', 'FLAT', 'PROMO']) mode!: 'NONE' | 'PERCENT' | 'FLAT' | 'PROMO';
  @IsOptional() @IsNumber() @Min(0) value?: number;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  @IsOptional() @IsString() @MaxLength(20) confirm?: string;
}

export class ProspectDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(120) business?: string;
  @IsOptional() @IsString() @MaxLength(40) demoSubdomain?: string;
}

export class DealSpecDto {
  @IsOptional() @IsString() vendorId?: string;
  @IsOptional() @ValidateNested() @Type(() => ProspectDto) prospect?: ProspectDto;
  @IsOptional() @IsIn(KINDS as unknown as string[]) kind?: (typeof KINDS)[number];
  @IsOptional() @IsIn(PLANS as unknown as string[]) planKey?: (typeof PLANS)[number];
  @IsOptional() @IsIn(CYCLES as unknown as string[]) billingCycle?: (typeof CYCLES)[number];
  @IsOptional() @IsInt() @Min(1) @Max(60) customMonths?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => AddonLineDto) addons?: AddonLineDto[];
  @IsOptional() @ValidateNested() @Type(() => DiscountDto) discount?: DiscountDto;
  @IsOptional() @IsString() @MaxLength(32) promoCode?: string;
  @IsIn(GST as unknown as string[]) gstMode!: (typeof GST)[number];
  @IsOptional() @IsInt() @Min(0) @Max(90) graceDays?: number;
  @IsOptional() @IsArray() @IsIn(CHANNELS as unknown as string[], { each: true }) allowedChannels?: (typeof CHANNELS)[number][];
  @IsOptional() @IsInt() @Min(1) @Max(180) linkExpiryDays?: number;
  @IsOptional() @IsBoolean() allowPromoEntry?: boolean;
  @IsOptional() @IsBoolean() allowPromoStacking?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(90) paymentDueDays?: number;
  /** AI Studio credit override in paise, ₹0…₹5,000 (omit = prorated by term). */
  @IsOptional() @IsInt() @Min(0) @Max(500000) aiCreditPaise?: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class CreateDealInvoiceDto extends DealSpecDto {
  @IsOptional() @IsString() dealId?: string;
  @IsOptional() @IsBoolean() activateNow?: boolean;
  @IsOptional() @IsBoolean() sendNow?: boolean;
}

export class SaveDraftDto extends DealSpecDto {
  @IsOptional() @IsString() dealId?: string;
}

export class PayeeDto {
  @IsOptional() @IsString() @MaxLength(256) upiId?: string;
  @IsOptional() @IsString() @MaxLength(80) payeeName?: string;
  @IsOptional() @IsString() @MaxLength(500) qrImageUrl?: string;
  @IsOptional() @IsString() @MaxLength(80) bankName?: string;
  @IsOptional() @IsString() @MaxLength(80) bankAccountName?: string;
  @IsOptional() @IsString() @MaxLength(30) bankAccountNumber?: string;
  @IsOptional() @IsString() @MaxLength(11) bankIfsc?: string;
  @IsOptional() @IsString() @MaxLength(80) bankBranch?: string;
  @IsOptional() @IsString() @MaxLength(1000) instructions?: string;
}

export class ConfirmPaymentDto {
  /** The amount actually received in the bank, in paise. */
  @ApiProperty({ description: 'Amount actually received, in paise' }) @IsInt() @Min(1) receivedAmountPaise!: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class ReasonDto {
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}

export class SendLinkDto {
  @IsOptional() @IsBoolean() send?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(180) expiryDays?: number;
}

export class PromoCreateDto {
  @IsString() @MinLength(3) @MaxLength(32) code!: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsIn(['PERCENT', 'FLAT']) type!: 'PERCENT' | 'FLAT';
  @IsInt() @Min(1) value!: number;
  @IsOptional() @IsArray() @IsIn(PLANS as unknown as string[], { each: true }) appliesToPlans?: (typeof PLANS)[number][];
  @IsOptional() @IsArray() @IsIn(CYCLES as unknown as string[], { each: true }) appliesToCycles?: (typeof CYCLES)[number][];
  @IsOptional() @IsArray() @IsIn(KINDS as unknown as string[], { each: true }) appliesToKinds?: (typeof KINDS)[number][];
  @IsOptional() @IsInt() @Min(1) @Max(60) minCycleMonths?: number;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validTo?: string;
  @IsOptional() @IsInt() @Min(1) maxRedemptions?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) perVendorLimit?: number;
}

export class PromoUpdateDto {
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validTo?: string;
  @IsOptional() @IsInt() @Min(1) maxRedemptions?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) perVendorLimit?: number;
}

export class TermOverrideDto {
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
  @IsOptional() @IsIn(PLANS as unknown as string[]) planKey?: (typeof PLANS)[number];
  @IsOptional() @IsIn(CYCLES as unknown as string[]) billingCycle?: (typeof CYCLES)[number];
  @IsOptional() @IsInt() @Min(1) @Max(60) customMonths?: number;
  @IsOptional() @IsInt() @Min(0) netAmountPaise?: number;
  /** AI Studio credit for the new term in paise, ₹0…₹5,000; any increase over what was already granted is credited. */
  @IsOptional() @IsInt() @Min(0) @Max(500000) aiCreditPaise?: number;
  @IsOptional() @IsIn(GST as unknown as string[]) gstMode?: (typeof GST)[number];
  @IsOptional() @IsString() @MaxLength(200) gstNote?: string;
  @IsOptional() @IsInt() @Min(0) @Max(90) graceDays?: number;
  @IsOptional() @IsString() periodEnd?: string;
  @IsOptional() @IsString() paymentDueAt?: string;
  @IsOptional() @IsArray() @IsIn(CHANNELS as unknown as string[], { each: true }) allowedChannels?: (typeof CHANNELS)[number][];
  @IsOptional() @IsIn(['ACTIVE', 'ACTIVE_PAYMENT_DUE', 'LAPSED', 'CANCELLED']) status?: 'ACTIVE' | 'ACTIVE_PAYMENT_DUE' | 'LAPSED' | 'CANCELLED';
}

export class ScheduleNextDto {
  @IsIn(PLANS as unknown as string[]) planKey!: (typeof PLANS)[number];
  @IsIn(CYCLES as unknown as string[]) billingCycle!: (typeof CYCLES)[number];
  @IsOptional() @IsInt() @Min(1) @Max(60) customMonths?: number;
}

export class PlanChangeRequestDto {
  @IsIn(PLANS as unknown as string[]) toPlanKey!: (typeof PLANS)[number];
  @IsIn(CYCLES as unknown as string[]) toCycle!: (typeof CYCLES)[number];
  @IsOptional() @IsInt() @Min(1) @Max(60) customMonths?: number;
  @IsOptional() @IsIn(['AT_RENEWAL', 'NOW']) effective?: 'AT_RENEWAL' | 'NOW';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class PlanChangeApproveDto {
  @IsOptional() @IsIn(['AT_RENEWAL', 'NOW']) effective?: 'AT_RENEWAL' | 'NOW';
  @IsOptional() @IsString() @MaxLength(300) adminNote?: string;
  /** Approved net price in paise (before GST). Omit to bill the list price. Range-checked on the server: 0 ≤ price ≤ list. */
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) netPaise?: number;
  /** Required when netPaise is below list. */
  @IsOptional() @IsString() @MaxLength(300) discountReason?: string;
  /** Must be exactly "CONFIRM" when the discount exceeds 20% of list. */
  @IsOptional() @IsString() @MaxLength(20) confirm?: string;
}

/** Razorpay checkout result. There is deliberately NO amount field anywhere in the payment DTOs. */
export class RazorpayVerifyDto {
  @IsString() @MaxLength(100) razorpayOrderId!: string;
  @IsString() @MaxLength(100) razorpayPaymentId!: string;
  @IsString() @MaxLength(200) razorpaySignature!: string;
}

export class PromoApplyDto {
  @IsString() @MinLength(3) @MaxLength(32) code!: string;
}

/** Multipart text fields of the "I have paid" form (the screenshot arrives as the `file` part). */
export class ProofFormDto {
  @IsString() @MaxLength(40) utr!: string;
  @IsString() @MaxLength(20) amount!: string;
  @IsString() @MaxLength(40) paidAt!: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
