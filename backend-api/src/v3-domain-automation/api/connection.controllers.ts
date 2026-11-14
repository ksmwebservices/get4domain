import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { RequiresTab } from '../../v3-packs/requires-tab';
import { RATE } from '../../common/throttling';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { Actor } from '../../plans/admin/audit.service';
import { PageQueryDto, pageArgs } from '../../plans/admin/plans-admin.common';
import { DomainConnectionService } from '../connection.service';
import { DomainLogService } from '../domain-log';
import { ConnectionMode, ConnectionStatus } from '../core/connection-core';

export class BeginConnectionDto {
  @IsOptional() @IsIn(['CONNECT', 'FORWARD']) mode?: ConnectionMode;
  @IsOptional() @IsString() @MaxLength(20) registrar?: string;
}
export class ConnectionModeDto { @IsIn(['CONNECT', 'FORWARD']) mode!: ConnectionMode; }
export class GuideQuery { @IsOptional() @IsString() @MaxLength(20) registrar?: string; }
export class ConnectionListQuery extends PageQueryDto { @IsOptional() @IsIn(['PENDING', 'VERIFYING', 'ACTIVE', 'NEEDS_ATTENTION', 'LAPSED']) status?: ConnectionStatus; }

const actor = (user: AuthenticatedUser, req: Request, type: 'VENDOR' | 'STAFF'): Actor => ({ type, id: user?.sub ?? null, ip: req?.ip ?? null });

/** The signed-in vendor's own connections. The vendor is ALWAYS the verified principal's vendor (@UseTenant); another vendor's domain id answers like one that does not exist. OWNER ONLY. */
@ApiTags('v3-domain-connection')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@RequiresTab('domain', { previewReads: true })   // reads keep a locked preview; connect, check, mode, retry and remove are refused with TAB_LOCKED on a Free or paused plan (Amendment 11 Q2, Amendment 13 B11)
@Controller('v3/me/domains')
export class MeConnectionController {
  constructor(private readonly svc: DomainConnectionService) {}

  @Get('connections')
  @ApiOperation({ summary: 'My automatic connections, with status, certificate state and mode' })
  list(@Tenant() t: TenantContext) { return this.svc.listForVendor(t.vendorId); }

  @Get(':id/connection-guide')
  @ApiOperation({ summary: 'The records to create (type, host, value), the steps for my registrar, the bare-domain explanation and the connection so far' })
  guide(@Tenant() t: TenantContext, @Param('id') id: string, @Query() q: GuideQuery) { return this.svc.guide(t.vendorId, id, q.registrar); }

  @Get(':id/connection')
  @ApiOperation({ summary: 'The connection of one of my domains' })
  one(@Tenant() t: TenantContext, @Param('id') id: string) { return this.svc.get(t.vendorId, id); }

  @Post(':id/connection') @HttpCode(200)
  @ApiOperation({ summary: 'Start connecting my verified domain (connect or forward); Pro only' })
  begin(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: BeginConnectionDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.svc.begin(t.vendorId, id, dto, actor(user, req, 'VENDOR')); }

  @Throttle(RATE.domainVerify)
  @Post(':id/connection/check') @HttpCode(200)
  @ApiOperation({ summary: 'Check the connection now (certificate state); rate limited' })
  check(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.svc.check(t.vendorId, id, actor(user, req, 'VENDOR')); }

  @Put(':id/connection/mode') @HttpCode(200)
  @ApiOperation({ summary: 'Switch between connect (my host serves the site) and forward (my host redirects to my Get4Domain address)' })
  mode(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: ConnectionModeDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.svc.setMode(t.vendorId, id, dto.mode, actor(user, req, 'VENDOR')); }

  @Post(':id/connection/retry') @HttpCode(200)
  @ApiOperation({ summary: 'Try again after a connection needed attention' })
  retry(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.svc.retry(t.vendorId, id, actor(user, req, 'VENDOR')); }

  @Delete(':id/connection')
  @ApiOperation({ summary: 'Stop the automatic connection (the domain stays mine)' })
  end(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.svc.disconnect(t.vendorId, id, actor(user, req, 'VENDOR')); }
}

/** Staff: OPERATIONS and SUPER_ADMIN (MARKETING refused: a domain log names who acted). */
@ApiTags('v3-domain-connection-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminConnectionController {
  constructor(private readonly svc: DomainConnectionService, private readonly log: DomainLogService) {}

  @Get('domain-connections')
  @ApiOperation({ summary: 'Connections of every vendor, newest change first; filter by status' })
  list(@Query() q: ConnectionListQuery) { const p = pageArgs(q); return this.svc.listForStaff({ status: q.status, skip: p.skip, take: p.take }); }

  @Post('vendors/:id/domains/:domainId/connection/retry') @HttpCode(200)
  @ApiOperation({ summary: 'Try a vendor\'s connection again after it needed attention' })
  retry(@Param('id') id: string, @Param('domainId') domainId: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.svc.retry(id, domainId, actor(user, req, 'STAFF')); }

  @Get('vendors/:id/domain-log')
  @ApiOperation({ summary: 'The domain log of one vendor: domain events with time and actor, newest first' })
  domainLog(@Param('id') id: string, @Query() q: PageQueryDto) { const p = pageArgs(q); return this.log.forVendor(id, p.page, p.pageSize); }
}
