import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Daily'];

export class CreateGymClassDto {
  @ApiProperty({ example: 'Morning HIIT' }) @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() trainer?: string;
  @ApiPropertyOptional({ enum: DAYS, default: 'Mon' }) @IsOptional() @IsIn(DAYS) dayOfWeek?: string;
  @ApiPropertyOptional({ example: '06:00' }) @IsOptional() @IsString() startTime?: string;
  @ApiPropertyOptional({ default: 60 }) @IsOptional() @IsInt() @Min(5) durationMin?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @IsInt() @Min(1) capacity?: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateGymClassDto extends PartialType(CreateGymClassDto) {}

export class CreateMembershipDto {
  @ApiPropertyOptional({ description: 'Member contact id (optional)' }) @IsOptional() @IsString() contactId?: string;
  @ApiProperty({ example: 'Karan Malhotra' }) @IsString() memberName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() memberPhone?: string;
  @ApiProperty({ example: 'Monthly Gym + Cardio' }) @IsString() planName!: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) price?: number;
  @ApiProperty({ example: '2026-08-01' }) @IsString() startDate!: string;
  @ApiProperty({ example: '2026-09-01' }) @IsString() endDate!: string;
  @ApiPropertyOptional({ enum: ['active', 'frozen', 'cancelled'], default: 'active' }) @IsOptional() @IsIn(['active', 'frozen', 'cancelled']) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateMembershipDto extends PartialType(CreateMembershipDto) {}
