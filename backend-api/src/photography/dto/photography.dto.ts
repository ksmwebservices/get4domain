import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

const EVENT_TYPES = ['Wedding', 'Pre-Wedding', 'Portrait', 'Product', 'Event', 'Other'];
const STATUSES = ['enquiry', 'confirmed', 'shot', 'delivered', 'cancelled'];
const DELIV_STATUSES = ['pending', 'in_progress', 'delivered'];

export class CreateShootDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) title!: string;
  @ApiPropertyOptional() @IsString() @MaxLength(200) clientName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactId?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(EVENT_TYPES) eventType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() eventDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() venue?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) coverageHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsIn(STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) packageValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) advancePaid?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() deliveryDueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() galleryUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() seedDeliverables?: boolean;
}
export class UpdateShootDto extends PartialType(CreateShootDto) {}

export class CreateDeliverableDto {
  @ApiPropertyOptional() @IsString() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(DELIV_STATUSES) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dueDate?: string;
}
export class UpdateDeliverableDto extends PartialType(CreateDeliverableDto) {}
