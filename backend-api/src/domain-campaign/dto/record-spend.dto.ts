import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

/**
 * Admin-recorded monthly ad spend for a DomainCampaign client. No live Meta/
 * Google Ads API tracking exists yet (needs Meta App Review) — this is a
 * manual entry, and the fee (MAX(10% of spend, ₹9,999)) is computed from it.
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
