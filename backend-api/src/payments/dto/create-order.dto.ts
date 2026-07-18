import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 2949882, description: 'Amount in paise (includes GST)' })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiProperty({ required: false, default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'INV-2026-0001' })
  @IsString()
  receipt!: string;
}
