import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Public self-service signup. Creates a real vendor + trial credit and logs them in. */
export class RegisterDto {
  @ApiProperty({ example: 'Kalyaan R' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'you@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass1' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/(?=.*[A-Z])(?=.*\d)/, { message: 'Password must include an uppercase letter and a number' })
  password!: string;

  @ApiProperty({ example: 'CareWell Clinic' })
  @IsString()
  businessName!: string;

  @ApiProperty({ example: 'clinic', description: 'Industry key (e.g. clinic, restaurant, realestate)' })
  @IsString()
  industry!: string;

  @ApiProperty({ required: false, example: '+919876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: 'K7M2P9QX', description: 'Wave 3: a referral code the business came with (checked by GET /v3/public/referral/:code). A code that does not resolve is ignored; it never blocks a signup.' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  referralCode?: string;

  @ApiProperty({ required: false, example: 'carewell', description: 'Wave 3: the free subdomain the business wants (checked by GET /v3/public/subdomain-availability). Omit it and one is made from the business name.' })
  @IsOptional()
  @IsString()
  @MaxLength(63)
  subdomain?: string;

  @ApiProperty({ required: false, example: 'leadspace', description: 'leadspace = a LeadSpace-only account (free page, verified leads, prepaid wallet); omit for a normal signup' })
  @IsOptional()
  @IsIn(['leadspace'])
  product?: 'leadspace';

  @ApiProperty({ required: false, example: 'handyman', description: 'V3 plans: the track the business chooses (handyman, professional, ecommerce). Used only when free-plan provisioning at registration is switched on.' })
  @IsOptional()
  @IsIn(['handyman', 'professional', 'ecommerce'])
  track?: 'handyman' | 'professional' | 'ecommerce';

  // D1 duplicate check: optional details that make it sharper (none is stored by registration)
  @ApiProperty({ required: false, example: 'Chennai' })
  @IsOptional() @IsString() @MaxLength(80)
  city?: string;

  @ApiProperty({ required: false, example: 'T Nagar' })
  @IsOptional() @IsString() @MaxLength(80)
  area?: string;

  @ApiProperty({ required: false, example: '600017' })
  @IsOptional() @IsString() @MaxLength(6)
  pincode?: string;

  @ApiProperty({ required: false, example: '33ABCDE1234F1Z5', description: 'GSTIN, used only to find an existing business' })
  @IsOptional() @IsString() @MaxLength(20)
  gstin?: string;

  @ApiProperty({ required: false, description: 'Answer to "Is this your business?" (409 DUPLICATE_POSSIBLE): true = it is a different business. The site is created but held for admin review and not published.' })
  @IsOptional() @IsBoolean()
  confirmDistinct?: boolean;
}
