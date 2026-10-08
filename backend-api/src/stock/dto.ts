import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const ADJUST_MODES = ['add', 'remove', 'set'] as const;
export const ADJUST_REASONS = ['SHOP_SALE', 'DAMAGE', 'RETURN', 'RECOUNT', 'OPENING', 'ADJUSTMENT'] as const;

export class AdjustStockDto {
  @ApiProperty({ enum: ADJUST_MODES }) @IsIn(ADJUST_MODES as unknown as string[]) mode!: (typeof ADJUST_MODES)[number];
  @ApiProperty({ example: 2 }) @IsInt() @Min(0) @Max(1_000_000) quantity!: number;
  @ApiProperty({ enum: ADJUST_REASONS }) @IsIn(ADJUST_REASONS as unknown as string[]) reason!: (typeof ADJUST_REASONS)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) note?: string;
  @ApiPropertyOptional({ description: 'Send the same key twice and the change is applied once' }) @IsOptional() @IsString() @MaxLength(64) idempotencyKey?: string;
}
