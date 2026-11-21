import { Type } from 'class-transformer';
import { IsArray } from 'class-validator';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/** Field limits here are the outer bound; the exact rules (page path, status, priority, text safety) are checked by checkTarget and answered as SEO_INVALID with the reason. */
export class TargetListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsString() @MaxLength(10) status?: string;
  @IsOptional() @IsString() @MaxLength(300) path?: string;
  /** volume = most searched first */
  @IsOptional() @IsIn(['priority', 'volume']) sort?: 'priority' | 'volume';
}

export class TargetCreateDto {
  @IsString() @MaxLength(120) keyword!: string;
  @IsString() @MaxLength(300) path!: string;
  @IsOptional() @IsString() @MaxLength(10) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3) priority?: number;
  @IsOptional() @IsString() @MaxLength(200) titleOverride?: string;
  @IsOptional() @IsString() @MaxLength(400) descriptionOverride?: string;
  @IsOptional() @IsString() @MaxLength(200) h1Override?: string;
  @IsOptional() @IsString() @MaxLength(400) notes?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2_000_000_000) volume?: number;
  @IsOptional() @IsString() @MaxLength(10) competition?: string;
}

export class TargetUpdateDto {
  @IsOptional() @IsString() @MaxLength(10) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3) priority?: number;
  @IsOptional() @IsString() @MaxLength(200) titleOverride?: string;
  @IsOptional() @IsString() @MaxLength(400) descriptionOverride?: string;
  @IsOptional() @IsString() @MaxLength(200) h1Override?: string;
  @IsOptional() @IsString() @MaxLength(400) notes?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2_000_000_000) volume?: number;
  @IsOptional() @IsString() @MaxLength(10) competition?: string;
}

export class TargetImportDto {
  /** the CSV text: keyword, path (required); status, priority, title, description, h1, notes, source (optional) */
  @IsString() @MaxLength(4_000_000) csv!: string;
  /** false or absent = a DRY RUN that writes nothing */
  @IsOptional() @IsBoolean() apply?: boolean;
}

export class TargetExportQueryDto { @IsOptional() @IsString() @MaxLength(10) status?: string }

export class LinkBuildDto {
  @IsString() @MaxLength(300) path!: string;
  @IsString() @MaxLength(60) source!: string;
  @IsString() @MaxLength(60) medium!: string;
  @IsString() @MaxLength(60) campaign!: string;
  @IsOptional() @IsString() @MaxLength(40) keywordTargetId?: string;
}

export class UtmReportQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
}

/** The page-visit beacon: the directory path and the campaign parameters the visitor arrived with. Anything else in the body is refused by the global validation pipe. */
export class PageVisitDto {
  @IsString() @MaxLength(300) path!: string;
  @IsOptional() @IsString() @MaxLength(60) utm_source?: string;
  @IsOptional() @IsString() @MaxLength(60) utm_medium?: string;
  @IsOptional() @IsString() @MaxLength(60) utm_campaign?: string;
  @IsOptional() @IsString() @MaxLength(40) kw?: string;
}

export class VolumeImportDto {
  /** a Keyword Planner export saved as CSV (comma separated, UTF-8): a keyword column, a monthly searches column and optionally competition */
  @IsString() @MaxLength(8_000_000) csv!: string;
  /** false or absent = a DRY RUN that writes nothing */
  @IsOptional() @IsBoolean() apply?: boolean;
}

export class ModifiersUpdateDto {
  /** research modifiers such as "best", "near me", "24 hours", "in {locality}", "services"; checked by seoModifiersProblem */
  @IsArray() @IsString({ each: true }) @MaxLength(40, { each: true }) modifiers!: string[];
}
