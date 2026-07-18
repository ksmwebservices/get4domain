import { ApiProperty } from '@nestjs/swagger';
import { Plan, Product } from '@prisma/client';
import { IsEnum, IsInt, IsPositive, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'clx1234567890' })
  @IsString()
  vendorId!: string;

  @ApiProperty({ enum: Product, example: Product.DOMAIN_APP })
  @IsEnum(Product)
  product!: Product;

  @ApiProperty({ enum: Plan, example: Plan.ENTERPRISE })
  @IsEnum(Plan)
  plan!: Plan;

  @ApiProperty({ example: 2499900, description: 'Amount in paise' })
  @IsInt()
  @IsPositive()
  amount!: number;
}
