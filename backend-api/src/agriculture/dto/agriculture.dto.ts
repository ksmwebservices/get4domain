import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

const UNITS = ['kg', 'quintal', 'tonne', 'dozen', 'crate'];
const GRADES = ['A', 'B', 'C'];
const ORDER_STATUSES = ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'];
const STOCK_STATUSES = ['available', 'reserved', 'sold'];

export class CreateOrderDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) buyerName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(200) produceName!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsIn(UNITS) unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(GRADES) grade?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) ratePerUnit?: number;
  @ApiPropertyOptional() @IsOptional() @IsIn(ORDER_STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() harvestDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateOrderDto extends PartialType(CreateOrderDto) {}

export class CreateStockDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) produceName!: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(GRADES) grade?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(UNITS) unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) quantityAvailable?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) ratePerUnit?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() harvestDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(STOCK_STATUSES) status?: string;
}
export class UpdateStockDto extends PartialType(CreateStockDto) {}
