import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const KEY = /^[A-Za-z0-9_:-]+$/; const KEY_MSG = 'idempotencyKey may only hold letters, digits, dash, colon and underscore';
export class PreviewThemeDto { @IsString() @MinLength(2) @MaxLength(81) themeId!: string; }
export class SwitchThemeDto {
  @IsString() @MinLength(2) @MaxLength(81) themeId!: string;
  @IsString() @MinLength(8) @MaxLength(80) @Matches(KEY, { message: KEY_MSG }) idempotencyKey!: string;
}
export class StaffSwitchThemeDto extends SwitchThemeDto {
  @IsIn(['WALLET', 'COMPLIMENTARY', 'SERVICE_REQUEST']) funding!: 'WALLET' | 'COMPLIMENTARY' | 'SERVICE_REQUEST';
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
  @IsOptional() @IsString() @MaxLength(64) serviceRequestId?: string;
}
export class HistoryPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class RecoverSwitchesDto { @Type(() => Number) @IsInt() @Min(1) @Max(10_080) olderThanMinutes!: number; }
