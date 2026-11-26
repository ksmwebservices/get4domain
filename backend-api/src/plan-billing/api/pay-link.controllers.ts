import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
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
import { PlanPayLinkService } from '../pay-link/plan-pay-link.service';
import { CreateOrderDto } from './dto/billing.dto';

/** E11e, the vendor's side: a payment link for their own plan, to open or to share. OWNER ONLY, like every payment. The vendor is always the signed-in one. */
@ApiTags('v3-billing')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/billing')
export class MePayLinkController {
  constructor(private readonly links: PlanPayLinkService) {}

  @Throttle(RATE.payment) @Post('pay-links') @HttpCode(200)
  @ApiOperation({ summary: 'A shareable payment link for a Pro plan (3, 6 or 12 months) at the server price. Test mode only, and off until staff switch it on. An open link for the same purchase is returned again.' })
  create(@Tenant() t: TenantContext, @Body() dto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.links.create(t.vendorId, dto, { type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null });
  }
}

/** E11e, the office's side: ADMIN and SUPER_ADMIN make a link for a business and share it (a telecaller uses /v3/admin/telecaller/vendors/:id/pay-links). */
@ApiTags('v3-billing-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/billing')
export class AdminPayLinkController {
  constructor(private readonly links: PlanPayLinkService) {}

  @Throttle(RATE.payment) @Post('vendors/:vendorId/pay-links') @HttpCode(200)
  @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN, audited: a payment link for a business at the server price. Test mode only. A payment on it makes the same invoice, plan start and commission as checkout and cash.' })
  create(@Param('vendorId') vendorId: string, @Body() dto: CreateOrderDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) {
    return this.links.create(String(vendorId).slice(0, 64), dto, actorOf(u, req));
  }
}
