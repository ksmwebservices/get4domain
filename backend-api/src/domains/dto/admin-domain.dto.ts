import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class AdminRegisterDomainDto {
  @ApiProperty({ example: 'clx…', description: 'Vendor to register the domain for' })
  @IsString()
  vendorId!: string;

  @ApiProperty({ example: 'myshop.in' })
  @IsString()
  @Matches(/^[a-z0-9-]+\.[a-z.]{2,}$/i, { message: 'Must be a valid domain like myshop.in' })
  domain!: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 10, default: 1, required: false })
  @IsInt()
  @Min(1)
  @Max(10)
  years: number = 1;
}

export class AdminDomainActionDto {
  @ApiProperty({ example: 'clx…' })
  @IsString()
  vendorId!: string;

  @ApiProperty({ example: 'mybusiness.com' })
  @IsString()
  @Matches(/^([a-z0-9-]+\.)+[a-z]{2,}$/i, { message: 'Must be a valid domain' })
  domain!: string;
}
