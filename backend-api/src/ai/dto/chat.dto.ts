import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  content!: string;
}

export class ChatDto {
  @ApiProperty({ example: 'What is DomainApp?' })
  @IsString()
  message!: string;

  @ApiProperty({ type: [ChatMessageDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  conversationHistory?: ChatMessageDto[];

  @ApiProperty({ enum: ['marketing', 'dashboard'], required: false, default: 'marketing' })
  @IsOptional()
  @IsIn(['marketing', 'dashboard'])
  context?: 'marketing' | 'dashboard';

  @ApiProperty({ required: false, example: 'travel' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({ required: false, example: 'Muthukumar R' })
  @IsOptional()
  @IsString()
  vendorName?: string;
}
