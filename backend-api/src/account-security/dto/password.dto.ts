import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** The signup password rule (8+ characters, an uppercase letter and a digit) plus bcrypt's 72-character limit, so no password is silently cut short. */
function NewPassword() {
  return applyDecorators(
    ApiProperty({ example: 'StrongPass1' }),
    IsString(),
    MinLength(8, { message: 'Password must be at least 8 characters' }),
    MaxLength(72, { message: 'Password must be at most 72 characters' }),
    Matches(/(?=.*[A-Z])(?=.*\d)/, { message: 'Password must include an uppercase letter and a number' }),
  );
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'you@example.com' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'The token from the reset link in the email' })
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

  @NewPassword()
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentPassword!: string;

  @NewPassword()
  newPassword!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MaxLength(300)
  refreshToken!: string;
}
