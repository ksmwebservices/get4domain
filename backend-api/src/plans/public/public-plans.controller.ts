import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PublicPlans } from './public-plans.shape';
import { PublicPlansService } from './public-plans.service';

/** The public plan and price comparison (no login). Read only; shows nothing internal. */
@ApiTags('v3-plans')
@Controller('v3')
export class PublicPlansController {
  constructor(private readonly plans: PublicPlansService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'Public plans with their term prices and the feature comparison (HIDDEN features left out)' })
  list(): Promise<PublicPlans> {
    return this.plans.getPlans();
  }
}
