import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateKbEntryDto {
  @ApiProperty({ example: 'Pricing', description: 'Short label for your own reference' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  question!: string;

  @ApiProperty({ example: 'price, cost, charges, rate, how much', description: 'Comma-separated trigger terms' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  keywords!: string;

  @ApiProperty({ example: 'Our services start from ₹499. Would you like our team to contact you?' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  answer!: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateKbEntryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  question?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  keywords?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  answer?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
