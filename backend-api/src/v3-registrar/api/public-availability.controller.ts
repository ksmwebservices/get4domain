import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { PublicDomainAvailabilityService } from '../public-availability.service';

export class DomainAvailabilityQueryDto { @IsOptional() @IsString() @MaxLength(253) name?: string }

/** B3.6: one public route for a typed name: the free subdomain and a custom domain, with honest states. Never cached (the answer changes as names are taken). */
@ApiTags('v3-domain-availability')
@Controller('v3/public/domain-availability')
export class PublicDomainAvailabilityController {
  constructor(private readonly availability: PublicDomainAvailabilityService) {}

  @Public() @Throttle(RATE.directoryRead) @Get()
  @ApiOperation({ summary: 'For a typed name: the free subdomain (AVAILABLE, TAKEN, RESERVED, INVALID, with a similar-name warning) and a custom domain (REGISTRAR_OFF while the registrar is switched off; AVAILABLE, TAKEN or UNKNOWN when it is on). Never a made-up "available".' })
  async check(@Query() q: DomainAvailabilityQueryDto, @Res({ passthrough: true }) res: Response) {
    res.set('Cache-Control', 'no-store');
    return this.availability.check(q.name ?? '');
  }
}
