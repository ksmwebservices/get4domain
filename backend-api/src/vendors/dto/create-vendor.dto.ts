import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateVendorDto {
  @ApiProperty({ example: 'Muthukumar R' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'muthukumar@mrtravels.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'MR Travels' })
  @IsString()
  businessName!: string;

  @ApiProperty({ required: false, example: '+919876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: 'travel' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({ required: false, example: 'mrtravels' })
  @IsOptional()
  @IsString()
  subdomain?: string;

  @ApiProperty({ required: false, example: 'mrtravels.com' })
  @IsOptional()
  @IsString()
  customDomain?: string;

  @ApiProperty({ required: false, example: '1122334455', description: 'Fast2SMS phone_number_id — routes WhatsApp-bot webhooks to this vendor' })
  @IsOptional()
  @IsString()
  waPhoneNumberId?: string;

  // D1 duplicate check: optional details that make the check sharper. None of them is stored here.
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

  @ApiProperty({ required: false, description: 'Answer to "Is this your business?": true = it is a different business. It is then created but held for admin review, unpublished.' })
  @IsOptional() @IsBoolean()
  confirmDistinct?: boolean;

  @ApiProperty({ required: false, description: 'STAFF only (ADMIN or SUPER_ADMIN): a written reason of 5 to 300 characters to create this business although it looks like an existing one. Logged.' })
  @IsOptional() @IsString() @MaxLength(300)
  duplicateOverrideReason?: string;
}
