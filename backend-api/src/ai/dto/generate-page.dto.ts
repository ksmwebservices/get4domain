import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AiGeneratePageDto {
  @ApiProperty()
  @IsString()
  industry!: string;

  @ApiProperty()
  @IsString()
  businessName!: string;

  @ApiProperty()
  @IsString()
  offerTitle!: string;

  @ApiProperty()
  @IsString()
  description!: string;
}
