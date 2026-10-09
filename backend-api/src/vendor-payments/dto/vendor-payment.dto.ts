import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Vendor updates their OWN Razorpay credentials (secret is write-only; never returned). */
export class UpdateVendorPaymentDto {
  @ApiProperty({ required: false, example: 'rzp_live_XXXXXXXX' })
  @IsOptional()
  @IsString({ message: 'The Razorpay Key ID must be text.' })
  @Matches(/^(|rzp_(test|live)_[A-Za-z0-9]{6,40})$/, { message: 'That does not look like a Razorpay Key ID. It starts with rzp_test_ or rzp_live_, for example rzp_live_AbC123xyz789. You can copy it from your Razorpay dashboard under Account and settings, API keys.' })
  razorpayKeyId?: string;

  @ApiProperty({ required: false, description: 'Razorpay key secret — stored encrypted, never returned. Omit to keep the existing one.' })
  @IsOptional()
  @IsString({ message: 'The Razorpay Key Secret must be text.' })
  @Matches(/^(|\S{10,80})$/, { message: 'The Razorpay Key Secret looks wrong. It is one long word with no spaces. Copy it again from your Razorpay dashboard.' })
  razorpayKeySecret?: string;

  @ApiProperty({ required: false, description: 'Turn public-site payments on/off.' })
  @IsOptional()
  @IsBoolean({ message: 'Choose on or off for website payments.' })
  enabled?: boolean;

  @ApiProperty({ required: false, enum: ['ONLINE', 'ORDER_REQUEST'], description: 'ONLINE = pay with your own Razorpay; ORDER_REQUEST = shoppers send an order and you confirm it yourself.' })
  @IsOptional()
  @IsIn(['ONLINE', 'ORDER_REQUEST'], { message: 'Choose how customers should order: online payment or order request.' })
  checkoutMode?: 'ONLINE' | 'ORDER_REQUEST';
}

/** Test connection: optionally the keys typed on the screen (not yet saved); otherwise the saved ones are tried. */
export class TestConnectionDto {
  @IsOptional() @IsString() @MaxLength(60) @Matches(/^(|rzp_(test|live)_[A-Za-z0-9]{6,40})$/, { message: 'That does not look like a Razorpay Key ID. It starts with rzp_test_ or rzp_live_.' })
  razorpayKeyId?: string;
  @IsOptional() @IsString() @MaxLength(80)
  razorpayKeySecret?: string;
}
