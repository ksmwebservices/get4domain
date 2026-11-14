import { Type } from 'class-transformer';
import { IsArray, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class KeywordListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

export class KeywordUpdateDto {
  @IsOptional() @IsString() @MaxLength(120) singular?: string;
  @IsOptional() @IsString() @MaxLength(120) plural?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(120, { each: true }) synonyms?: string[];
}

export class TemplatesUpdateDto {
  /** one entry per page type to change: { cityCategory: { title: [...], description: [...], h1: [...] } }; checked by seoTemplatesProblem */
  @IsObject() templates!: Record<string, unknown>;
}
