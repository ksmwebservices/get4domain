import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyTopupDto {
  @ApiProperty()
  @IsString()
  razorpayOrderId!: string;

  @ApiProperty()
  @IsString()
  razorpayPaymentId!: string;

  @ApiProperty()
  @IsString()
  razorpaySignature!: string;
}
