import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

/** The two launch plans, billed upfront. */
export type LaunchPlan = 'quarterly' | 'annual';

/** Body for POST demo/buy/order — which plan to create the Razorpay order for. */
export class BuyOrderDto {
  @ApiProperty({ required: false, enum: ['quarterly', 'annual'], default: 'quarterly' })
  @IsOptional()
  @IsIn(['quarterly', 'annual'])
  plan?: LaunchPlan;
}

/** Strip +91 / 0 / spaces / dashes / brackets to a clean 10-digit Indian mobile. */
const toTenDigits = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const d = value.replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
};

export class SeedVendorDto {
  @ApiProperty({ example: 'clx_vendor_id' })
  @IsString()
  vendorId!: string;

  @ApiProperty({ example: 'travel' })
  @IsString()
  industry!: string;
}

/** Phase 5 — profile + payment collected at the buy-now conversion. */
export class ConfirmBuyDto {
  @ApiProperty({ example: 'Ravi Enterprises' })
  @IsString()
  businessName!: string;

  @ApiProperty({ example: 'ravi@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'S3curePass' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty()
  @IsString()
  razorpayOrderId!: string;

  @ApiProperty()
  @IsString()
  razorpayPaymentId!: string;

  @ApiProperty()
  @IsString()
  razorpaySignature!: string;

  @ApiProperty({ required: false, enum: ['quarterly', 'annual'], default: 'quarterly', description: 'The plan paid for — must match the buy/order plan.' })
  @IsOptional()
  @IsIn(['quarterly', 'annual'])
  plan?: LaunchPlan;
}

export class DemoEnquiryDto {
  @ApiProperty({ example: 'Ravi Kumar' })
  @IsString()
  name!: string;

  @ApiProperty({ example: '+91 98765 43210' })
  @Transform(toTenDigits)
  @IsString()
  @Matches(/^\d{10}$/, { message: 'A valid 10-digit mobile number is required' })
  phone!: string;

  @ApiProperty({ example: 'Restaurant & Food' })
  @IsString()
  industry!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  message?: string;
}
