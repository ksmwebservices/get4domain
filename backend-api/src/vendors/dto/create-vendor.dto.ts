import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

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
}
