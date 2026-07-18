import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyPaymentDto {
  @ApiProperty({ example: 'clxinvoice1234567890' })
  @IsString()
  invoiceId!: string;

  @ApiProperty({ example: 'order_ABC123' })
  @IsString()
  razorpayOrderId!: string;

  @ApiProperty({ example: 'pay_ABC123' })
  @IsString()
  razorpayPaymentId!: string;

  @ApiProperty({ example: 'signature_hash' })
  @IsString()
  razorpaySignature!: string;
}
