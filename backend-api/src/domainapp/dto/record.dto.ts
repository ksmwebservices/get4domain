import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRecordDto {
  @ApiPropertyOptional({ description: 'Linked Contact id' })
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Linked CatalogItem id' })
  @IsOptional()
  @IsString()
  catalogItemId?: string;

  @ApiPropertyOptional({ example: 'draft' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ example: '2026-08-15T00:00:00.000Z' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: 15000, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Industry-specific extra fields' })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateRecordDto extends PartialType(CreateRecordDto) {}

export class UpdateRecordStatusDto {
  @ApiProperty({ example: 'confirmed' })
  @IsString()
  status!: string;
}
