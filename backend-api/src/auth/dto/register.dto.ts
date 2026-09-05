import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

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
}
