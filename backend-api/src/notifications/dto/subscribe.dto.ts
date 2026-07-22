import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsString, ValidateNested } from 'class-validator';

class PushKeysDto {
  @ApiProperty({ example: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM' })
  @IsString()
  p256dh!: string;

  @ApiProperty({ example: 'tBHItJI5svbpez7KI4CCXg' })
  @IsString()
  auth!: string;
}

export class SubscribeDto {
  @ApiProperty({ example: 'https://fcm.googleapis.com/fcm/send/...' })
  @IsString()
  endpoint!: string;

  @ApiProperty({ type: PushKeysDto })
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  @ApiProperty({ example: 'web' })
  @IsString()
  device!: string;

  @ApiProperty({ enum: ['VENDOR', 'ADMIN'] })
  @IsIn(['VENDOR', 'ADMIN'])
  userType!: 'VENDOR' | 'ADMIN';
}
