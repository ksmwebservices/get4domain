import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateAdminLeadDto {
  @ApiPropertyOptional({ example: 'contacted' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}
