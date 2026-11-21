import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Every staff lifecycle action needs a reason (5 to 300 characters; the service trims and re-checks). */
export class ReasonDto {
  @IsString() @MinLength(5) @MaxLength(300) reason!: string;
}
export class ExtendGraceDto extends ReasonDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(365) days!: number;
}
export class RestoreProDto extends ReasonDto {
  @IsOptional() @IsString() @Matches(/^(handyman|professional|ecommerce)_pro$/) planKey?: string;
  @IsOptional() @Type(() => Number) @IsIn([1, 3, 6, 12]) termMonths?: number;
}
export class DeletionRequestDto {
  @IsOptional() @IsString() @Matches(/^\d{6}$/) code?: string;
  @IsOptional() @IsBoolean() confirm?: boolean;
}
export class DeletionListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsIn(['PENDING', 'EXECUTED', 'CANCELLED']) status?: 'PENDING' | 'EXECUTED' | 'CANCELLED';
}
