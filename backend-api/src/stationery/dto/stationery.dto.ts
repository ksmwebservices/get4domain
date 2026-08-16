import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStationeryDto {
  @ApiProperty({ example: 'A4 Paper' }) @IsString() name!: string;
  @ApiProperty({ required: false, example: 'ream' }) @IsOptional() @IsString() unit?: string;
  @ApiProperty({ example: 10 }) @IsNumber() @Min(0) quantity!: number;
  @ApiProperty({ required: false, example: 3 }) @IsOptional() @IsNumber() @Min(0) reorderThreshold?: number;
}
export class UpdateStationeryDto extends PartialType(CreateStationeryDto) {}
