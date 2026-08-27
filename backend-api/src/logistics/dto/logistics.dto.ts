import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

const MODES = ['Road', 'Rail', 'Air', 'Sea'];
const STATUSES = ['booked', 'picked_up', 'in_transit', 'delivered', 'cancelled'];

export class CreateShipmentDto {
  @ApiPropertyOptional() @IsString() @MaxLength(60) trackingNo!: string;
  @ApiPropertyOptional() @IsString() @MaxLength(200) clientName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiPropertyOptional() @IsString() @MaxLength(200) origin!: string;
  @ApiPropertyOptional() @IsString() @MaxLength(200) destination!: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(MODES) mode?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) weight?: number;
  @ApiPropertyOptional() @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) freightAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() pickupDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() eta?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedVehicle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedDriver?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateShipmentDto extends PartialType(CreateShipmentDto) {}
