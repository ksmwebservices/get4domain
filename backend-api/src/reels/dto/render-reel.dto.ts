import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

export class RenderReelDto {
  @ApiProperty({ type: [String], description: "The vendor's own photo URLs (their content)" })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  images!: string[];

  @ApiProperty({ required: false, description: 'Text overlay' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty({ required: false, description: 'Music track id from GET /reels/tracks (optional)' })
  @IsOptional()
  @IsString()
  trackId?: string;

  @ApiProperty({ required: false, description: 'Brand accent hex' })
  @IsOptional()
  @IsString()
  accent?: string;
}
