import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

/**
 * Admin-recorded monthly ad spend for a DomainCampaign client. No live Meta/
 * Google Ads API tracking exists yet (needs Meta App Review) — this is a
 * manual entry. The management fee is derived from the PRD §88 spend brackets
 * (≤₹20,000 → ₹2,000; ₹20,001–₹1,00,000 → ₹5,000; above → ₹10,000), unless the
 * client is flagged Enterprise/custom, in which case customFeePaise is used.
 */
export class RecordDomainCampaignSpendDto {
  @ApiProperty({ example: 'clx_vendor_id' })
  @IsString()
  vendorId!: string;

  @ApiProperty({ example: '2026-10', description: 'Billing month, YYYY-MM' })
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be in YYYY-MM format' })
  month!: string;

  @ApiProperty({ example: 2000000, description: 'Actual ad spend for the month, in paise' })
  @IsInt()
  @Min(0)
  adSpendPaise!: number;

  @ApiPropertyOptional({ description: 'Enterprise/multi-brand client: bill customFeePaise instead of the bracket fee' })
  @IsOptional()
  @IsBoolean()
  isCustomFee?: boolean;

  @ApiPropertyOptional({ example: 2500000, description: 'Custom management fee in paise (GST-exclusive); required when isCustomFee is true' })
  @IsOptional()
  @IsInt()
  @Min(1)
  customFeePaise?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
