import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested,
} from 'class-validator';

export class ContractAssignmentDto {
  @ApiPropertyOptional({ description: 'Assigned vehicle id' })
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Assigned driver id' })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiPropertyOptional({ example: 'Route 4 — North' })
  @IsOptional()
  @IsString()
  routeLabel?: string;
}

export class CreateContractDto {
  @ApiProperty({ description: 'Client contact id (the school/corporate/college)' })
  @IsString()
  contactId!: string;

  @ApiProperty({ example: 'ABC School — Daily Bus Service' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 45000, description: 'Fixed monthly rate (₹)' })
  @IsNumber()
  @Min(0)
  monthlyRate!: number;

  @ApiPropertyOptional({ example: 18, description: 'GST % on generated invoices', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gstRate?: number;

  @ApiProperty({ example: '2026-09-01' })
  @IsString()
  startDate!: string;

  @ApiPropertyOptional({ example: '2027-08-31', description: 'Omit for an open-ended contract' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 28, default: 1 })
  @IsInt()
  @Min(1)
  @Max(28)
  billingDayOfMonth!: number;

  @ApiPropertyOptional({ example: 'Mon–Sat, pickup 7am / drop 5pm, 3 routes' })
  @IsOptional()
  @IsString()
  scheduleNotes?: string;

  @ApiPropertyOptional({ enum: ['active', 'paused', 'ended'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'paused', 'ended'])
  status?: string;

  @ApiPropertyOptional({ type: [ContractAssignmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractAssignmentDto)
  assignments?: ContractAssignmentDto[];
}

export class UpdateContractDto extends PartialType(CreateContractDto) {}
