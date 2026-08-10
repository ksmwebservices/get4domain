import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminCrmService } from './admin-crm.service';
import { UpdateAdminLeadDto } from './dto/update-lead.dto';
import { LogAdminCallDto } from './dto/log-call.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * Admin TeleCRM over demo-booking leads (g4d_leads). Same call/pipeline model
 * as the vendor CRM, used by the marketing team to convert website enquiries.
 */
@ApiTags('admin-crm')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/crm')
export class AdminCrmController {
  constructor(private readonly adminCrmService: AdminCrmService) {}

  @Get('leads')
  @ApiOperation({ summary: 'List demo-booking leads for the TeleCRM board' })
  findAll() {
    return this.adminCrmService.findAll();
  }

  @Get('leads/:id')
  @ApiOperation({ summary: 'Get a lead with its call activity' })
  findOne(@Param('id') id: string) {
    return this.adminCrmService.findOne(id);
  }

  @Put('leads/:id')
  @ApiOperation({ summary: 'Update lead status / notes / follow-up' })
  update(@Param('id') id: string, @Body() dto: UpdateAdminLeadDto) {
    return this.adminCrmService.update(id, dto);
  }

  @Post('leads/:id/call')
  @ApiOperation({ summary: 'Log a call against a lead' })
  logCall(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: LogAdminCallDto) {
    return this.adminCrmService.logCall(id, user.email, dto);
  }
}
