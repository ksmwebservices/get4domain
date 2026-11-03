import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssignSubscriptionDto, CreateOverrideDto, SetFlagDto, UpdateOverrideDto } from './dto/plans-admin.dto';
import { actorOf, PageQueryDto } from './plans-admin.common';
import { VendorPlansAdminService } from './vendor-plans-admin.service';

/** Staff API for one vendor's plan: assignment, entitlements, overrides, the v3_plans flag. Reads: SUPER_ADMIN and OPERATIONS. Writes: SUPER_ADMIN only. */
@ApiTags('v3-plans-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class VendorPlansAdminController {
  constructor(private readonly vendors: VendorPlansAdminService) {}

  @Get('vendors/:id/subscription') @ApiOperation({ summary: 'The vendor\'s current subscription, history and events' })
  getSubscription(@Param('id') id: string) { return this.vendors.getSubscription(id); }

  @Post('vendors/:id/subscription') @ApiOperation({ summary: 'Assign a plan to a vendor (staff assignment; reason required) (SUPER_ADMIN)' })
  assign(@Param('id') id: string, @Body() dto: AssignSubscriptionDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.vendors.assign(id, dto, actorOf(user, req)); }

  @Get('vendors/:id/entitlements') @ApiOperation({ summary: 'What this vendor resolves to now, and why, per feature' })
  getEntitlements(@Param('id') id: string) { return this.vendors.getEntitlements(id); }

  @Get('vendors/:id/overrides') @ApiOperation({ summary: 'A vendor\'s entitlement overrides (paginated)' })
  listOverrides(@Param('id') id: string, @Query() q: PageQueryDto) { return this.vendors.listOverrides(id, q); }

  @Post('vendors/:id/overrides') @ApiOperation({ summary: 'Give a vendor a feature override (reason required, optional expiry) (SUPER_ADMIN)' })
  createOverride(@Param('id') id: string, @Body() dto: CreateOverrideDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.vendors.createOverride(id, dto, actorOf(user, req)); }

  @Put('overrides/:overrideId') @ApiOperation({ summary: 'Change an override; needs expectedUpdatedAt (SUPER_ADMIN)' })
  updateOverride(@Param('overrideId') overrideId: string, @Body() dto: UpdateOverrideDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.vendors.updateOverride(overrideId, dto, actorOf(user, req)); }

  @Delete('overrides/:overrideId') @ApiOperation({ summary: 'End an override now (it is expired, not erased) (SUPER_ADMIN)' })
  expireOverride(@Param('overrideId') overrideId: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.vendors.expireOverride(overrideId, actorOf(user, req)); }

  @Put('vendors/:id/flags/v3_plans') @ApiOperation({ summary: 'Switch the v3_plans flag for one vendor (SUPER_ADMIN)' })
  setFlag(@Param('id') id: string, @Body() dto: SetFlagDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.vendors.setFlag(id, dto.enabled, actorOf(user, req)); }
}
