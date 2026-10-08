import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { PRODUCT_STATUSES } from '../../stock/stock-rules';

export class CreateProductDto {
  @ApiProperty({ example: 'Airport Transfer Package' })
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, example: '2999' })
  @IsOptional()
  @IsString()
  price?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({ required: false, example: 'transport' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false, description: 'Rich per-category listing fields (e.g. { area, config, type })' })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;

  @ApiProperty({ required: false, description: 'Track stock for this product (orders reserve it; adjustments move it)' })
  @IsOptional()
  @IsBoolean()
  trackStock?: boolean;

  @ApiProperty({ required: false, description: 'OPENING stock when tracking is switched on. Later changes go through Adjust stock.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stockQty?: number;

  @ApiProperty({ required: false, description: 'Low-stock level: at or below this the product shows as "low" and raises a notification' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  reorderLevel?: number;

  @ApiProperty({ required: false, enum: PRODUCT_STATUSES })
  @IsOptional()
  @IsIn(PRODUCT_STATUSES as unknown as string[])
  status?: 'AVAILABLE' | 'OUT_OF_STOCK' | 'HIDDEN';
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
