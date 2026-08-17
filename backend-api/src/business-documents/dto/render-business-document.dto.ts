import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

class BrandDto {
  @ApiProperty({ required: false, example: '#2563eb' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class RenderBusinessDocumentDto {
  @ApiProperty({ enum: ['letterhead', 'visiting_card', 'id_card'] })
  @IsIn(['letterhead', 'visiting_card', 'id_card'])
  type!: 'letterhead' | 'visiting_card' | 'id_card';

  @ApiProperty({ description: 'Flat values keyed by field key (business, person, designation, phone, email, address, website, tagline)' })
  @IsObject()
  values!: Record<string, string>;

  @ApiProperty({ required: false, type: BrandDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BrandDto)
  brand?: BrandDto;
}
