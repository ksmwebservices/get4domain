import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Values are checked by the pure rules in core/gaps-core.ts (they name each field that needs fixing); these DTOs only cap the size and the shape, and refuse any field not listed. */
export class MigrationRequestDto { @IsString() @MaxLength(300) siteUrl!: string }

export class DraftListDto {
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() archived?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class DraftWriteDto {
  @IsString() @MaxLength(40) channel!: string;
  @IsString() @MaxLength(400) title!: string;
  @IsString() @MaxLength(6000) body!: string;
}

export class TeamInviteDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(300) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsString() @MaxLength(200) role!: string;
  @IsOptional() @IsString() @MaxLength(40) department?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true }) areas?: string[];
}
export class MemberChangeDto {
  @IsOptional() @IsString() @MaxLength(200) role?: string;
  @IsOptional() @IsString() @MaxLength(40) department?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true }) areas?: string[];
}
