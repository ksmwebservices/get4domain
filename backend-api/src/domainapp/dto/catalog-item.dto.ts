import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateCatalogItemDto {
  @ApiProperty({ example: 'Goa 3N/4D Package' })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 15000 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 'per person' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Industry-specific extra fields' })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Units in stock (empty = not counted)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number | null;
}

export class UpdateCatalogItemDto extends PartialType(CreateCatalogItemDto) {}
