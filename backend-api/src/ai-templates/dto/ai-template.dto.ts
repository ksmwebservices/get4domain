import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

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
}

export class UpdateAiTemplateDto extends PartialType(CreateAiTemplateDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
