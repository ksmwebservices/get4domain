import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class RespondProposalDto {
  @ApiProperty({ enum: ['accepted', 'declined'] })
  @IsIn(['accepted', 'declined'])
  status!: 'accepted' | 'declined';
}
