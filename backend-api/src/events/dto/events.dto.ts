import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

const EVENT_TYPES = ['Wedding', 'Birthday', 'Corporate', 'Concert', 'Other'];
const STATUSES = ['enquiry', 'confirmed', 'in_progress', 'completed', 'cancelled'];
const SERVICES = ['Catering', 'Decor', 'Photography', 'Music', 'Transport', 'Other'];
const VENDOR_STATUSES = ['pending', 'confirmed', 'paid'];

export class CreateBookingDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) title!: string;
  @ApiPropertyOptional() @IsString() @MaxLength(200) clientName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(EVENT_TYPES) eventType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() eventDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() venue?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) guestCount?: number;
  @ApiPropertyOptional() @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) packageValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) advancePaid?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateBookingDto extends PartialType(CreateBookingDto) {}

export class CreateEventVendorDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) vendorName!: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(SERVICES) service?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) cost?: number;
  @ApiPropertyOptional() @IsOptional() @IsIn(VENDOR_STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
export class UpdateEventVendorDto extends PartialType(CreateEventVendorDto) {}
