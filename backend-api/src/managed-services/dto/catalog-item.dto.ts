import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CreateCatalogItemDto {
  @ApiProperty({ example: 'Custom Web Application' }) @IsString() @MaxLength(160) label!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiProperty({ example: 10000000, description: 'Placeholder default rate in paise — admin sets the real value' })
  @IsInt() @IsPositive() defaultRate!: number;
  @ApiPropertyOptional({ example: 'one-time' }) @IsOptional() @IsString() @MaxLength(40) unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateCatalogItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @IsPositive() defaultRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
