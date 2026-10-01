import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Public "Get Started" / "Talk to us" enquiry from the DomainCampaign
 * marketing page, and the pre-filled version submitted from an existing
 * vendor's dashboard ("Add DomainCampaign" CTA). Recorded on the existing
 * leads pipeline (g4d_leads), tagged source: 'domain-campaign' — same
 * pattern as managed-services' createEnquiry(). No new lead table.
 */
export class CreateDomainCampaignEnquiryDto {
  @ApiProperty() @IsString() @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @MaxLength(20) phone!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) email?: string;
  @ApiProperty() @IsString() @MaxLength(160) business!: string;
  @ApiPropertyOptional({ description: 'Free-text — current monthly ad spend, goals, etc.' })
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
  @ApiPropertyOptional({ description: 'Set only when submitted from an existing vendor\'s dashboard — links the lead to their account for admin follow-up.' })
  @IsOptional() @IsString() vendorId?: string;
}
