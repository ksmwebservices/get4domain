import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateDriverDto {
  @ApiProperty({ example: 'Ramesh Kumar' })
  @IsString()
  name!: string;

  @ApiProperty({ required: false, example: '9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: 'KA0120200001234' })
  @IsOptional()
  @IsString()
  licenseNo?: string;

  @ApiProperty({ required: false, enum: ['available', 'on_trip', 'off_duty'], default: 'available' })
  @IsOptional()
  @IsIn(['available', 'on_trip', 'off_duty'])
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDriverDto extends PartialType(CreateDriverDto) {}
