import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { OUTREACH_STATUSES, SOURCE_KINDS } from '../../core/seeded';

export class CreateSeededDto {
  @IsString() @MinLength(2) @MaxLength(120) businessName!: string;
  @IsString() @MinLength(2) @MaxLength(60) category!: string;
  @IsString() @MinLength(2) @MaxLength(80) city!: string;
  @IsString() @MinLength(2) @MaxLength(80) area!: string;
  @IsString() @MaxLength(30) phone!: string;
  @IsOptional() @IsString() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(600) description?: string;
  @IsIn(SOURCE_KINDS as unknown as string[]) sourceKind!: string;
  @IsOptional() @IsString() @MaxLength(300) sourceNote?: string;
  /** the staff checkbox: only public facts, no invented reviews, no copied photos or text. Required on every create. */
  @IsBoolean() publicFactsOnly!: boolean;
  /** SUPER_ADMIN only: create again a business that was removed before */
  @IsOptional() @IsString() @MaxLength(300) overrideReason?: string;
}
export class BatchDto {
  @IsString() @MaxLength(1_000_000) csv!: string;
  @IsOptional() @IsString() @MaxLength(200) fileName?: string;
  @IsOptional() @IsString() @MaxLength(300) overrideReason?: string;
}
export class SeededListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsIn(['SEEDED', 'INVITED', 'CLAIMED_FREE', 'PRO', 'REMOVED']) lifecycle?: 'SEEDED' | 'INVITED' | 'CLAIMED_FREE' | 'PRO' | 'REMOVED';
  @IsOptional() @IsIn(OUTREACH_STATUSES as unknown as string[]) outreachStatus?: (typeof OUTREACH_STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(64) batchId?: string;
  @IsOptional() @IsString() @MaxLength(100) @Matches(/^[\p{L}\p{N} .&'-]*$/u) q?: string;
}
export class OutreachDto {
  @IsOptional() @IsIn(OUTREACH_STATUSES as unknown as string[]) status?: (typeof OUTREACH_STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(64) ownerStaffId?: string;
  @IsOptional() @IsISO8601() nextFollowUpAt?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class CallDto {
  @IsString() @MinLength(2) @MaxLength(80) outcome!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsISO8601() nextFollowUpAt?: string;
}
export class ConsentDto {
  @IsBoolean() agreed!: boolean;
}
export class ReasonDto {
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
}
export class RegisterAddDto {
  @IsString() @MaxLength(30) phone!: string;
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
}
export class RegisterListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class IndexingModeDto {
  @IsIn(['OFF', 'QUALITY']) mode!: 'OFF' | 'QUALITY';
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
}
