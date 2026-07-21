import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CallSummaryDto {
  @ApiProperty()
  @IsString()
  textNotes!: string;

  @ApiProperty()
  @IsString()
  leadName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  callDuration?: number;
}
