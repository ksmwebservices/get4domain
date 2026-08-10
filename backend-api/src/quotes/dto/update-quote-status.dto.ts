import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateQuoteStatusDto {
  @ApiProperty({ enum: ['sent', 'viewed', 'accepted'] })
  @IsIn(['sent', 'viewed', 'accepted'])
  status!: string;
}
