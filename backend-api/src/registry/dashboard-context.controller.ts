import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { DashboardContext, DashboardContextService } from './dashboard-context.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardContextController {
  constructor(private readonly context: DashboardContextService) {}

  @Get('context')
  @ApiOperation({ summary: "The signed-in vendor's plan, profile, Dashboard v2 switch, payment-due and go-live signals (own account only)" })
  me(@CurrentUser() user: AuthenticatedUser): Promise<DashboardContext> {
    return this.context.build(user);
  }
}
