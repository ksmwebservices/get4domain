import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const PAYMENTS = ['cash', 'upi', 'card', 'bank'];

export class CreateProductDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sku?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) price?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) stockQty?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) reorderLevel?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class RestockDto {
  @ApiPropertyOptional() @IsInt() delta!: number; // +restock / -adjust
}

export class SaleLineInput {
  @ApiPropertyOptional() @IsString() productId!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) qty?: number;
}

export class CreateSaleDto {
  @ApiPropertyOptional({ type: [SaleLineInput] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => SaleLineInput)
  lines!: SaleLineInput[];
  @ApiPropertyOptional() @IsOptional() @IsIn(PAYMENTS) paymentMethod?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) taxAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() customerName?: string;
}
