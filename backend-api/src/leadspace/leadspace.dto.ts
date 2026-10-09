import { Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
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
