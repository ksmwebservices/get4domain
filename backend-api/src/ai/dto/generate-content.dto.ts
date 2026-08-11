import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export const CONTENT_CHANNELS = [
  // AI Studio content types
  'social_post', 'reel_script', 'blog_post', 'festival_poster', 'ad_creative', 'email', 'whatsapp', 'sms',
  // Legacy channels (Growth Hub publish)
  'facebook', 'instagram', 'reel', 'poster', 'blog',
] as const;

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
