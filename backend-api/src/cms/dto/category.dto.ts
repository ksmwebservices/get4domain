import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Sneakers' }) @IsString() @MinLength(1) @MaxLength(60) name!: string;
}

export class UpdateCategoryDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0) @Max(10_000) sortOrder?: number;
  @ApiProperty({ required: false, description: 'Hidden categories are not shown as storefront filters' }) @IsOptional() @IsBoolean() hidden?: boolean;
}

export class ReorderCategoriesDto {
  @ApiProperty({ type: [String], description: 'Category ids in the order they should appear' })
  @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) ids!: string[];
}
