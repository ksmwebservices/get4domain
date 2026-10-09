import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

// Categorized portfolio gallery item (e.g. a photography vendor's Ceremony/
// Portraits/Details/Celebration gallery). Stored as VendorCMS.portfolio (Json).
export class PortfolioImageDto {
  @ApiProperty() @IsString() @MaxLength(2000) id!: string;
  @ApiProperty() @IsString() @MaxLength(2000) src!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) alt?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) category?: string;
}

export class UpdateVendorCmsDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() businessName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() tagline?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() about?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() logo?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() banner?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() themeId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() favicon?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() seoTitle?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() seoDesc?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() seoKeywords?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() address?: string;
  @ApiProperty({ required: false, description: 'Opening hours as free text, shown on the site and used by the WhatsApp bot' }) @IsOptional() @IsString() @MaxLength(500) businessHours?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() whatsapp?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() facebook?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() instagram?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() linkedin?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() youtube?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() googleMaps?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() googleAnalyticsId?: string;

  @ApiProperty({ required: false, type: [PortfolioImageDto], description: 'Categorized portfolio gallery (replaces the whole list)' })
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => PortfolioImageDto)
  portfolio?: PortfolioImageDto[];
}
