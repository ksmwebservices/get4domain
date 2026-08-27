import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SearchDomainsDto {
  @ApiProperty({ example: 'myshop', description: 'Desired name or full domain (e.g. myshop or myshop.com)' })
  @IsString()
  @MinLength(2)
  query!: string;
}
