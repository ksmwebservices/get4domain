import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

const PROJECT_TYPES = ['Web', 'Mobile', 'SaaS', 'AI/ML', 'Support', 'Other'];
const BILLING = ['Fixed', 'Hourly', 'Retainer'];
const PROJECT_STATUSES = ['proposal', 'in_progress', 'testing', 'delivered', 'cancelled'];
const TASK_STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

export class CreateProjectDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsString() @MaxLength(200) clientName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(PROJECT_TYPES) projectType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() techStack?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(BILLING) billingType?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(PROJECT_STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) contractValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() deadline?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class CreateTaskDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sprint?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(TASK_STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(PRIORITIES) priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignee?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) estimateHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() dueDate?: string;
}
export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
