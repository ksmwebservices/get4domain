import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

const STATUSES = ['booked', 'sample_collected', 'processing', 'report_ready', 'cancelled'];
const SAMPLE_TYPES = ['Blood', 'Urine', 'Imaging', 'Swab', 'Other'];

export class CreateOrderDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) patientName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() referringDoctor?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() sampleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() testDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reportUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateOrderDto extends PartialType(CreateOrderDto) {}

export class CreateOrderItemDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) testName!: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(SAMPLE_TYPES) sampleType?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) price?: number;
}
export class UpdateOrderItemDto extends PartialType(CreateOrderItemDto) {}
