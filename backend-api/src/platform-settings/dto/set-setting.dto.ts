import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SetSettingDto {
  @ApiProperty({ description: 'Raw value to encrypt and store' })
  @IsString()
  value!: string;
}
