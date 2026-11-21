import { Type } from 'class-transformer';
import { Allow, IsArray, IsInt, IsObject, IsString, Matches, MaxLength, Min } from 'class-validator';

/** A key of the editable-field map such as hero.title. Whether the key is editable is decided by the document rules, which answer FIELD_LOCKED for any other key. */
export class DraftFieldDto {
  @IsString() @MaxLength(60) @Matches(/^[A-Za-z0-9_.]+$/, { message: 'key must be a field name such as hero.title' }) key!: string;
  /** Not validated as a string here on purpose: the typed rules answer FIELD_INVALID with the field name. */
  @Allow() value!: unknown;
}
export class DraftListDto {
  @IsArray() items!: unknown[];
}
export class DraftSectionsDto {
  @IsArray() hidden!: unknown[];
  @IsArray() order!: unknown[];
}
export class DraftNavigationDto {
  @IsArray() header!: unknown[];
  @IsArray() footer!: unknown[];
}
export class DraftBrandDto {
  @IsObject() brand!: Record<string, unknown>;
}
export class RestoreRevisionDto {
  @Type(() => Number) @IsInt() @Min(1) toVersion!: number;
}
export class CompareRevisionsQuery {
  @Type(() => Number) @IsInt() @Min(1) from!: number;
  @Type(() => Number) @IsInt() @Min(1) to!: number;
}
