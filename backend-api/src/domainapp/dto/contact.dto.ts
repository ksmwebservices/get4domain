import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateContactDto {
  @ApiProperty({ example: 'Ramesh Kumar' })
  @IsString()
  name!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  phone!: string;

  @ApiPropertyOptional({ example: 'ramesh@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'customer', description: 'Contact type (industry label varies)' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  portalAccess?: boolean;

  @ApiPropertyOptional({ description: 'Industry-specific extra fields' })
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'GSTIN (for tax invoices)' })
  @IsOptional()
  @IsString()
  gstin?: string;

  @ApiPropertyOptional({ description: 'State, for the place of supply' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shippingAddress?: string;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}
