import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateVideoDto {
  @ApiProperty({ required: false, description: 'Visual prompt (Runway text/image-to-video)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  prompt?: string;

  @ApiProperty({ required: false, description: 'Spoken script (HeyGen avatar presenter)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  script?: string;

  @ApiProperty({ required: false, description: 'Optional init image URL (Runway image-to-video)' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class VideoStatusDto {
  @ApiProperty({ example: 'runway' })
  @IsString()
  provider!: string;

  @ApiProperty({ example: 'job_abc123' })
  @IsString()
  jobId!: string;
}
