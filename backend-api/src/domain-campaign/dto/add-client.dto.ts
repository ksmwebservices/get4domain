import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AddDomainCampaignClientDto {
  @ApiProperty({ example: 'clx_vendor_id' })
  @IsString()
  vendorId!: string;
}
