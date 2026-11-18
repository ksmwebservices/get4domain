import { Type } from 'class-transformer';
import { Allow, ArrayMaxSize, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

/** Request bodies of the admin plans API. Money and term rules are checked by the service so the error carries a stable machine code. */
const TRACKS = ['HANDYMAN', 'PROFESSIONAL', 'ECOMMERCE'];
const LEVELS = ['FREE', 'PRO'];
const PLAN_STATUS = ['DRAFT', 'ACTIVE', 'RETIRED'];
const PRICE_STATUS = ['PROPOSED', 'APPROVED'];
const KINDS = ['BOOLEAN', 'LIMIT', 'ENUM'];
const STATES = ['ACTIVE', 'LIMITED', 'LOCKED_PREVIEW', 'HIDDEN'];

export class CreatePlanDto {
  @IsString() @MinLength(3) @MaxLength(60) key!: string;
  @IsIn(TRACKS) track!: 'HANDYMAN' | 'PROFESSIONAL' | 'ECOMMERCE';
  @IsIn(LEVELS) level!: 'FREE' | 'PRO';
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsIn(PLAN_STATUS) status?: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdatePlanDto {
  @IsDateString() expectedUpdatedAt!: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsIn(PLAN_STATUS) status?: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

/** B3.1: the display name of one plan, found by its key. No expectedUpdatedAt: a rename is idempotent and the key never changes. */
export class RenamePlanDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
}

/** B3.0: withdraw an approved plan price. The reason is required and goes in the audit log. */
export class WithdrawPriceDto {
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
}

export class CreatePriceDto {
  @IsNumber() termMonths!: number;
  @IsNumber() amountPaise!: number;
  @IsOptional() @IsBoolean() taxInclusive?: boolean;
  @IsOptional() @IsIn(PRICE_STATUS) status?: 'PROPOSED' | 'APPROVED';
  @IsOptional() @IsDateString() effectiveFrom?: string;
}

export class ApprovePlanPriceDto {
  /** absent = from now; a past moment is refused */
  @IsOptional() @IsDateString() effectiveFrom?: string;
}

export class UpdatePriceDto {
  @IsDateString() expectedUpdatedAt!: string;
  @IsOptional() @IsNumber() amountPaise?: number;
  @IsOptional() @IsBoolean() taxInclusive?: boolean;
  @IsOptional() @IsIn(PRICE_STATUS) status?: 'PROPOSED' | 'APPROVED';
  @IsOptional() @IsDateString() effectiveFrom?: string;
}

export class CreateFeatureDto {
  @IsString() @MaxLength(80) key!: string;
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsString() @MinLength(2) @MaxLength(60) group!: string;
  @IsIn(KINDS) kind!: 'BOOLEAN' | 'LIMIT' | 'ENUM';
  @IsOptional() @IsString() @MaxLength(40) unit?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateFeatureDto {
  @IsDateString() expectedUpdatedAt!: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) group?: string;
  @IsOptional() @IsString() @MaxLength(40) unit?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class MatrixRowDto {
  @IsString() featureKey!: string;
  @IsIn(STATES) state!: 'ACTIVE' | 'LIMITED' | 'LOCKED_PREVIEW' | 'HIDDEN';
  @IsOptional() @IsInt() limitValue?: number | null;
  @IsOptional() @IsString() @MaxLength(100) enumValue?: string | null;
  @IsOptional() @IsString() @MaxLength(300) upsellText?: string | null;
}

export class SaveMatrixDto {
  @IsDateString() expectedUpdatedAt!: string;
  @ValidateNested({ each: true }) @Type(() => MatrixRowDto) @ArrayMaxSize(300) rows!: MatrixRowDto[];
}

/** Wave 4 W7: loose on purpose; the real checks (a rate 0 to 100 with at most 3 decimals, a day today or later, a reason) are in the pure core so every refusal carries GST_RATE_INVALID and names the field. */
export class GstRateDto {
  @IsOptional() ratePercent?: unknown;
  @IsOptional() effectiveFrom?: unknown;
  @IsOptional() reason?: unknown;
}

export class CreateTaxRateDto {
  @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsNumber() ratePercent!: number;
  @IsOptional() @IsString() @MaxLength(40) appliesTo?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsDateString() validFrom?: string;
}

export class UpdateTaxRateDto {
  @IsDateString() expectedUpdatedAt!: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) name?: string;
  @IsOptional() @IsNumber() ratePercent?: number;
  @IsOptional() @IsString() @MaxLength(40) appliesTo?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsDateString() validFrom?: string;
}

export class PutPlanSettingDto {
  @IsOptional() @IsDateString() expectedUpdatedAt?: string;
  /** boolean, number, string, list or null (empty); validated per key. @Allow() is what lets the strict whitelist keep the field: without a decorator the pipe refused every body with "property valueJson should not exist". */
  @Allow() valueJson!: unknown;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
}

export class AssignSubscriptionDto {
  @IsString() planKey!: string;
  @IsOptional() @IsNumber() termMonths?: number;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsString() reason!: string;
}

export class CreateOverrideDto {
  @IsString() featureKey!: string;
  @IsIn(STATES) state!: 'ACTIVE' | 'LIMITED' | 'LOCKED_PREVIEW' | 'HIDDEN';
  @IsOptional() @IsInt() limitValue?: number;
  @IsOptional() @IsString() @MaxLength(100) enumValue?: string;
  @IsString() reason!: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class UpdateOverrideDto {
  @IsDateString() expectedUpdatedAt!: string;
  @IsOptional() @IsIn(STATES) state?: 'ACTIVE' | 'LIMITED' | 'LOCKED_PREVIEW' | 'HIDDEN';
  @IsOptional() @IsInt() limitValue?: number;
  @IsOptional() @IsString() @MaxLength(100) enumValue?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class SetFlagDto {
  @IsBoolean() enabled!: boolean;
}
