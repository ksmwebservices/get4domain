import { ApiProperty } from '@nestjs/swagger';
import { IsHexColor, IsOptional, IsString } from 'class-validator';

export class UpdateVendorOverrideDto {
  @ApiProperty({ required: false, example: '#e11d48' }) @IsOptional() @IsHexColor() accentColor?: string;
  @ApiProperty({ required: false, example: '#be123c' }) @IsOptional() @IsHexColor() accentColorDark?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() welcomeText?: string;
  @ApiProperty({ required: false, example: 'clinic' }) @IsOptional() @IsString() websiteTemplate?: string;
}
