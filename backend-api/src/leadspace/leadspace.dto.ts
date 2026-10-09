import { Type } from 'class-transformer';
import { ArrayMaxSize } from 'class-validator';
import { IsArray, IsBoolean, IsDefined, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DISPUTE_REASONS } from './credits.service';
import { EVENT_TYPES } from './leadspace.types';

export class OtpRequestDto {
  @IsString() @MaxLength(60) slug!: string;
  @IsString() @MaxLength(20) phone!: string;
  @IsBoolean() consent!: boolean;
  @IsOptional() @IsString() @MaxLength(80) deviceId?: string;
}

export class CaptureEventDto {
  @IsString() @MaxLength(60) slug!: string;
  @IsOptional() @IsIn(EVENT_TYPES as unknown as string[]) type?: string;
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @MaxLength(20) phone!: string;
  @IsObject() payload!: Record<string, unknown>;
  @IsString() @MaxLength(60) otpId!: string;
  @IsString() @MaxLength(8) code!: string;
  @IsOptional() @IsString() @MaxLength(80) idempotencyKey?: string;
  @IsOptional() @IsString() @MaxLength(60) source?: string;
  @IsOptional() @IsObject() utm?: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(80) deviceId?: string;
}

export class LeadStatusDto {
  @IsIn(['CONTACTED', 'WON', 'LOST']) status!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class OrderDecisionDto {
  @IsIn(['CONFIRMED', 'DECLINED']) decision!: 'CONFIRMED' | 'DECLINED';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class DisputeDto {
  @IsIn(DISPUTE_REASONS as unknown as string[]) reason!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class LowBalanceModeDto {
  @IsIn(['HOLD', 'REJECT']) mode!: 'HOLD' | 'REJECT';
}

export class RefundRequestDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class SetPriceDto {
  @IsIn(EVENT_TYPES as unknown as string[]) eventType!: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsString() @MaxLength(60) city?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(5_000_000) pricePaise!: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class SettingValueDto {
  /** boolean | number | string | number[] | string[] | record, checked per key by the service */
  @IsDefined() value!: unknown;
}

export class DisputeDecisionDto {
  @IsIn(['CREDIT', 'REJECT']) decision!: 'CREDIT' | 'REJECT';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class RefundDecisionDto {
  @IsIn(['APPROVE', 'REJECT', 'PAID']) decision!: 'APPROVE' | 'REJECT' | 'PAID';
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000) paymentFeePaise?: number;
}

export class BlockPhoneDto {
  @IsString() @MaxLength(20) phone!: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

export class TemplateApprovalDto {
  @IsIn(['SANDBOX', 'PENDING', 'APPROVED', 'REJECTED']) approvalStatus!: 'SANDBOX' | 'PENDING' | 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(120) providerTemplateId?: string;
}

export class ApplyDto {
  @IsOptional() @IsBoolean() apply?: boolean;
}

/** Create or save a page. Every field is optional on save; the service cleans each one. Lists are checked item by item there. */
export class SavePageDto {
  @IsOptional() @IsString() @MaxLength(40) category?: string;
  @IsOptional() @IsString() @MaxLength(60) subcategory?: string;
  @IsOptional() @IsString() @MaxLength(60) city?: string;
  @IsOptional() @IsString() @MaxLength(120) serviceArea?: string;
  @IsOptional() @IsIn(EVENT_TYPES as unknown as string[]) goal?: string;
  @IsOptional() @IsIn(['TEMPLATE', 'EXISTING_PAGE']) mode?: string;
  @IsOptional() @IsString() @MaxLength(80) businessName?: string;
  @IsOptional() @IsString() @MaxLength(120) tagline?: string;
  @IsOptional() @IsString() @MaxLength(900) about?: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  @IsOptional() @IsString() @MaxLength(500) mapsLink?: string;
  @IsOptional() @IsString() @MaxLength(500) heroImage?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(160) hours?: string;
  @IsOptional() @IsString() @MaxLength(500) existingPageUrl?: string;
  @IsOptional() @IsString() @MaxLength(60) reraNumber?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(40) services?: unknown[];
  @IsOptional() @IsObject() offer?: Record<string, unknown>;
  @IsOptional() @IsArray() @ArrayMaxSize(12) gallery?: unknown[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) faqs?: unknown[];
  @IsOptional() @IsArray() @ArrayMaxSize(8) trust?: unknown[];
}

export class VerifyPhoneRequestDto {
  @IsString() @MaxLength(20) phone!: string;
}

export class VerifyPhoneConfirmDto {
  @IsString() @MaxLength(20) phone!: string;
  @IsString() @MaxLength(60) otpId!: string;
  @IsString() @MaxLength(8) code!: string;
}

export class TrackDto {
  @IsString() @MaxLength(60) slug!: string;
  @IsIn(['view', 'cta', 'form']) kind!: 'view' | 'cta' | 'form';
}

export class ReportPageDto {
  @IsString() @MaxLength(60) slug!: string;
  @IsIn(['SPAM', 'MISLEADING', 'ILLEGAL', 'NOT_A_REAL_BUSINESS', 'OTHER']) reason!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class PromotionToggleDto {
  @IsBoolean() on!: boolean;
}

export class SuspendDto {
  @IsString() @MinLength(5, { message: 'Write a short reason (at least 5 characters).' }) @MaxLength(300) reason!: string;
}

export class RegulatedReviewDto {
  @IsBoolean() approve!: boolean;
  @IsOptional() @IsBoolean() allowPromotion?: boolean;
}

export class ReportActionDto {
  @IsIn(['ACTIONED', 'DISMISSED']) action!: 'ACTIONED' | 'DISMISSED';
  @IsOptional() @IsString() @MaxLength(300) suspendReason?: string;
}
