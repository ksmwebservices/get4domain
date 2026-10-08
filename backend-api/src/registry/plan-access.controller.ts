import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CommercialAdminGuard, actorOf } from '../commercial/foundation.services';
import { PlanAccessRow, PlanAccessService, VendorPlanAccess } from './plan-access.service';

export class PlanAccessExceptionDto {
  @IsIn(['module', 'addon']) kind!: 'module' | 'addon';
  @IsString() @MinLength(1) @MaxLength(60) key!: string;
  @IsBoolean() enabled!: boolean;
  @IsString() @MinLength(10) @MaxLength(300) reason!: string;
}

// Platform admins only; the MARKETING staff role is refused by CommercialAdminGuard (plan access is commercial).
@ApiTags('admin-plan-access')
@ApiBearerAuth()
@UseGuards(CommercialAdminGuard)
@Controller('admin/plan-access')
export class PlanAccessController {
  constructor(private readonly access: PlanAccessService) {}

  @Get('map')
  @ApiOperation({ summary: 'Module-to-plan map, read from the feature registry (platform admin)' })
  map(): PlanAccessRow[] { return this.access.map(); }

  @Get('vendors')
  @ApiOperation({ summary: 'Find vendors by name or subdomain, with plan and Dashboard v2 switch (platform admin)' })
  vendors(@Query('q') q?: string) { return this.access.searchVendors(q); }

  @Get('vendors/:vendorId')
  @ApiOperation({ summary: "One vendor's plan, modules, add-ons, pending grants and exception history (platform admin)" })
  vendor(@Param('vendorId') vendorId: string): Promise<VendorPlanAccess> { return this.access.forVendor(vendorId); }

  @Post('vendors/:vendorId/exception')
  @ApiOperation({ summary: 'Switch one module or add-on on/off for one vendor, with a reason (audited) (platform admin)' })
  exception(@Param('vendorId') vendorId: string, @Body() dto: PlanAccessExceptionDto, @CurrentUser() u: AuthenticatedUser): Promise<VendorPlanAccess> {
    return this.access.setException(vendorId, dto, actorOf(u));
  }

  @Post('vendors/:vendorId/provision')
  @ApiOperation({ summary: "Grant every module the vendor's current plan includes, now (idempotent, grant-only) (platform admin)" })
  provision(@Param('vendorId') vendorId: string, @CurrentUser() u: AuthenticatedUser): Promise<VendorPlanAccess> {
    return this.access.provisionNow(vendorId, actorOf(u));
  }
}
