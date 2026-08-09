import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/** Admin specifies which vendor to toggle an addon/module for. */
export class VendorTargetDto {
  @ApiProperty({ description: 'Target vendor id' })
  @IsString()
  vendorId!: string;
}
