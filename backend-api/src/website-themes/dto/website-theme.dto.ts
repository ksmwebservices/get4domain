import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateWebsiteThemeDto {
  @ApiProperty({ example: 'Emerald Fresh' })
  @IsString()
  name!: string;

  @ApiProperty({ required: false, example: 'salon', description: 'null/omitted = any industry' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({ example: { '--primary': '#059669', '--accent': '#10b981', '--radius': '16px' } })
  @IsObject()
  cssVars!: Record<string, string>;

  @ApiProperty({ required: false, description: 'Full data-driven layout (engine template shape); null = colours-only theme.' })
  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  preview?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateWebsiteThemeDto extends PartialType(CreateWebsiteThemeDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
