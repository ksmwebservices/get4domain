import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 'Ravi Kumar' })
  @IsString()
  party!: string;

  @ApiProperty({ enum: ['upi', 'cash', 'card', 'cheque', 'bank'] })
  @IsIn(['upi', 'cash', 'card', 'cheque', 'bank'])
  method!: 'upi' | 'cash' | 'card' | 'cheque' | 'bank';

  @ApiProperty({ enum: ['inward', 'outward'] })
  @IsIn(['inward', 'outward'])
  direction!: 'inward' | 'outward';

  @ApiProperty({ example: 2400, description: 'Amount in ₹' })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ required: false, example: 'UPI/7723' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ required: false, enum: ['cleared', 'pending', 'bounced'], default: 'cleared' })
  @IsOptional()
  @IsIn(['cleared', 'pending', 'bounced'])
  status?: 'cleared' | 'pending' | 'bounced';

  @ApiProperty({ example: '2026-08-26' })
  @IsString()
  date!: string;
}
