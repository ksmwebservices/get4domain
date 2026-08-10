import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Matches(/\d{10}/, { message: 'A valid mobile number is required' })
  phone!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @Matches(/\d{10}/, { message: 'A valid mobile number is required' })
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  code!: string;
}
