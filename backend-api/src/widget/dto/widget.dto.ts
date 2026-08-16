import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class WidgetLeadDto {
  @ApiProperty() @IsString() key!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsString() phone!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() message?: string;
}

export class WidgetChatDto {
  @ApiProperty() @IsString() key!: string;
  @ApiProperty() @IsString() message!: string;
  @ApiProperty({ required: false, type: [Object] }) @IsOptional() @IsArray() history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}
