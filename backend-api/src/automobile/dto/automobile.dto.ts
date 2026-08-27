import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

const JOB_TYPES = ['General Service', 'Repair', 'Body Work', 'Insurance', 'Other'];
const STATUSES = ['received', 'in_service', 'ready', 'delivered', 'cancelled'];
const LINE_KINDS = ['part', 'labor'];

export class CreateJobDto {
  @ApiPropertyOptional() @IsString() @MaxLength(40) vehicleNumber!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleModel?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(200) customerName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(JOB_TYPES) jobType?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) odometer?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() complaint?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) estimateAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() promisedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateJobDto extends PartialType(CreateJobDto) {}

export class CreateLineDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(LINE_KINDS) kind?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(200) description!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) rate?: number;
}
export class UpdateLineDto extends PartialType(CreateLineDto) {}

export class CreatePartDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() partNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) quantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) reorderLevel?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
}
export class UpdatePartDto extends PartialType(CreatePartDto) {}
