import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

const MODES = ['Classroom', 'Online', 'Hybrid'];
const BATCH_STATUSES = ['upcoming', 'active', 'completed'];
const ENROLL_STATUSES = ['enrolled', 'ongoing', 'completed', 'dropped'];
const SESSION_STATUSES = ['scheduled', 'held', 'cancelled'];

export class CreateBatchDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subject?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() faculty?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timing?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(MODES) mode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) capacity?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) fee?: number;
  @ApiPropertyOptional() @IsOptional() @IsIn(BATCH_STATUSES) status?: string;
}
export class UpdateBatchDto extends PartialType(CreateBatchDto) {}

export class CreateEnrollmentDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) studentName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() studentPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() guardianContact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() batchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() enrollDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) feeAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) feePaid?: number;
  @ApiPropertyOptional() @IsOptional() @IsIn(ENROLL_STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateEnrollmentDto extends PartialType(CreateEnrollmentDto) {}

export class CreateSessionDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) topic!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() date?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() startTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(SESSION_STATUSES) status?: string;
}
export class UpdateSessionDto extends PartialType(CreateSessionDto) {}
