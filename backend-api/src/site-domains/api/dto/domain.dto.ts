import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SubdomainDto {
  @IsString() @MaxLength(63) slug!: string;
}
export class StaffSubdomainDto extends SubdomainDto {
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}
export class CustomDomainDto {
  @IsString() @MaxLength(253) hostname!: string;
}
export class RemoveDomainDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
export class ForceStateDto {
  @IsOptional() @IsIn(['PENDING', 'VERIFYING', 'ACTIVE', 'FAILED', 'REMOVED']) status?: 'PENDING' | 'VERIFYING' | 'ACTIVE' | 'FAILED' | 'REMOVED';
  @IsOptional() @IsIn(['NONE', 'PENDING', 'ACTIVE', 'FAILED']) sslStatus?: 'NONE' | 'PENDING' | 'ACTIVE' | 'FAILED';
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}
export class DomainListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @IsIn(['PENDING', 'VERIFYING', 'ACTIVE', 'FAILED', 'REMOVED']) status?: 'PENDING' | 'VERIFYING' | 'ACTIVE' | 'FAILED' | 'REMOVED';
  @IsOptional() @IsIn(['SUBDOMAIN', 'CUSTOM']) kind?: 'SUBDOMAIN' | 'CUSTOM';
  @IsOptional() @IsString() @MaxLength(100) @Matches(/^[a-zA-Z0-9.-]*$/) q?: string;
}
