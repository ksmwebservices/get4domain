import { Body, Controller, Get, HttpCode, Param, Patch, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { actorOf } from '../../plans/admin/plans-admin.common';
import { ActivityService, AlertsService } from '../activity.service';
import { ActivityPageDto, AlertListDto, UpdateAlertDto, UpdateAlertRuleDto } from './dto/activity.dto';

const page = (q: ActivityPageDto): { page: number; pageSize: number } => ({ page: q.page ?? 1, pageSize: q.pageSize ?? 25 });
const id64 = (v: string): string => String(v).slice(0, 64);

/** The signed-in OWNER reads their own activity. The vendor is ALWAYS the verified principal's vendor. OWNER ONLY: the rows describe money and the business's public face. The address hash is never returned. */
@ApiTags('v3-activity')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me')
export class MeActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('activity') @ApiOperation({ summary: 'What was done on my account (mine only, newest first, paged). Personal data is masked and secrets are never stored.' })
  mine(@Tenant() t: TenantContext, @Query() q: ActivityPageDto) { const p = page(q); return this.activity.myActivity(t.vendorId, p.page, p.pageSize); }
}

/**
 * Staff side of the alerts. OPERATIONS and SUPER_ADMIN read and work alerts (MARKETING refused: alerts and activity describe money and personal data); only SUPER_ADMIN changes the rules.
 * An alert is a notice raised after the event: nothing here hides, deletes or freezes anything.
 */
@ApiTags('v3-alerts-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminAlertsController {
  constructor(private readonly alerts: AlertsService, private readonly activity: ActivityService) {}

  @Get('alerts') @ApiOperation({ summary: 'Alerts, newest first, filtered by level, status, vendor or owner' })
  list(@Query() q: AlertListDto) { const p = page(q); return this.alerts.list({ level: q.level, status: q.status, vendorId: q.vendorId, ownerStaffId: q.owner }, p.page, p.pageSize); }

  @Get('alerts/:id') @ApiOperation({ summary: 'One alert with the activity rows behind it' })
  detail(@Param('id') id: string) { return this.alerts.detail(id64(id)); }

  @Patch('alerts/:id') @HttpCode(200) @ApiOperation({ summary: 'Change an alert\'s status, owner or note (refused if the alert changed since it was read). Changes nothing else.' })
  update(@Param('id') id: string, @Body() dto: UpdateAlertDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) {
    const by = actorOf(u, req);
    return this.alerts.update(id64(id), by, { expectedStatus: dto.expectedStatus, status: dto.status, ownerStaffId: dto.ownerStaffId, note: dto.note });
  }

  @Get('alert-rules') @ApiOperation({ summary: 'The alert rules with their levels, numbers, roles and on switch' })
  rules() { return this.alerts.rules(); }

  @Put('alert-rules') @HttpCode(200) @ApiOperation({ summary: 'Set one rule\'s numbers, roles or on switch (the key and the level are fixed). A rule that needs numbers cannot be switched on without them.' })
  updateRule(@Body() dto: UpdateAlertRuleDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) {
    return this.alerts.updateRule(dto.key, actorOf(u, req), { enabled: dto.enabled, thresholdJson: dto.thresholdJson, notifyRoles: dto.notifyRoles });
  }

  @Get('vendors/:vendorId/activity') @ApiOperation({ summary: 'One vendor\'s activity, newest first, paged (masked)' })
  vendorActivity(@Param('vendorId') vendorId: string, @Query() q: ActivityPageDto) { const p = page(q); return this.activity.vendorActivity(id64(vendorId), p.page, p.pageSize); }

  @Get('attention') @ApiOperation({ summary: 'Counts for the staff board: new alerts per role and level, unread notices, and the queues that wait for our team' })
  attention() { return this.alerts.attention(); }
}
