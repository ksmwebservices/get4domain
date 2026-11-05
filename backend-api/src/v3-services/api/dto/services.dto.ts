import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

/** The services re-check every rule in plain words (core/services-core.ts); these only keep absurd input out and reject unknown fields. */
export class CreateServiceDto {
  @IsString() @MaxLength(60) key!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(400) shortDescription!: string;
  @IsString() @MaxLength(1200) includesText!: string;
  @IsString() @MaxLength(900) approvalText!: string;
  @IsOptional() @IsString() @MaxLength(40) kind?: string;
  @IsOptional() @IsString() @MaxLength(20) doneBy?: string;
  @IsOptional() @IsString() @MaxLength(20) deliveryKind?: string;
  @IsOptional() @IsString() @MaxLength(30) planStateRule?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(40, { each: true }) trackScope?: string[];
  @IsOptional() @IsBoolean() publicVisible?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000) sortOrder?: number;
  @IsOptional() @IsIn(['DRAFT', 'ACTIVE', 'RETIRED']) status?: 'DRAFT' | 'ACTIVE' | 'RETIRED';
}
export class UpdateServiceDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(400) shortDescription?: string;
  @IsOptional() @IsString() @MaxLength(1200) includesText?: string;
  @IsOptional() @IsString() @MaxLength(900) approvalText?: string;
  @IsOptional() @IsString() @MaxLength(40) kind?: string;
  @IsOptional() @IsString() @MaxLength(20) doneBy?: string;
  @IsOptional() @IsString() @MaxLength(20) deliveryKind?: string;
  @IsOptional() @IsString() @MaxLength(30) planStateRule?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(40, { each: true }) trackScope?: string[];
  @IsOptional() @IsBoolean() publicVisible?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000) sortOrder?: number;
  @IsOptional() @IsIn(['DRAFT', 'ACTIVE', 'RETIRED']) status?: 'DRAFT' | 'ACTIVE' | 'RETIRED';
}
export class ProposePriceDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000_000) amountPaise!: number;
  @IsOptional() @IsString() @MaxLength(40) taxCategory?: string;
  @IsOptional() @IsBoolean() taxInclusive?: boolean;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
export class EditPriceDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000_000) amountPaise?: number;
  @IsOptional() @IsString() @MaxLength(40) taxCategory?: string;
  @IsOptional() @IsBoolean() taxInclusive?: boolean;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
export class ApprovePriceDto {
  @IsISO8601() effectiveFrom!: string;
}
export class PackItemDto {
  @IsString() @MaxLength(60) serviceKey!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) count!: number;
}
export class CreatePackDto {
  @IsString() @MaxLength(60) key!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(900) description!: string;
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PackItemDto) items!: PackItemDto[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) validityDays?: number;
  @IsOptional() @IsIn(['DRAFT', 'ACTIVE', 'RETIRED']) status?: 'DRAFT' | 'ACTIVE' | 'RETIRED';
}
export class UpdatePackDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(900) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PackItemDto) items?: PackItemDto[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) validityDays?: number;
  @IsOptional() @IsIn(['DRAFT', 'ACTIVE', 'RETIRED']) status?: 'DRAFT' | 'ACTIVE' | 'RETIRED';
}
export class PurchasePackDto {
  @IsString() @MinLength(8) @MaxLength(80) @Matches(/^[A-Za-z0-9_:-]+$/, { message: 'idempotencyKey may only hold letters, digits, dash, colon and underscore' }) idempotencyKey!: string;
}
