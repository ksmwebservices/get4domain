import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { RECORD_STATUSES } from '../core/record-core';

export class RecordListDto {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsIn([...RECORD_STATUSES]) status?: string;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() archived?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

/** `data` holds the tab's fields; the field list decides which keys and types are allowed (checked in the service, the unknown ones are refused). */
export class RecordWriteDto {
  @IsOptional() @IsObject() data?: Record<string, unknown>;
  @IsOptional() @IsIn([...RECORD_STATUSES]) status?: string;
}
