import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { TRACK_NAMES } from '../../steps/business-input';

/** The details of the business staff are onboarding. Normalised (phone, email) and checked again by the CREATE_VENDOR step. */
export class CreateProvisioningJobDto {
  @IsString() @Length(2, 120) businessName!: string;
  @IsIn([...TRACK_NAMES]) track!: string;
  @IsString() @Length(2, 60) category!: string;
  @IsString() @Length(2, 120) ownerName!: string;
  @IsString() @Length(5, 30) phone!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Length(2, 80) city!: string;
  @Matches(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, { message: 'language must be a code such as en or ta' }) language!: string;
  /** D1: where the business is (optional): with them the duplicate check can also compare name, place and category */
  @IsOptional() @IsString() @Length(2, 80) area?: string;
  @IsOptional() @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' }) pincode?: string;
  /** D1: a written reason (5 to 300 characters) to create this business although it looks like an existing one. ADMIN or SUPER_ADMIN only; logged. */
  @IsOptional() @IsString() @MaxLength(300) duplicateOverrideReason?: string;
}

export class ListJobsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsIn(['QUEUED', 'RUNNING', 'WAITING', 'SUCCEEDED', 'FAILED', 'CANCELLED']) status?: 'QUEUED' | 'RUNNING' | 'WAITING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class ListInvitesQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
}

/** The Idempotency-Key header: 8 to 100 letters, digits and - _ . : */
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,100}$/;
