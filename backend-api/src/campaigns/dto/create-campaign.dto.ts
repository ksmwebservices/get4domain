import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [String], example: ['whatsapp', 'sms', 'facebook'] })
  @IsArray()
  channels!: string[];

  @ApiProperty({ type: Object, description: 'Per-channel generated content' })
  @IsObject()
  content!: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
