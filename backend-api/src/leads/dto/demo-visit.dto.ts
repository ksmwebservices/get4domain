import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** A prospect viewing a demo — recorded against their OTP-gate lead (by phone). */
export class DemoVisitDto {
  @ApiProperty({ example: '9876543210' }) @IsString() @MaxLength(20) phone!: string;
  @ApiProperty({ example: 'restaurant', description: 'Main category id of the demo.' })
  @IsString() @MaxLength(60) category!: string;
  @ApiPropertyOptional({ example: 'cafe', description: 'Sub-category id, if any.' })
  @IsOptional() @IsString() @MaxLength(60) sub?: string;
}

export interface DemoVisitResult {
  /** true → show the demo; false → redirect to the warm-lead sales page. */
  allowed: boolean;
  /** 'ok' | 'ungated' | 'category_locked' | 'cap_reached' */
  reason: 'ok' | 'ungated' | 'category_locked' | 'cap_reached';
  /** The category the visitor is scoped to (their first-viewed main category). */
  lockedCategory: string | null;
  /** Distinct demo visits recorded so far (max 3). */
  count: number;
}
