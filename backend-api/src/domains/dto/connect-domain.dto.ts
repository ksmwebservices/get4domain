import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ConnectDomainDto {
  @ApiProperty({ example: 'www.mybusiness.com', description: 'A domain the vendor already owns elsewhere' })
  @IsString()
  @Matches(/^([a-z0-9-]+\.)+[a-z]{2,}$/i, { message: 'Must be a valid domain like mybusiness.com' })
  domain!: string;
}
