import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsObject, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

// Categorized portfolio gallery item (e.g. a photography vendor's Ceremony/
// Portraits/Details/Celebration gallery). Stored as VendorCMS.portfolio (Json).
export class PortfolioImageDto {
  @ApiProperty() @IsString() @MaxLength(2000) id!: string;
  @ApiProperty() @IsString() @MaxLength(2000) src!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) alt?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) category?: string;
}

export class TestimonialDto {
  @ApiProperty() @IsString() @MaxLength(600) quote!: string;
  @ApiProperty() @IsString() @MaxLength(120) author!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(160) note?: string;
  /** true while this is the starter quote; the public site hides it */
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() sample?: boolean;
}

export class SitePageDto {
  @ApiProperty() @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'A page address can only use lower-case letters, numbers and dashes.' }) @MaxLength(60) slug!: string;
  @ApiProperty() @IsString() @MaxLength(120) title!: string;
  @ApiProperty() @IsString() @MaxLength(8000) body!: string;
}

export class UpdateVendorCmsDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() businessName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() tagline?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() about?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() logo?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() banner?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() themeId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() favicon?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() ogImage?: string;
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

  @ApiProperty({ required: false, type: [TestimonialDto], description: 'Customer quotes shown on the site (replaces the whole list)' })
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => TestimonialDto)
  testimonials?: TestimonialDto[];

  @ApiProperty({ required: false, type: [SitePageDto], description: 'Extra pages (replaces the whole list; the count is limited by plan)' })
  @IsOptional() @IsArray() @ArrayMaxSize(25) @ValidateNested({ each: true }) @Type(() => SitePageDto)
  pages?: SitePageDto[];

  @ApiProperty({ required: false, description: 'Design choices: themeKey, hero, about, services, gallery, testimonials, contact' })
  @IsOptional() @IsObject()
  layout?: Record<string, string>;

  @ApiProperty({ required: false, description: 'The design (one of the four of your category) the site uses' })
  @IsOptional() @IsString() @MaxLength(40)
  designKey?: string;

  @ApiProperty({ required: false, description: 'Headline, sub-line, button label, announcement, trust points, questions, steps, statistics, team, before and after, and the sample markers' })
  @IsOptional() @IsObject()
  extras?: Record<string, unknown>;
}
