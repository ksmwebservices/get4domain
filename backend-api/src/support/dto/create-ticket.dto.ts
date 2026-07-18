import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ example: 'billing' })
  @IsString()
  category!: string;

  @ApiProperty({ example: 'Invoice amount looks incorrect' })
  @IsString()
  subject!: string;

  @ApiProperty({ example: 'The GST calculation on INV-2026-0001 seems off, can you check?' })
  @IsString()
  message!: string;
}
