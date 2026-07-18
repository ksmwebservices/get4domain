import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @ApiProperty({ example: 'clx1234567890' })
  @IsString()
  vendorId!: string;

  @ApiProperty({ required: false, example: 'clxsub1234567890' })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiProperty({ example: 'DomainApp Enterprise — annual subscription' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 2499900, description: 'Base amount in paise, before GST' })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiProperty({ required: false, example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
