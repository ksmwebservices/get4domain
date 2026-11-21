import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { REQUEST_STATUSES } from '../../core/request-core';

const KEY = /^[A-Za-z0-9_:-]+$/;
const KEY_MSG = 'idempotencyKey may only hold letters, digits, dash, colon and underscore';

/** The service re-checks the brief for the chosen service in plain words; these keep absurd input out and reject unknown fields. */
export class CreateServiceRequestDto {
  @IsString() @MaxLength(60) serviceKey!: string;
  @IsObject() brief!: Record<string, unknown>;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(200, { each: true }) attachmentRefs?: string[];
  @IsString() @MinLength(8) @MaxLength(80) @Matches(KEY, { message: KEY_MSG }) idempotencyKey!: string;
}
export class RaiseOnBehalfDto extends CreateServiceRequestDto {
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
}
export class RevisionDto {
  @IsString() @MinLength(5) @MaxLength(1000) note!: string;
}
export class RequestPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class AdminRequestsDto extends RequestPageDto {
  @IsOptional() @IsString() @MaxLength(60) serviceKey?: string;
  @IsOptional() @IsIn([...REQUEST_STATUSES]) status?: (typeof REQUEST_STATUSES)[number];
  @IsOptional() @IsIn(['INCLUDED_ALLOWANCE', 'PACK', 'WALLET']) fundingKind?: 'INCLUDED_ALLOWANCE' | 'PACK' | 'WALLET';
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() slaBreached?: boolean;
}
export class AssignRequestDto {
  @IsOptional() @IsString() @MaxLength(64) staffId?: string;
  @IsOptional() @IsISO8601() slaDueAt?: string | null;
  @IsOptional() @IsISO8601() grantEndsAt?: string | null;
}
export class RequestStatusDto {
  @IsIn(['ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_REVIEW']) to!: 'ACCEPTED' | 'IN_PRODUCTION' | 'READY_FOR_REVIEW';
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
export class DeliverableDto {
  @IsIn(['TEXT', 'FILE_REF', 'LINK']) kind!: 'TEXT' | 'FILE_REF' | 'LINK';
  @IsOptional() @IsString() @MaxLength(4000) text?: string;
  @IsOptional() @IsString() @MaxLength(500) fileRef?: string;
}
export class RejectRequestDto {
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}
