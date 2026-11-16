import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { Availability } from '../core/trial-core';
import { TrialSignupPolicy } from '../trial-signup.policy';

export class AvailabilityQueryDto { @IsOptional() @IsString() @MaxLength(100) name?: string }

/** The address check of the signup form (Wave 3 Part G). No login. It answers for any text and never reveals who owns a name or which words are blocked. Never cached: the answer changes as names are taken. */
@ApiTags('v3-trial')
@Controller('v3/public/subdomain-availability')
export class TrialController {
  constructor(private readonly policy: TrialSignupPolicy) {}

  @Public() @Throttle(RATE.directoryRead)
  @Get()
  @ApiOperation({ summary: 'Is this free subdomain valid, not reserved, and not taken? Same rules as registering and as changing the address later.' })
  async check(@Query() q: AvailabilityQueryDto, @Res({ passthrough: true }) res: Response): Promise<Availability> {
    res.set('Cache-Control', 'no-store');
    return this.policy.check(q.name ?? '');
  }
}
