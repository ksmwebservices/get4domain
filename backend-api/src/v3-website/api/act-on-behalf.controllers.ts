import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { PageQueryDto, pageArgs } from '../../plans/admin/plans-admin.common';
import { ActOnBehalfService, StaffRef } from '../act-on-behalf/act-on-behalf.service';
import { QUEUE_KINDS, QueueKind } from '../onboarding/onboarding-core';
import { OnboardingQueueService } from '../onboarding/onboarding-queue.service';

export class StartSessionDto { @IsString() @MaxLength(600) reason!: string; }
export class SessionListQuery extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @IsIn(['true', 'false']) active?: string;
}
export class QueueQuery extends PageQueryDto { @IsOptional() @IsIn(QUEUE_KINDS as unknown as string[]) kind?: QueueKind; }

const staffOf = (user: AuthenticatedUser): StaffRef => ({ id: user.sub, role: user.adminRole ?? 'OPERATIONS' });

/**
 * Staff side of acting on behalf (slice 5.13b) and the onboarding queue. Role matrix: OPERATIONS and SUPER_ADMIN (the stage file names Website Developer and Customer Support, roles that do not exist
 * here: OPEN QUESTIONS); MARKETING is refused. Inside a session the staff member sends the session id in the `x-act-on-behalf-session` header on `/v3/admin/vendors/:id/...` routes.
 */
@ApiTags('v3-act-on-behalf-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminActOnBehalfController {
  constructor(private readonly sessions: ActOnBehalfService, private readonly queue: OnboardingQueueService) {}

  @Post('vendors/:id/act-on-behalf') @HttpCode(200)
  @ApiOperation({ summary: 'Start a session to act on behalf of a vendor: a reason is required, the vendor is told, and it ends by itself after the staff setting' })
  start(@Param('id') id: string, @Body() dto: StartSessionDto, @CurrentUser() user: AuthenticatedUser) { return this.sessions.start(staffOf(user), id, dto.reason); }

  @Post('act-on-behalf/:sessionId/end') @HttpCode(200)
  @ApiOperation({ summary: 'End a session (your own; SUPER_ADMIN may end any)' })
  end(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthenticatedUser) { return this.sessions.end(staffOf(user), sessionId); }

  @Get('act-on-behalf')
  @ApiOperation({ summary: 'Sessions, newest first (filter by vendor and by live or ended)' })
  list(@Query() q: SessionListQuery) { const { page, pageSize } = pageArgs(q); return this.sessions.listForStaff({ vendorId: q.vendorId, active: q.active === undefined ? undefined : q.active === 'true', page, pageSize }); }

  @Get('onboarding-queue')
  @ApiOperation({ summary: 'Who is waiting to be onboarded: seeded sites, claim links and new vendors, oldest wait first (a read model over the existing tables)' })
  onboarding(@Query() q: QueueQuery, @Req() _req: Request) { const { page, pageSize } = pageArgs(q); return this.queue.list({ page, pageSize, kind: q.kind }, new Date()); }
}

/** The vendor sees when staff acted on its behalf, and why. Never which staff member. */
@ApiTags('v3-act-on-behalf')
@ApiBearerAuth()
@UseTenant()
@Controller('v3/me/act-on-behalf')
export class MeActOnBehalfController {
  constructor(private readonly sessions: ActOnBehalfService) {}

  @Get()
  @ApiOperation({ summary: 'Times when the Get4Domain team acted on my behalf, with the reason' })
  mine(@Tenant() t: TenantContext) { return this.sessions.listForVendor(t.vendorId); }
}
