import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export const CONTENT_CHANNELS = ['facebook', 'instagram', 'reel', 'poster', 'blog'] as const;

export class GenerateContentDto {
  @ApiProperty({ enum: CONTENT_CHANNELS })
  @IsIn(CONTENT_CHANNELS)
  channel!: (typeof CONTENT_CHANNELS)[number];

  @ApiProperty()
  @IsString()
  vendorIndustry!: string;

  @ApiProperty()
  @IsString()
  offerDetails!: string;

  @ApiProperty({ required: false, example: 'friendly' })
  @IsOptional()
  @IsString()
  tone?: string;
}
