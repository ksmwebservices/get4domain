import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GeneratePageDto {
  @ApiProperty({ example: 'restaurant' })
  @IsString()
  industry!: string;

  @ApiProperty({ example: 'Spice Garden Restaurant' })
  @IsString()
  businessName!: string;

  @ApiProperty({ example: 'Flat 20% off on all orders this weekend' })
  @IsString()
  offerTitle!: string;

  @ApiProperty({ example: 'Family restaurant serving authentic South Indian cuisine since 2010' })
  @IsString()
  description!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  whatsapp!: string;
}
