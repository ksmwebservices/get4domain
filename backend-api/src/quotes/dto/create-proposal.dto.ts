import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsPositive, IsString, Min, MaxLength, ValidateNested } from 'class-validator';

export class ProposalLineItemDto {
  @ApiProperty() @IsString() @MaxLength(160) label!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiProperty({ example: 1 }) @IsInt() @IsPositive() qty!: number;
  @ApiPropertyOptional({ example: 'months' }) @IsOptional() @IsString() @MaxLength(40) unit?: string;
  @ApiProperty({ example: 10000000, description: 'Rate per unit, in paise' }) @IsInt() @Min(0) rate!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

/**
 * Create a multi-line Managed Services proposal — unlike CreateQuoteDto (which
 * sends a single-item quote message immediately), this just SAVES a draft
 * proposal against a lead; nothing is dispatched until the admin explicitly
 * shares/sends it.
 */
export class CreateProposalDto {
  @ApiPropertyOptional({ description: 'The Managed Services lead this proposal is for' })
  @IsOptional() @IsString() leadId?: string;

  @ApiProperty() @IsString() @MaxLength(160) prospectName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) prospectPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) prospectEmail?: string;

  @ApiProperty({ type: [ProposalLineItemDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ProposalLineItemDto)
  items!: ProposalLineItemDto[];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
