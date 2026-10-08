import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

/** Vendor updates their OWN Razorpay credentials (secret is write-only; never returned). */
export class UpdateVendorPaymentDto {
  @ApiProperty({ required: false, example: 'rzp_live_XXXXXXXX' })
  @IsOptional()
  @IsString()
  razorpayKeyId?: string;

  @ApiProperty({ required: false, description: 'Razorpay key secret — stored encrypted, never returned. Omit to keep the existing one.' })
  @IsOptional()
  @IsString()
  razorpayKeySecret?: string;

  @ApiProperty({ required: false, description: 'Turn public-site payments on/off.' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ required: false, enum: ['ONLINE', 'ORDER_REQUEST'], description: 'ONLINE = pay with your own Razorpay; ORDER_REQUEST = shoppers send an order and you confirm it yourself.' })
  @IsOptional()
  @IsIn(['ONLINE', 'ORDER_REQUEST'])
  checkoutMode?: 'ONLINE' | 'ORDER_REQUEST';
}
