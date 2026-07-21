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

  @ApiProperty({ type: [String], example: ['crm', 'campaigns'] })
  @IsArray()
  modules!: string[];
}
