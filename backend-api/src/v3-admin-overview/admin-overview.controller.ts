import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { staffRoleOf } from '../auth/guards/staff-access';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminOverviewService } from './admin-overview.service';

/** K1: the admin overview. Role matrix: SUPER_ADMIN, OPERATIONS (ADMIN inherits) and SALES; each role receives only its own sections. */
@ApiTags('v3-admin-overview')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminOverviewController {
  constructor(private readonly service: AdminOverviewService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Counts and trends from real tables (vendors, revenue, enquiries, support, domains and services, referrals) and a 30-day daily series; a section the caller\'s role may not see is absent; revenue is null while payments are off; kept for 60 seconds; carries generatedAt' })
  overview(@CurrentUser() user: AuthenticatedUser) { return this.service.overview(staffRoleOf(user)); }
}
