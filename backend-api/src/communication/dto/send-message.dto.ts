import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ enum: ['whatsapp', 'email', 'sms'] })
  @IsIn(['whatsapp', 'email', 'sms'])
  channel!: 'whatsapp' | 'email' | 'sms';

  @ApiProperty({ description: 'Recipient phone or email' })
  @IsString()
  to!: string;

  @ApiProperty()
  @IsString()
  message!: string;

  @ApiPropertyOptional({ description: 'Email subject (email channel only)' })
  @IsOptional()
  @IsString()
  subject?: string;
}
