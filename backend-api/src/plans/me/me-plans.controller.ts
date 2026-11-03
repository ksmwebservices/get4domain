import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { PageQueryDto } from '../admin/plans-admin.common';
import { MePlansService } from './me-plans.service';

/**
 * The signed-in vendor's plan. The vendor is ALWAYS the verified principal's vendor (@UseTenant): there is no vendor id in the URL, query or body, so one
 * vendor cannot read another's. Entitlements are open to team members (the screens need them to lock features); the subscription and its events show
 * what the vendor pays and when it ends, so they are owner-only (a team member is refused).
 */
@ApiTags('v3-me')
@ApiBearerAuth()
@UseTenant()
@Controller('v3/me')
export class MePlansController {
  constructor(private readonly me: MePlansService) {}

  @Get('entitlements')
  @ApiOperation({ summary: 'What my plan gives: every feature with its state, limit and upsell text, and the four theme-kit booleans' })
  entitlements(@Tenant() tenant: TenantContext) {
    return this.me.entitlements(tenant.vendorId);
  }

  @UseGuards(VendorOwnerGuard)
  @Get('subscription')
  @ApiOperation({ summary: 'My current subscription (owner only); subscription null with the mode when I have none' })
  subscription(@Tenant() tenant: TenantContext) {
    return this.me.subscription(tenant.vendorId);
  }

  @UseGuards(VendorOwnerGuard)
  @Get('subscription/events')
  @ApiOperation({ summary: 'The history of my plan changes (owner only, paginated)' })
  events(@Tenant() tenant: TenantContext, @Query() q: PageQueryDto) {
    return this.me.events(tenant.vendorId, q);
  }
}
