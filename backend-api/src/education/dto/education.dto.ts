import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBatchDto {
  @ApiProperty({ example: 'JEE 2027 Morning' }) @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() courseName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() faculty?: string;
  @ApiPropertyOptional({ enum: ['Classroom', 'Online', 'Hybrid'], default: 'Classroom' }) @IsOptional() @IsIn(['Classroom', 'Online', 'Hybrid']) mode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endDate?: string;
  @ApiPropertyOptional({ example: 'Mon/Wed/Fri 6–8pm' }) @IsOptional() @IsString() schedule?: string;
  @ApiPropertyOptional({ default: 30 }) @IsOptional() @IsInt() @Min(1) capacity?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) fee?: number;
  @ApiPropertyOptional({ enum: ['upcoming', 'active', 'completed'], default: 'upcoming' }) @IsOptional() @IsIn(['upcoming', 'active', 'completed']) status?: string;
}
export class UpdateBatchDto extends PartialType(CreateBatchDto) {}

export class CreateEnrollmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiProperty({ example: 'Aisha Khan' }) @IsString() studentName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() studentPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() guardianContact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() batchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() enrollDate?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) feeAmount?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) feePaid?: number;
  @ApiPropertyOptional({ enum: ['enrolled', 'ongoing', 'completed', 'dropped'], default: 'enrolled' }) @IsOptional() @IsIn(['enrolled', 'ongoing', 'completed', 'dropped']) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateEnrollmentDto extends PartialType(CreateEnrollmentDto) {}
