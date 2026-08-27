import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

const ENGAGEMENT_TYPES = ['Consulting', 'Legal', 'Advisory', 'Retainer', 'Other'];
const BILLING_TYPES = ['Fixed', 'Hourly', 'Retainer'];
const ENGAGEMENT_STATUSES = ['proposal', 'active', 'on_hold', 'completed', 'cancelled'];
const DOC_STATUSES = ['pending', 'received', 'waived'];

export class CreateEngagementDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) title!: string;
  @ApiPropertyOptional() @IsString() @MaxLength(200) clientName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(ENGAGEMENT_TYPES) engagementType?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(BILLING_TYPES) billingType?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(ENGAGEMENT_STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) feeValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) hourlyRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  /** When true (default), seed the default document checklist for the type. */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() seedChecklist?: boolean;
}

export class UpdateEngagementDto extends PartialType(CreateEngagementDto) {}

export class CreateDocumentDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsIn(DOC_STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}
