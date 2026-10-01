import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateQuoteStatusDto {
  @ApiProperty({ enum: ['draft', 'sent', 'viewed', 'accepted', 'declined'] })
  @IsIn(['draft', 'sent', 'viewed', 'accepted', 'declined'])
  status!: string;
}
