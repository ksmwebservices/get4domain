import { Type } from 'class-transformer';
import { ArrayMaxSize, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

/** Request bodies of the admin plans API. Money and term rules are checked by the service so the error carries a stable machine code. */
const TRACKS = ['HANDYMAN', 'PROFESSIONAL', 'ECOMMERCE'];
const LEVELS = ['FREE', 'PRO'];
const PLAN_STATUS = ['DRAFT', 'ACTIVE', 'RETIRED'];
const PRICE_STATUS = ['PROPOSED', 'APPROVED'];
const KINDS = ['BOOLEAN', 'LIMIT', 'ENUM'];
const STATES = ['ACTIVE', 'LIMITED', 'LOCKED_PREVIEW', 'HIDDEN'];
const DISCOUNT_TYPES = ['TERM', 'PROMO', 'MIGRATION'];

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

export class CreatePriceDto {
  @IsNumber() termMonths!: number;
  @IsNumber() amountPaise!: number;
  @IsOptional() @IsBoolean() taxInclusive?: boolean;
  @IsOptional() @IsIn(PRICE_STATUS) status?: 'PROPOSED' | 'APPROVED';
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

export class CreateDiscountRuleDto {
  @IsIn(DISCOUNT_TYPES) type!: 'TERM' | 'PROMO' | 'MIGRATION';
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsOptional() @IsNumber() percentOff?: number;
  @IsOptional() @IsNumber() amountOffPaise?: number;
  @IsOptional() @IsObject() conditions?: Record<string, unknown>;
  @IsOptional() @IsBoolean() stackable?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsIn(PRICE_STATUS) status?: 'PROPOSED' | 'APPROVED';
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validTo?: string;
}

export class UpdateDiscountRuleDto {
  @IsDateString() expectedUpdatedAt!: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsNumber() percentOff?: number;
  @IsOptional() @IsNumber() amountOffPaise?: number;
  @IsOptional() @IsObject() conditions?: Record<string, unknown>;
  @IsOptional() @IsBoolean() stackable?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsIn(PRICE_STATUS) status?: 'PROPOSED' | 'APPROVED';
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validTo?: string;
}

export class PutPlanSettingDto {
  @IsOptional() @IsDateString() expectedUpdatedAt?: string;
  /** boolean, number, string or list; validated per key */
  valueJson!: unknown;
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
