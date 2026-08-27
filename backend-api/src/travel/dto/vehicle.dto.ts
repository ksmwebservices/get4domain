import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({ example: 'Toyota Innova Crysta' })
  @IsString()
  name!: string;

  @ApiProperty({ required: false, enum: ['sedan', 'suv', 'tempo', 'bus', 'other'], default: 'sedan' })
  @IsOptional()
  @IsIn(['sedan', 'suv', 'tempo', 'bus', 'other'])
  type?: string;

  @ApiProperty({ required: false, example: 'KA01AB1234' })
  @IsOptional()
  @IsString()
  regNumber?: string;

  @ApiProperty({ required: false, example: 7, default: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiProperty({ required: false, enum: ['available', 'on_trip', 'maintenance'], default: 'available' })
  @IsOptional()
  @IsIn(['available', 'on_trip', 'maintenance'])
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}
