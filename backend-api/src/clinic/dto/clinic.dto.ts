import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

const STATUSES = ['scheduled', 'confirmed', 'completed', 'no_show', 'cancelled'];

export class CreateDoctorDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() specialty?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) consultationFee?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() availability?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateDoctorDto extends PartialType(CreateDoctorDto) {}

export class CreateAppointmentDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) patientName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() patientPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() doctorId?: string;
  @ApiPropertyOptional() @IsString() startAt!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) durationMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) fee?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() diagnosis?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() prescriptionNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() followUpDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {}
