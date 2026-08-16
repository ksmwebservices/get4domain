import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Campaign Manager' })
  @IsString()
  role!: string;

  @ApiProperty({ required: false, enum: ['Sales', 'Support', 'Accounts', 'Marketing'], description: '3D: department scope (prefills access)' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ type: [String], example: ['crm', 'campaigns'] })
  @IsArray()
  modules!: string[];
}
