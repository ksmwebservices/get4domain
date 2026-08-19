import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateAiTemplateDto {
  @ApiProperty({ example: 'Diwali Sale Poster' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'festival_poster' })
  @IsString()
  contentType!: string;

  @ApiProperty({ required: false, example: 'restaurant', description: 'null/omitted = all industries' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({ example: 'A festive Diwali sale banner with diyas and warm colours…' })
  @IsString()
  prompt!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  thumbnail?: string;

  @ApiProperty({ required: false, enum: ['prompt', 'canva', 'document', 'design', 'reel'], default: 'prompt' })
  @IsOptional()
  @IsIn(['prompt', 'canva', 'document', 'design', 'reel'])
  source?: string;

  @ApiProperty({ required: false, description: 'Canva brand_template_id (source=canva)' })
  @IsOptional()
  @IsString()
  canvaTemplateId?: string;

  @ApiProperty({ required: false, description: 'Data-fill field definitions (cmsSchema-style array)' })
  @IsOptional()
  @IsArray()
  fields?: unknown[];

  @ApiProperty({ required: false, description: 'Fabric.js scene JSON (source=design)' })
  @IsOptional()
  @IsObject()
  editorJson?: Record<string, unknown>;

  @ApiProperty({ required: false, description: 'Remotion reel config (source=reel)' })
  @IsOptional()
  @IsObject()
  videoConfig?: Record<string, unknown>;
}

export class UpdateAiTemplateDto extends PartialType(CreateAiTemplateDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
