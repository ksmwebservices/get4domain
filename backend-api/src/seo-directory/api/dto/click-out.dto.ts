import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ClickOutQueryDto {
  /** the page type the card was on (home, city, localityCategory, ...); anything else is recorded as "other" */
  @IsOptional() @IsString() @MaxLength(40) src?: string;
  /** the keyword target id, when the link was built for one */
  @IsOptional() @IsString() @MaxLength(40) kw?: string;
}
