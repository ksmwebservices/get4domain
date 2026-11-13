import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { TAB_SCOPES, TIERS } from '../core/pack-core';

const KEY = /^[a-z0-9][a-z0-9-]{1,80}$/;
export class RegisterPackDto {
  @IsString() @Matches(KEY) categoryKey!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(60) @IsString({ each: true }) @MaxLength(120, { each: true }) starterServices?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true }) capabilities?: string[];
}
export class SetCapabilityDto { @IsBoolean() enabled!: boolean }

export class EditPackDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(40) disclaimerKey?: string | null;
  @IsOptional() @IsIn(['DRAFT', 'OWNER_REVIEWED', 'APPROVED']) reviewStatus?: string;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}
export class SaveTabDto {
  @IsIn([...TAB_SCOPES]) scope!: string;
  @IsString() @MaxLength(40) ownerKey!: string;
  @IsString() @MaxLength(40) key!: string;
  @IsString() @MaxLength(60) label!: string;
  @IsString() @MaxLength(90) route!: string;
  @IsOptional() @IsIn([...TIERS]) minTier?: string | null;
  @IsOptional() @IsString() @MaxLength(40) capabilityKey?: string | null;
  @IsOptional() @IsBoolean() freeTrial?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class EditCategoryDto {
  @IsOptional() @IsString() @MaxLength(40) packKey?: string;
  @IsOptional() @IsIn([...TIERS]) minTier?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true }) optionalCapabilities?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(120) @IsString({ each: true }) @MaxLength(120, { each: true }) starterServices?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MaxLength(500) ownerNotes?: string | null;
}
export class MatrixCellDto { @IsBoolean() allowed!: boolean }
export class PackSettingDto { @IsBoolean() value!: boolean }
export class VendorAddonDto { @IsIn(['ACTIVE', 'ENDED']) status!: 'ACTIVE' | 'ENDED' }
