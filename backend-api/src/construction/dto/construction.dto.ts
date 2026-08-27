import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

const PHASES = ['Foundation', 'Structure', 'Finishing', 'Handover'];
const STATUSES = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'];
const MILESTONE_STATUSES = ['pending', 'in_progress', 'done'];
const MATERIAL_STATUSES = ['ordered', 'received', 'used'];

export class CreateProjectDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsString() @MaxLength(200) clientName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(PHASES) phase?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) budget?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) spent?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() targetDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class CreateMilestoneDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(MILESTONE_STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
}
export class UpdateMilestoneDto extends PartialType(CreateMilestoneDto) {}

export class CreateMaterialDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() supplier?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(MATERIAL_STATUSES) status?: string;
}
export class UpdateMaterialDto extends PartialType(CreateMaterialDto) {}
