import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const TABLE_STATUSES = ['available', 'occupied', 'reserved', 'cleaning'];
const ORDER_TYPES = ['Dine-in', 'Takeaway', 'Delivery'];
const ORDER_STATUSES = ['new', 'preparing', 'ready', 'served', 'billed', 'cancelled'];
const ITEM_STATUSES = ['queued', 'preparing', 'ready', 'served'];
const STATIONS = ['kitchen', 'bar'];
const PAYMENTS = ['cash', 'upi', 'card'];

export class CreateTableDto {
  @ApiPropertyOptional() @IsString() @MaxLength(40) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) seats?: number;
  @ApiPropertyOptional() @IsOptional() @IsIn(TABLE_STATUSES) status?: string;
}
export class UpdateTableDto extends PartialType(CreateTableDto) {}

export class OrderItemInput {
  @ApiPropertyOptional() @IsOptional() @IsString() catalogItemId?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(STATIONS) station?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) quantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) price?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() tableId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tableName?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(ORDER_TYPES) orderType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) taxAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ type: [OrderItemInput] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemInput)
  items?: OrderItemInput[];
}
export class UpdateOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() tableId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tableName?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(ORDER_TYPES) orderType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(ORDER_STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) taxAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class AddItemDto extends OrderItemInput {}
export class UpdateItemDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) quantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsIn(ITEM_STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(STATIONS) station?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class BillOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(PAYMENTS) paymentMethod?: string;
}
