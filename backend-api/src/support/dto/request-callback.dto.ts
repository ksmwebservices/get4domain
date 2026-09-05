import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * A "Request a callback" from the support assistant or a support/contact surface.
 * Policy: Get4Domain calls the person back — we never show an inbound number for
 * them to dial/message. Recorded as a lead the admin/support team works outbound.
 */
export class RequestCallbackDto {
  @ApiProperty() @IsString() @MaxLength(120) name!: string;
  @ApiProperty() @IsString() @MaxLength(20) phone!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) email?: string;
  @ApiPropertyOptional({ enum: ['marketing', 'dashboard'] }) @IsOptional() @IsIn(['marketing', 'dashboard']) context?: string;
  @ApiPropertyOptional({ description: 'Business name if known (e.g. a logged-in vendor).' })
  @IsOptional() @IsString() @MaxLength(160) business?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) message?: string;
}
