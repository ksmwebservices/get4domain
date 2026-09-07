import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateWebsiteThemeDto {
  @ApiProperty({ example: 'Emerald Fresh' })
  @IsString()
  name!: string;

  @ApiProperty({ required: false, description: 'Short marketplace description shown on the vendor theme card.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, example: 'salon', description: 'null/omitted = any industry' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({ example: { '--primary': '#059669', '--accent': '#10b981', '--radius': '16px' } })
  @IsObject()
  cssVars!: Record<string, string>;

  @ApiProperty({ required: false, description: 'Full data-driven layout (engine template shape); null = colours-only theme.' })
  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;

  @ApiProperty({ required: false, description: 'Uploaded multi-page static HTML: [{ slug, title, html }] (home = first / slug "home").' })
  @IsOptional()
  @IsArray()
  pages?: Array<{ slug: string; title: string; html: string }>;

  @ApiProperty({ required: false, description: 'Optional shared CSS applied across all pages of an uploaded HTML theme.' })
  @IsOptional()
  @IsString()
  css?: string;

  @ApiProperty({ required: false, description: 'One-time unlock price in ₹ (rupees), ex-GST. 0/null = free/included.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  preview?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateWebsiteThemeDto extends PartialType(CreateWebsiteThemeDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** Confirm a premium-template unlock payment (platform Razorpay). */
export class ConfirmUnlockDto {
  @ApiProperty() @IsString() razorpayOrderId!: string;
  @ApiProperty() @IsString() razorpayPaymentId!: string;
  @ApiProperty() @IsString() razorpaySignature!: string;
}
