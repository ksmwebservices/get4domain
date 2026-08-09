import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SummaryService } from './summary.service';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('domainapp-summary')
@ApiBearerAuth()
@Controller('domainapp/summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get()
  @ApiOperation({ summary: 'Dashboard overview: counts, records by status, revenue, recent records' })
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.summaryService.getSummary(user.sub);
  }
}
