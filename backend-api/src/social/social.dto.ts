import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SaveAccountDto {
  @IsOptional() @IsString() @MaxLength(60) id?: string;
  @IsIn(['PLATFORM', 'VENDOR']) ownerType!: 'PLATFORM' | 'VENDOR';
  @IsOptional() @IsString() @MaxLength(60) vendorId?: string;
  @IsIn(['FACEBOOK_PAGE', 'INSTAGRAM', 'TELEGRAM', 'GOOGLE_BUSINESS']) channel!: 'FACEBOOK_PAGE' | 'INSTAGRAM' | 'TELEGRAM' | 'GOOGLE_BUSINESS';
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(120) externalId?: string;
  @IsOptional() @IsString() @MaxLength(80) theme?: string;
  @IsOptional() @IsString() @MaxLength(60) city?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  /** Write-only. Never returned by any endpoint. */
  @IsOptional() @IsString() @MaxLength(2000) token?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) dailyCap?: number;
  @IsOptional() @IsIn(['SANDBOX', 'AWAITING_APPROVAL', 'CONNECTED', 'DISCONNECTED']) status?: string;
}
