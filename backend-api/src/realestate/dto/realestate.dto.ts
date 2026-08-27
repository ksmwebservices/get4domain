import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

const PTYPE = ['Apartment', 'Villa', 'Plot', 'Commercial', 'Office'];
const LSTATUS = ['available', 'under_offer', 'sold', 'rented'];
const STAGES = ['new', 'site_visit', 'negotiation', 'closed_won', 'closed_lost'];

export class CreateListingDto {
  @ApiProperty({ example: '3BHK Whitefield' }) @IsString() title!: string;
  @ApiPropertyOptional({ enum: PTYPE, default: 'Apartment' }) @IsOptional() @IsIn(PTYPE) propertyType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) price?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) areaSqft?: number;
  @ApiPropertyOptional({ example: '3BHK' }) @IsOptional() @IsString() bhk?: string;
  @ApiPropertyOptional({ enum: LSTATUS, default: 'available' }) @IsOptional() @IsIn(LSTATUS) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}
export class UpdateListingDto extends PartialType(CreateListingDto) {}

export class CreateDealDto {
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiProperty({ example: 'Rohit Gupta' }) @IsString() clientName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() listingId?: string;
  @ApiPropertyOptional({ enum: STAGES, default: 'new' }) @IsOptional() @IsIn(STAGES) stage?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) value?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() agent?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateDealDto extends PartialType(CreateDealDto) {}

export class CreateVisitDto {
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiProperty({ example: 'Rohit Gupta' }) @IsString() clientName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() listingId?: string;
  @ApiProperty({ example: '2026-08-28T16:00:00.000Z' }) @IsString() scheduledAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agent?: string;
  @ApiPropertyOptional({ enum: ['scheduled', 'done', 'cancelled'], default: 'scheduled' }) @IsOptional() @IsIn(['scheduled', 'done', 'cancelled']) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateVisitDto extends PartialType(CreateVisitDto) {}
