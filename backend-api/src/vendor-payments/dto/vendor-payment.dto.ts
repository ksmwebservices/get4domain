import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

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
}
