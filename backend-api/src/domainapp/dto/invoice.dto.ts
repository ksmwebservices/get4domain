import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class InvoiceLineItemDto {
  @ApiProperty({ example: 'Goa 3N/4D Package' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  @Min(0)
  rate!: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Contact to bill' })
  @IsString()
  contactId!: string;

  @ApiPropertyOptional({ description: 'Optional linked Record id' })
  @IsOptional()
  @IsString()
  recordId?: string;

  @ApiProperty({ type: [InvoiceLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  items!: InvoiceLineItemDto[];

  @ApiPropertyOptional({ example: 18, description: 'GST percentage', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gstRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
