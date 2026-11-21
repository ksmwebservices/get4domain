import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { ClaimsService, ClaimStatus } from './claims.service';

/** The one public provisioning route. HTTP only; the rules are in ClaimsService. */
@ApiTags('v3-claim')
@Controller('v3/claim')
export class ClaimPublicController {
  constructor(private readonly claims: ClaimsService) {}

  @Public()
  @Throttle(RATE.claimStatus)
  @Get(':token/status')
  @ApiOperation({ summary: 'Is this claim link still usable? Returns the public business name and expiry, or the same 404 for every kind of invalid link' })
  status(@Param('token') token: string): Promise<ClaimStatus> {
    return this.claims.status(token);
  }
}
