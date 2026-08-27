import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: '101' }) @IsString() number!: string;
  @ApiPropertyOptional({ example: 'Deluxe' }) @IsOptional() @IsString() roomType?: string;
  @ApiPropertyOptional({ default: 2 }) @IsOptional() @IsInt() @Min(1) capacity?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) pricePerNight?: number;
  @ApiPropertyOptional({ enum: ['available', 'occupied', 'maintenance'], default: 'available' }) @IsOptional() @IsIn(['available', 'occupied', 'maintenance']) status?: string;
  @ApiPropertyOptional({ enum: ['clean', 'dirty', 'in_progress'], default: 'clean' }) @IsOptional() @IsIn(['clean', 'dirty', 'in_progress']) housekeeping?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateRoomDto extends PartialType(CreateRoomDto) {}

export class CreateRoomBookingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiProperty({ example: 'Deepak Nair' }) @IsString() guestName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() guestPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() roomId?: string;
  @ApiProperty({ example: '2026-08-28' }) @IsString() checkIn!: string;
  @ApiProperty({ example: '2026-08-30' }) @IsString() checkOut!: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) guests?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) totalAmount?: number;
  @ApiPropertyOptional({ enum: ['booked', 'confirmed', 'checked_in', 'checked_out', 'cancelled'], default: 'booked' }) @IsOptional() @IsIn(['booked', 'confirmed', 'checked_in', 'checked_out', 'cancelled']) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateRoomBookingDto extends PartialType(CreateRoomBookingDto) {}
