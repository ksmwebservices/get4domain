import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * Vendor self-service payload. Every field is optional — the UI PATCHes only
 * what changed. `null` is meaningful on the nullable fields: it CLEARS the
 * override and falls back to the platform/business default.
 */
export class UpdateVendorCommsDto {
  // ── WhatsApp — full self-service (the vendor's own number) ────────────────

  @ApiProperty({ required: false, description: 'Turn the vendor’s WhatsApp channel on or off' })
  @IsOptional()
  @IsBoolean()
  waEnabled?: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    example: '1122334455',
    description: 'Fast2SMS phone_number_id for the vendor’s own WhatsApp number. null unlinks it.',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(20)
  waPhoneNumberId?: string | null;

  @ApiProperty({ required: false, nullable: true, example: '+91 98765 43210', description: 'Display form of the number, shown in the dashboard' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(24)
  waDisplayNumber?: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'The vendor’s own approved Fast2SMS template id. Blank = platform template.' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(64)
  waTemplateId?: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'Opening line the WhatsApp bot uses' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(300)
  waGreeting?: string | null;

  // ── SMS / Email — branding only, never separate infrastructure ────────────

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'MR Travels',
    description: 'Business name shown inside outgoing SMS. The DLT sender-ID stays platform-level.',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(40)
  smsBusinessName?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'MR Travels',
    description: 'From display name on outgoing email. The sending address stays the platform’s verified domain.',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(60)
  emailFromName?: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'info@mrtravels.com', description: 'Where customer replies should land' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsEmail()
  emailReplyTo?: string | null;
}

/**
 * Admin-assist payload: everything the vendor can set, plus `waStatus` — the
 * verification flag only an admin may move. Kept as a separate class so the
 * vendor route physically cannot accept it (global forbidNonWhitelisted pipe).
 */
export class AdminUpdateVendorCommsDto extends UpdateVendorCommsDto {
  @ApiProperty({ required: false, enum: ['unverified', 'pending', 'verified'], description: 'Admin confirms the WhatsApp number really belongs to this vendor' })
  @IsOptional()
  @IsIn(['unverified', 'pending', 'verified'])
  waStatus?: string;
}
