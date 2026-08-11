import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

/** Strip +91 / 0 / spaces / dashes / brackets to a clean 10-digit Indian mobile. */
const toTenDigits = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const d = value.replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
};

/** Book-Demo Phase 1 — minimal fields + the OTP code to verify the mobile. */
export class VerifyDemoLeadDto {
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

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  code!: string;
}
