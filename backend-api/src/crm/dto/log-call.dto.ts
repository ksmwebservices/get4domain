import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

export class LogCallDto {
  @ApiProperty({ required: false, description: 'Call duration in seconds' })
  @IsOptional()
  @IsInt()
  duration?: number;

  @ApiProperty({ required: false, example: 'interested' })
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  aiSummary?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  followUpAt?: string;
}
