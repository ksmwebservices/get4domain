import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CrmService } from './crm.service';
import { CreateCrmLeadDto } from './dto/create-crm-lead.dto';
import { UpdateCrmLeadDto } from './dto/update-crm-lead.dto';
import { LogCallDto } from './dto/log-call.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('crm')
@ApiBearerAuth()
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('leads')
  @ApiOperation({ summary: "List the current vendor's leads, filterable by status/source/date" })
  findLeads(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.crmService.findLeads(user.sub, { status, source, from, to });
  }

  @Post('leads')
  @ApiOperation({ summary: 'Add a manual lead' })
  createLead(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCrmLeadDto) {
    return this.crmService.createLead(user.sub, dto);
  }

  @Get('leads/:id')
  @ApiOperation({ summary: 'Get a lead with its call history' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.crmService.findOne(id, user.sub);
  }

  @Put('leads/:id')
  @ApiOperation({ summary: 'Update lead status/notes/assignment/follow-up date' })
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateCrmLeadDto) {
    return this.crmService.update(id, user.sub, dto);
  }

  @Post('leads/:id/call')
  @ApiOperation({ summary: 'Log a call against a lead' })
  logCall(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: LogCallDto) {
    return this.crmService.logCall(id, user.sub, user.email, dto);
  }

  @Get('telecrm/queue')
  @ApiOperation({ summary: "Today's call queue, sorted by priority (new leads, then overdue follow-ups)" })
  telecrmQueue(@CurrentUser() user: AuthenticatedUser) {
    return this.crmService.telecrmQueue(user.sub);
  }

  @Get('telecrm/followups')
  @ApiOperation({ summary: 'Upcoming follow-up reminders' })
  telecrmFollowups(@CurrentUser() user: AuthenticatedUser) {
    return this.crmService.telecrmFollowups(user.sub);
  }
}
