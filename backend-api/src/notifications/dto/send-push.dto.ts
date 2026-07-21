import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SendPushDto {
  @ApiProperty()
  @IsString()
  vendorId!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  data?: Record<string, string>;
}
