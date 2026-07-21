import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreatePageDto {
  @ApiProperty({ required: false, description: 'URL slug — auto-generated from businessName if omitted' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  headline!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subheadline?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  benefits!: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  aboutText?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  heroImage?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  photos?: string[];

  @ApiProperty({ required: false, enum: ['LIGHT', 'DARK', 'VIBRANT'], default: 'LIGHT' })
  @IsOptional()
  @IsIn(['LIGHT', 'DARK', 'VIBRANT'])
  style?: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty()
  @IsString()
  whatsapp!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mapsLink?: string;

  @ApiProperty({ required: false, type: [Object] })
  @IsOptional()
  @IsArray()
  testimonials?: Array<{ name: string; text: string; rating?: number }>;

  @ApiProperty({ required: false, default: 'Enquire Now' })
  @IsOptional()
  @IsString()
  ctaText?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
