import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Public "Get a Custom Quote" enquiry from the Managed Services marketing page.
 * Recorded on the existing leads pipeline (g4d_leads), tagged source:
 * 'managed-services' — same pattern as support.service.ts's requestCallback().
 * No new lead table.
 */
export class CreateManagedServicesEnquiryDto {
  @ApiProperty() @IsString() @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @MaxLength(20) phone!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) email?: string;
  @ApiProperty() @IsString() @MaxLength(160) business!: string;
  @ApiProperty({ description: 'Selected service checkboxes, e.g. ["Custom Web App", "Mobile Application"]' })
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true })
  interests!: string[];
  @ApiPropertyOptional({ description: 'Free-text description of the business need' })
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
}
