import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateVendorCmsDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() businessName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() tagline?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() about?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() logo?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() favicon?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() seoTitle?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() seoDesc?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() seoKeywords?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() address?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() whatsapp?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() facebook?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() instagram?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() linkedin?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() youtube?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() googleMaps?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() googleAnalyticsId?: string;
}
