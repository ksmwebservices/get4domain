import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @ApiProperty()
  @IsString()
  inviteToken!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;
}
