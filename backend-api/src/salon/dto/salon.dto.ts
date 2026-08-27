import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStylistDto {
  @ApiProperty({ example: 'Priya' }) @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional({ example: 'Hair & Colour' }) @IsOptional() @IsString() specialty?: string;
  @ApiPropertyOptional({ enum: ['active', 'off_duty'], default: 'active' }) @IsOptional() @IsIn(['active', 'off_duty']) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateStylistDto extends PartialType(CreateStylistDto) {}

export class CreateChairDto {
  @ApiProperty({ example: 'Chair 1' }) @IsString() name!: string;
  @ApiPropertyOptional({ enum: ['available', 'occupied', 'maintenance'], default: 'available' }) @IsOptional() @IsIn(['available', 'occupied', 'maintenance']) status?: string;
}
export class UpdateChairDto extends PartialType(CreateChairDto) {}

export class CreateSalonAppointmentDto {
  @ApiPropertyOptional({ description: 'Client contact id (optional)' }) @IsOptional() @IsString() contactId?: string;
  @ApiProperty({ example: 'Meena Kumari' }) @IsString() clientName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientPhone?: string;
  @ApiProperty({ example: 'Hair Cut & Style' }) @IsString() serviceName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() stylistId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() chairId?: string;
  @ApiProperty({ example: '2026-08-28T10:00:00.000Z' }) @IsString() startAt!: string;
  @ApiPropertyOptional({ default: 45 }) @IsOptional() @IsInt() @Min(5) durationMin?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) price?: number;
  @ApiPropertyOptional({ enum: ['scheduled', 'confirmed', 'completed', 'no_show', 'cancelled'], default: 'scheduled' }) @IsOptional() @IsIn(['scheduled', 'confirmed', 'completed', 'no_show', 'cancelled']) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateSalonAppointmentDto extends PartialType(CreateSalonAppointmentDto) {}
