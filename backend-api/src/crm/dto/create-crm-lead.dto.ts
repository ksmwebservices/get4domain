import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCrmLeadDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ required: false, example: 'manual' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({ required: false, description: 'Industry-specific contact fields' })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class ImportCrmLeadDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

/** Bulk CSV/list import into the vendor's OWN CRM call list (NOT messaging consent). */
export class ImportCrmLeadsDto {
  @ApiProperty({ type: [ImportCrmLeadDto] })
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ImportCrmLeadDto)
  contacts!: ImportCrmLeadDto[];
}
