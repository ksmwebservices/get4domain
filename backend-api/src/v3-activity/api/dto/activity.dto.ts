import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

const LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const;
const STATUSES = ['NEW', 'LOOKING', 'RESOLVED', 'NOT_AN_ISSUE'] as const;
const ROLES = ['SUPER_ADMIN', 'OPERATIONS'] as const;

export class ActivityPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class AlertListDto extends ActivityPageDto {
  @IsOptional() @IsIn(LEVELS) level?: (typeof LEVELS)[number];
  @IsOptional() @IsIn(STATUSES) status?: (typeof STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @IsString() @MaxLength(64) owner?: string;
}
export class UpdateAlertDto {
  /** the status the staff member saw; if the alert moved meanwhile the change is refused */
  @IsIn(STATUSES) expectedStatus!: (typeof STATUSES)[number];
  @IsOptional() @IsIn(STATUSES) status?: (typeof STATUSES)[number];
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() @MaxLength(64) ownerStaffId?: string | null;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsString() @MinLength(1) @MaxLength(2000) note?: string | null;
}
export class UpdateAlertRuleDto {
  @IsString() @MinLength(3) @MaxLength(60) key!: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsObject() thresholdJson?: Record<string, number> | null;
  @IsOptional() @IsArray() @ArrayMaxSize(2) @IsIn(ROLES, { each: true }) notifyRoles?: string[];
}
