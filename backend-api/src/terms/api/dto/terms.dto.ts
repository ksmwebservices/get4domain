import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

/** The service re-checks everything (kind list, length, placeholder); these only keep absurd input out. */
export class CreateDraftDto {
  @IsOptional() @IsString() @MaxLength(200_000) bodyMarkdown?: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
}
export class UpdateDraftDto {
  @IsOptional() @IsString() @MaxLength(200_000) bodyMarkdown?: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
}
export class PublishDto {
  @IsString() @MaxLength(500) changeNote!: string;
}
export class TermsListDto {
  @IsOptional() @IsString() @MaxLength(40) kind?: string;
  @IsOptional() @IsString() @MaxLength(20) status?: string;
}
export class AcceptedDocDto {
  @IsString() @MaxLength(40) kind!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100_000) version!: number;
}
export class AcceptTermsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => AcceptedDocDto) documents!: AcceptedDocDto[];
}
export class ClaimTermsDto {
  @IsOptional() @IsBoolean() acceptTerms?: boolean;
}
