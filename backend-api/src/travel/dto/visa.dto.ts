import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateVisaDto {
  @ApiProperty({ example: 'Fatima Sheikh' })
  @IsString()
  travelerName!: string;

  @ApiProperty({ example: 'United Arab Emirates' })
  @IsString()
  country!: string;

  @ApiProperty({ required: false, description: 'Linked trip id' })
  @IsOptional()
  @IsString()
  tripId?: string;

  @ApiProperty({ required: false, example: 'M1234567' })
  @IsOptional()
  @IsString()
  passportNo?: string;

  @ApiProperty({ required: false, example: 'Tourist' })
  @IsOptional()
  @IsString()
  visaType?: string;

  @ApiProperty({ required: false, enum: ['applied', 'in_process', 'approved', 'rejected'], default: 'applied' })
  @IsOptional()
  @IsIn(['applied', 'in_process', 'approved', 'rejected'])
  status?: string;

  @ApiProperty({ required: false, example: '2026-08-20' })
  @IsOptional()
  @IsString()
  appliedDate?: string;

  @ApiProperty({ required: false, example: '2026-08-28' })
  @IsOptional()
  @IsString()
  decisionDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateVisaDto extends PartialType(CreateVisaDto) {}
