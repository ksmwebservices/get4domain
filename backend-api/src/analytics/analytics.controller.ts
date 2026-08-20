import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService, UsageCounts, VendorUsageRow } from './analytics.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('analytics')
@ApiBearerAuth()
@RequireModule('reports')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('usage')
  @ApiOperation({ summary: "The caller's own tool usage (vendorId-scoped); ?from=&to=" })
  usage(@CurrentUser() user: AuthenticatedUser, @Query('from') from?: string, @Query('to') to?: string): Promise<UsageCounts> {
    return this.service.usage(user.sub, from, to);
  }

  @UseGuards(AdminGuard)
  @Get('usage/all')
  @ApiOperation({ summary: 'Cross-vendor tool utilization (admin); ?from=&to=' })
  allUsage(@Query('from') from?: string, @Query('to') to?: string): Promise<VendorUsageRow[]> {
    return this.service.allUsage(from, to);
  }

  @UseGuards(AdminGuard)
  @Get('platform-accounting')
  @ApiOperation({ summary: 'Platform accounting AGGREGATE (admin) — totals only, no vendor expenses' })
  platformAccounting() {
    return this.service.platformAccounting();
  }
}
