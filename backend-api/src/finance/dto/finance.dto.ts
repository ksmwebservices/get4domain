import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

const CASE_TYPES = ['ITR', 'GST', 'Audit', 'Loan', 'Insurance', 'Other'];
const STATUSES = ['open', 'in_review', 'filed', 'closed', 'cancelled'];
const DOC_STATUSES = ['pending', 'received', 'waived'];

export class CreateCaseDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) title!: string;
  @ApiPropertyOptional() @IsString() @MaxLength(200) clientName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(CASE_TYPES) caseType?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) feeValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() filingDeadline?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() seedChecklist?: boolean;
}
export class UpdateCaseDto extends PartialType(CreateCaseDto) {}

export class CreateCaseDocumentDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsIn(DOC_STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateCaseDocumentDto extends PartialType(CreateCaseDocumentDto) {}
