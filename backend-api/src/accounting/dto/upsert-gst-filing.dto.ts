import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpsertGstFilingDto {
  @ApiProperty({ example: '2026-08', description: 'Return period (YYYY-MM)' })
  @IsString()
  period!: string;

  @ApiProperty({ enum: ['GSTR-1', 'GSTR-3B', 'GSTR-2B', 'Annual'] })
  @IsIn(['GSTR-1', 'GSTR-3B', 'GSTR-2B', 'Annual'])
  formType!: 'GSTR-1' | 'GSTR-3B' | 'GSTR-2B' | 'Annual';

  @ApiProperty({ required: false, enum: ['pending', 'in_progress', 'filed', 'not_due'], default: 'pending' })
  @IsOptional()
  @IsIn(['pending', 'in_progress', 'filed', 'not_due'])
  status?: 'pending' | 'in_progress' | 'filed' | 'not_due';

  @ApiProperty({ required: false, example: '2026-09-20' })
  @IsOptional()
  @IsString()
  dueDate?: string;
}
