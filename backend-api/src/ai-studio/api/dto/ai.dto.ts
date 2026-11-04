import { Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class GenerateDto {
  @IsIn(['site_copy', 'seo_suggestion', 'directory_description', 'review_reply']) feature!: 'site_copy' | 'seo_suggestion' | 'directory_description' | 'review_reply';
  @IsObject() input!: Record<string, unknown>;
  @IsString() @MinLength(8) @MaxLength(80) @Matches(/^[A-Za-z0-9_-]+$/, { message: 'idempotencyKey may only hold letters, digits, dash and underscore' }) idempotencyKey!: string;
}
export class CreateProviderDto {
  @IsIn(['openai', 'anthropic']) key!: 'openai' | 'anthropic';
  @IsString() @MinLength(1) @MaxLength(80) displayName!: string;
  @IsString() @MaxLength(80) model!: string;
  @IsString() @MinLength(8) @MaxLength(400) secret!: string;
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: 'ACTIVE' | 'DISABLED';
  @IsOptional() @IsObject() settings?: Record<string, unknown>;
}
export class UpdateProviderDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) displayName?: string;
  @IsOptional() @IsString() @MaxLength(80) model?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(400) secret?: string;
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: 'ACTIVE' | 'DISABLED';
  @IsOptional() @IsObject() settings?: Record<string, unknown>;
}
export class CreatePromptDto {
  @IsIn(['site_copy', 'seo_suggestion', 'directory_description', 'review_reply']) key!: 'site_copy' | 'seo_suggestion' | 'directory_description' | 'review_reply';
  @IsString() @MaxLength(2100) template!: string;
}
export class PromptListDto {
  @IsOptional() @IsIn(['site_copy', 'seo_suggestion', 'directory_description', 'review_reply']) key?: 'site_copy' | 'seo_suggestion' | 'directory_description' | 'review_reply';
}
export class GrantDto {
  @IsString() @MaxLength(64) vendorId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10_000) credits!: number;
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}
export class UsageReportDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period must look like 2026-11' }) period?: string;
}
