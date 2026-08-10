import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

/** Book-Demo Phase 1 — minimal fields + the OTP code to verify the mobile. */
export class VerifyDemoLeadDto {
  @ApiProperty({ example: 'Ravi Kumar' })
  @IsString()
  name!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Matches(/\d{10}/, { message: 'A valid mobile number is required' })
  phone!: string;

  @ApiProperty({ example: 'Restaurant & Food' })
  @IsString()
  industry!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  code!: string;
}
