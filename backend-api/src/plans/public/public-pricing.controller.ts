import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { PublicPricing } from './public-pricing.shape';
import { PublicPricingService } from './public-pricing.service';

/** The public pricing page (Wave 3 Part B). No login, read only, cacheable. Shows nothing internal and no discount, coupon or offer. */
@ApiTags('v3-public-pricing')
@Controller('v3/public/pricing')
export class PublicPricingPageController {
  constructor(private readonly pricing: PublicPricingService) {}

  @Public() @Throttle(RATE.siteRead)
  @Get()
  @ApiOperation({ summary: 'The three plans by the three terms with the price before GST, GST as a separate line, the Free trial entry, what each plan includes, and the add-on packs (a pending price is never a number and cannot be bought)' })
  async get(@Res({ passthrough: true }) res: Response): Promise<PublicPricing> {
    res.set('Cache-Control', 'public, max-age=300');
    return this.pricing.get();
  }
}
