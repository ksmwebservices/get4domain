import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The Visit beacon body: the only thing a visitor sends is whether the click came from a search result. */
export class VisitDto {
  @IsOptional() @IsBoolean() fromSearch?: boolean;
}
export class VisitStatsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90) days?: number;
}
export class VisitReportDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
}

export class PublicListDto {
  @IsOptional() @IsString() @MaxLength(120) location?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}
export class SitemapDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}
export class RemovalRequestDto {
  @IsString() @MaxLength(80) businessSlug!: string;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class AddressDto {
  @IsOptional() @IsString() @MaxLength(200) line1?: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsOptional() @IsString() @MaxLength(12) pin?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
}
export class GeoDto {
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
}
export class ServiceDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}
export class MediaDto {
  @IsString() @MaxLength(500) @Matches(/^https:\/\//, { message: 'url must be an https address' }) url!: string;
  @IsOptional() @IsString() @MaxLength(200) altText?: string;
}

export class StaffBusinessDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsString() @MaxLength(64) categoryId!: string;
  @IsOptional() @IsString() @MaxLength(64) locationId?: string | null;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(254) email?: string | null;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
  @IsOptional() @IsObject() hours?: Record<string, unknown>;
  @IsOptional() @ValidateNested() @Type(() => GeoDto) geo?: GeoDto | null;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsIn(['DRAFT', 'UNCLAIMED']) status?: 'DRAFT' | 'UNCLAIMED';
  @IsOptional() @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => ServiceDto) services?: ServiceDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => MediaDto) media?: MediaDto[];
}
export class StaffBusinessUpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(64) categoryId?: string;
  @IsOptional() @IsString() @MaxLength(64) locationId?: string | null;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(254) email?: string | null;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
  @IsOptional() @IsObject() hours?: Record<string, unknown>;
  @IsOptional() @ValidateNested() @Type(() => GeoDto) geo?: GeoDto | null;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => ServiceDto) services?: ServiceDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => MediaDto) media?: MediaDto[];
}
export class StaffBusinessListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsIn(['DRAFT', 'UNCLAIMED', 'CLAIMED', 'SUSPENDED', 'REMOVED']) status?: 'DRAFT' | 'UNCLAIMED' | 'CLAIMED' | 'SUSPENDED' | 'REMOVED';
  @IsOptional() @IsString() @MaxLength(64) categoryId?: string;
  @IsOptional() @IsString() @MaxLength(64) locationId?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}
export class ModerateDto {
  @IsIn(['SUSPEND', 'RESTORE', 'REMOVE']) action!: 'SUSPEND' | 'RESTORE' | 'REMOVE';
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}
export class PlacementDto {
  @IsString() @MaxLength(40) startsAt!: string;
  @IsString() @MaxLength(40) endsAt!: string;
  @IsString() @MinLength(1) @MaxLength(60) label!: string;
}
export class ClaimOverrideDto {
  @IsString() @MaxLength(30) phone!: string;
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}
export class RejectDto {
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}
export class RemovalListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsIn(['REQUESTED', 'APPROVED', 'REJECTED', 'EXECUTED']) status?: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
}
export class LocationCreateDto {
  @IsOptional() @IsString() @MaxLength(64) parentId?: string | null;
  @IsIn(['STATE', 'DISTRICT', 'CITY']) kind!: 'STATE' | 'DISTRICT' | 'CITY';
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(60) @Matches(SLUG) slug?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
}
export class LocationUpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(60) @Matches(SLUG) slug?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class CategoryCreateDto {
  @IsOptional() @IsString() @MaxLength(64) parentId?: string | null;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(60) @Matches(SLUG) slug?: string;
  @IsOptional() @IsString() @MaxLength(60) themeCategoryId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
}
export class CategoryUpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(60) @Matches(SLUG) slug?: string;
  @IsOptional() @IsString() @MaxLength(60) themeCategoryId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class MyProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
  @IsOptional() @IsObject() hours?: Record<string, unknown>;
  @IsOptional() @ValidateNested() @Type(() => GeoDto) geo?: GeoDto | null;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => ServiceDto) services?: ServiceDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => MediaDto) media?: MediaDto[];
  @IsOptional() @IsString() @MaxLength(60) categorySlug?: string;
  @IsOptional() @IsString() @MaxLength(120) locationPath?: string;
}
