import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class PublishDto {
  @ApiProperty({ enum: ['facebook', 'instagram'] })
  @IsIn(['facebook', 'instagram'])
  platform!: 'facebook' | 'instagram';

  @ApiProperty({ description: 'Approved post content' })
  @IsString()
  content!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class AdRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'lead_generation' })
  @IsString()
  objective!: string;

  @ApiProperty({ example: 5000, description: 'Ad budget in INR' })
  @IsInt()
  @Min(1)
  budget!: number;

  @ApiProperty({ example: 7 })
  @IsInt()
  @Min(1)
  durationDays!: number;

  @ApiProperty({ description: 'Free-text audience description' })
  @IsString()
  audience!: string;

  @ApiPropertyOptional({ enum: ['meta_ads', 'google_ads'], default: 'meta_ads' })
  @IsOptional()
  @IsIn(['meta_ads', 'google_ads'])
  channel?: 'meta_ads' | 'google_ads';
}
