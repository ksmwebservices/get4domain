import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateLeadDto {
  @ApiProperty({ example: 'Ravi Kumar' })
  @IsString()
  name!: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  phone!: string;

  @ApiProperty({ required: false, example: 'ravi@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'Spice Garden Restaurant' })
  @IsString()
  business!: string;

  @ApiProperty({ example: 'Restaurant & Food' })
  @IsString()
  industry!: string;

  @ApiProperty({ example: 'DomainApp Startup' })
  @IsString()
  interest!: string;

  @ApiProperty({ required: false, example: 'Interested in digital menu and ordering' })
  @IsOptional()
  @IsString()
  message?: string;
}
