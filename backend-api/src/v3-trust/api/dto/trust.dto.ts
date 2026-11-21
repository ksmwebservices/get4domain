import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

const PROOF_KINDS = ['GST', 'UDYAM', 'SHOP_LICENCE', 'PROFESSIONAL_REGISTRATION', 'OTHER'] as const;
const PROOF_STATUSES = ['SUBMITTED', 'CHECKED', 'MISMATCH'] as const;
const BLOCK_KINDS = ['PHONE', 'EMAIL', 'DOMAIN', 'UPI', 'NAME'] as const;
const REPORT_STATUSES = ['NEW', 'LOOKING', 'CLOSED'] as const;
const SUBJECTS = ['LISTING', 'SITE'] as const;
const TAKEDOWN_STATUSES = ['ACTIVE', 'REVERSED'] as const;

export class TrustPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class SubmitProofDto {
  @IsIn(PROOF_KINDS) kind!: (typeof PROOF_KINDS)[number];
  @IsString() @MinLength(3) @MaxLength(64) number!: string;
  @IsOptional() @IsString() @MaxLength(300) documentRef?: string;
}
export class ProofListDto extends TrustPageDto {
  @IsOptional() @IsIn(PROOF_STATUSES) status?: (typeof PROOF_STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
}
export class ReviewProofDto {
  @IsIn(PROOF_STATUSES) expectedStatus!: (typeof PROOF_STATUSES)[number];
  @IsIn(['CHECKED', 'MISMATCH']) status!: 'CHECKED' | 'MISMATCH';
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() @MaxLength(1000) note?: string | null;
}
export class CreateBlockDto {
  @IsIn(BLOCK_KINDS) kind!: (typeof BLOCK_KINDS)[number];
  @IsString() @MinLength(1) @MaxLength(300) value!: string;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class BlockListDto extends TrustPageDto { @IsOptional() @IsIn(BLOCK_KINDS) kind?: (typeof BLOCK_KINDS)[number]; }
export class ReportBusinessDto {
  @IsIn(SUBJECTS) subjectType!: (typeof SUBJECTS)[number];
  /** the listing's address name (slug) or the site's host name */
  @IsString() @MinLength(1) @MaxLength(253) subject!: string;
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
  /** optional: a phone or an e-mail address the reporter is happy to be reached on */
  @IsOptional() @IsString() @MaxLength(200) contact?: string;
}
export class ReportListDto extends TrustPageDto { @IsOptional() @IsIn(REPORT_STATUSES) status?: (typeof REPORT_STATUSES)[number]; }
export class UpdateReportDto {
  @IsIn(REPORT_STATUSES) expectedStatus!: (typeof REPORT_STATUSES)[number];
  @IsOptional() @IsIn(REPORT_STATUSES) status?: (typeof REPORT_STATUSES)[number];
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() @MaxLength(2000) note?: string | null;
}
export class CreateTermDto {
  @IsString() @MinLength(2) @MaxLength(200) term!: string;
  @IsString() @MinLength(2) @MaxLength(60) category!: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
export class UpdateTermDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) term?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) category?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
export class CreateTakedownDto {
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @IsString() @MaxLength(64) listingId?: string;
  @IsString() @MinLength(1) @MaxLength(2000) reason!: string;
  @IsOptional() @IsString() @MaxLength(300) documentRef?: string;
}
export class ReverseTakedownDto { @IsString() @MinLength(1) @MaxLength(2000) reason!: string; }
export class TakedownListDto extends TrustPageDto {
  @IsOptional() @IsIn(TAKEDOWN_STATUSES) status?: (typeof TAKEDOWN_STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
}
