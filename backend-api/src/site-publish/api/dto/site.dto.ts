import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

/** Theme ids are the kit's: lower case words joined by dashes. */
export class SetThemeDto {
  @IsString() @MaxLength(40) @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'themeId must be a theme id such as free-practice' }) themeId!: string;
}
export class BuildSiteDto {
  @IsOptional() @IsString() @MaxLength(40) @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'themeId must be a theme id such as free-practice' }) themeId?: string;
}
export class PublishSiteDto {
  @IsString() @MaxLength(64) publicationId!: string;
}
export class RollbackSiteDto {
  @Type(() => Number) @IsInt() @Min(1) toVersion!: number;
}
export class NoindexDto {
  @IsBoolean() forceNoindex!: boolean;
}
