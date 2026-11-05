import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { RATE } from '../../common/throttling';
import { actorOf } from '../../plans/admin/plans-admin.common';
import { ThemeSwitchService } from '../theme-switch.service';
import { HistoryPageDto, PreviewThemeDto, RecoverSwitchesDto, StaffSwitchThemeDto, SwitchThemeDto } from './dto/theme-switch.dto';

const page = (q: HistoryPageDto): { page: number; pageSize: number } => ({ page: q.page ?? 1, pageSize: q.pageSize ?? 25 });

/**
 * The signed-in OWNER switches their own theme. The vendor is ALWAYS the verified principal's vendor. OWNER ONLY: a switch can cost money and changes what the public sees. The preview is free and stores
 * nothing. No admin approval is needed; every switch is recorded and staff can review it.
 */
@ApiTags('v3-theme-switch')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/site/theme')
export class MeThemeSwitchController {
  constructor(private readonly themes: ThemeSwitchService) {}

  @Throttle(RATE.payment) @Post('preview') @HttpCode(200)
  @ApiOperation({ summary: 'See another theme drawn with your own content, free. Stores nothing. Also says what the switch would cost (the included switch, or the approved fee with tax) before you confirm.' })
  preview(@Tenant() t: TenantContext, @Body() dto: PreviewThemeDto) { return this.themes.preview(t.vendorId, dto.themeId); }

  @Throttle(RATE.payment) @Post('switch') @HttpCode(200)
  @ApiOperation({ summary: 'Switch to another theme (idempotent by key). The first switch is included in Pro; later ones are charged to the wallet. Applied as a new publication, so you can roll back.' })
  switch(@Tenant() t: TenantContext, @Body() dto: SwitchThemeDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.themes.switchTheme(t.vendorId, dto, { type: 'VENDOR', actor: { type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null }, funding: 'WALLET' });
  }

  @Get('history') @ApiOperation({ summary: 'My theme switches, newest first' })
  history(@Tenant() t: TenantContext, @Query() q: HistoryPageDto) { const p = page(q); return this.themes.history(t.vendorId, p.page, p.pageSize); }
}

/**
 * Staff side. OPERATIONS and SUPER_ADMIN (MARKETING refused). A switch for a vendor charges their wallet by the same rules, or is marked complimentary with a reason, or is carried by the vendor's own service
 * request; it is audited and appears in the vendor's history as done by our team.
 */
@ApiTags('v3-theme-switch-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminThemeSwitchController {
  constructor(private readonly themes: ThemeSwitchService) {}

  @Post('vendors/:vendorId/site/theme/switch') @HttpCode(200)
  @ApiOperation({ summary: 'Switch a vendor\'s theme for them: charged to their wallet, complimentary (a reason is recorded), or carried by their service request' })
  switch(@Param('vendorId') vendorId: string, @Body() dto: StaffSwitchThemeDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) {
    return this.themes.switchTheme(String(vendorId).slice(0, 64), dto, { type: 'STAFF', actor: actorOf(u, req), funding: dto.funding, reason: dto.reason, serviceRequestId: dto.serviceRequestId });
  }

  @Get('vendors/:vendorId/site/theme/history') @ApiOperation({ summary: 'A vendor\'s theme switches with who did them, what was charged and why' })
  history(@Param('vendorId') vendorId: string, @Query() q: HistoryPageDto) { const p = page(q); return this.themes.adminHistory(String(vendorId).slice(0, 64), p.page, p.pageSize); }

  @Post('theme-switches/recover') @HttpCode(200)
  @ApiOperation({ summary: 'Settle switches left PENDING by a crash: applied if the site really shows the new theme, otherwise undone and any charge reversed' })
  recover(@Body() dto: RecoverSwitchesDto) { return this.themes.recoverStale(dto.olderThanMinutes); }
}
