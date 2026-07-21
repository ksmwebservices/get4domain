import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export const MIN_TOPUP_PAISE = 99900;

export class TopupDto {
  @ApiProperty({ example: 99900, description: 'Top-up amount in paise (minimum 99900 = ₹999)' })
  @IsInt()
  @Min(MIN_TOPUP_PAISE)
  amount!: number;
}
