import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Printer ink cartridges' })
  @IsString()
  description!: string;

  @ApiProperty({ required: false, example: 'Office Supplies' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 1200, description: 'Taxable base in ₹ (GST is added on top — exclusive)' })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ required: false, example: 18, description: 'GST %, 0 = not claimable' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gstRate?: number;

  @ApiProperty({ required: false, enum: ['online', 'offline'], default: 'offline' })
  @IsOptional()
  @IsIn(['online', 'offline'])
  paymentMethod?: 'online' | 'offline';

  @ApiProperty({ required: false, description: 'Receipt photo URL' })
  @IsOptional()
  @IsString()
  attachment?: string;

  @ApiProperty({ example: '2026-08-16' })
  @IsString()
  date!: string;
}
