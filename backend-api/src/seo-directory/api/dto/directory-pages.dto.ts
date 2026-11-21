import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class ResolveQueryDto {
  /** the directory path, for example /chennai/plumbers-in-adyar/page/2 */
  @IsString() @MaxLength(300) path!: string;
}

export class PageQueryDto {
  @IsOptional() @IsString() @MaxLength(80) @Matches(SLUG) state?: string;
  @IsOptional() @IsString() @MaxLength(80) @Matches(SLUG) city?: string;
  @IsOptional() @IsString() @MaxLength(80) @Matches(SLUG) locality?: string;
  @IsOptional() @IsString() @MaxLength(80) @Matches(SLUG) category?: string;
  /** the category plural slug as it appears in the URL (plumbers) */
  @IsOptional() @IsString() @MaxLength(80) @Matches(SLUG) term?: string;
  @IsOptional() @IsString() @MaxLength(6) @Matches(/^[1-9][0-9]{5}$/) pincode?: string;
  @IsOptional() @IsString() @MaxLength(80) @Matches(SLUG) slug?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) page?: number;
}
