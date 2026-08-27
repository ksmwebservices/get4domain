import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested,
} from 'class-validator';

export class ItineraryDayDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  day!: number;

  @ApiProperty({ example: 'Arrival & houseboat check-in' })
  @IsString()
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  detail?: string;
}

export class CreateTripDto {
  @ApiProperty({ example: 'Kerala Backwaters — 4D/3N' })
  @IsString()
  title!: string;

  @ApiProperty({ required: false, description: 'Linked customer contact id' })
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiProperty({ required: false, example: 'Alleppey, Kerala' })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiProperty({ required: false, example: '2026-09-10' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ required: false, example: '2026-09-13' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  pax?: number;

  @ApiProperty({ required: false, enum: ['planning', 'confirmed', 'ongoing', 'completed', 'cancelled'], default: 'planning' })
  @IsOptional()
  @IsIn(['planning', 'confirmed', 'ongoing', 'completed', 'cancelled'])
  status?: string;

  @ApiProperty({ required: false, description: 'Supplier cost (₹)', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  packageCost?: number;

  @ApiProperty({ required: false, description: 'Price charged to customer (₹)', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellPrice?: number;

  @ApiProperty({ required: false, type: [ItineraryDayDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItineraryDayDto)
  itinerary?: ItineraryDayDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTripDto extends PartialType(CreateTripDto) {}
