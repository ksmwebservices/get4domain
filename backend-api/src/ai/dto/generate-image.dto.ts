import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class GenerateImageDto {
  @ApiProperty({ example: 'elegant abstract letterhead background, subtle blue geometric pattern, professional, no text' })
  @IsString()
  @MaxLength(500)
  prompt!: string;
}
