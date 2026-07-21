import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class SubscribeDto {
  @ApiProperty({ example: 'fcm-device-token' })
  @IsString()
  fcmToken!: string;

  @ApiProperty({ example: 'web' })
  @IsString()
  device!: string;

  @ApiProperty({ enum: ['VENDOR', 'ADMIN'] })
  @IsIn(['VENDOR', 'ADMIN'])
  userType!: 'VENDOR' | 'ADMIN';
}
