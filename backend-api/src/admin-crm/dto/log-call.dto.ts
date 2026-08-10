import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class LogAdminCallDto {
  @ApiPropertyOptional({ description: 'Call duration in seconds' })
  @IsOptional()
  @IsInt()
  duration?: number;

  @ApiPropertyOptional({ example: 'interested' })
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aiSummary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  followUpAt?: string;
}
