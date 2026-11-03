import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateFeatureDto, CreatePlanDto, CreatePriceDto, SaveMatrixDto, UpdateFeatureDto, UpdatePlanDto, UpdatePriceDto } from './dto/plans-admin.dto';
import { FeaturesAdminService } from './features-admin.service';
import { actorOf, PageQueryDto } from './plans-admin.common';
import { PlansAdminService } from './plans-admin.service';

/**
 * Staff API for plans, prices, features and the plan-feature matrix. HTTP only: the rules live in the services.
 * Reads: SUPER_ADMIN and OPERATIONS. Every write: SUPER_ADMIN only (auth/guards/admin-role-matrix.ts), and every write writes g4d_audit_logs.
 */
@ApiTags('v3-plans-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class PlansAdminController {
  constructor(private readonly plans: PlansAdminService, private readonly features: FeaturesAdminService) {}

  // ---- plans
  @Get('plans') @ApiOperation({ summary: 'List plans (paginated)' })
  listPlans(@Query() q: PageQueryDto) { return this.plans.listPlans(q); }

  @Get('plans/:id') @ApiOperation({ summary: 'One plan with its prices and feature rows' })
  getPlan(@Param('id') id: string) { return this.plans.getPlan(id); }

  @Post('plans') @ApiOperation({ summary: 'Create a plan (SUPER_ADMIN)' })
  createPlan(@Body() dto: CreatePlanDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.plans.createPlan(dto, actorOf(user, req)); }

  @Put('plans/:id') @ApiOperation({ summary: 'Update a plan; needs expectedUpdatedAt (SUPER_ADMIN)' })
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.plans.updatePlan(id, dto, actorOf(user, req)); }

  @Delete('plans/:id') @ApiOperation({ summary: 'Delete an unused plan; a plan in use can only be retired (SUPER_ADMIN)' })
  deletePlan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.plans.deletePlan(id, actorOf(user, req)); }

  // ---- prices
  @Get('plans/:id/prices') @ApiOperation({ summary: 'Price rows of a plan (paginated)' })
  listPrices(@Param('id') id: string, @Query() q: PageQueryDto) { return this.plans.listPrices(id, q); }

  @Post('plans/:id/prices') @ApiOperation({ summary: 'Add a price row for a term (SUPER_ADMIN)' })
  createPrice(@Param('id') id: string, @Body() dto: CreatePriceDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.plans.createPrice(id, dto, actorOf(user, req)); }

  @Put('prices/:priceId') @ApiOperation({ summary: 'Change a price row; needs expectedUpdatedAt (SUPER_ADMIN)' })
  updatePrice(@Param('priceId') priceId: string, @Body() dto: UpdatePriceDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.plans.updatePrice(priceId, dto, actorOf(user, req)); }

  @Delete('prices/:priceId') @ApiOperation({ summary: 'Delete a price row (SUPER_ADMIN)' })
  deletePrice(@Param('priceId') priceId: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.plans.deletePrice(priceId, actorOf(user, req)); }

  // ---- features
  @Get('features') @ApiOperation({ summary: 'The feature catalogue (paginated)' })
  listFeatures(@Query() q: PageQueryDto) { return this.features.listFeatures(q); }

  @Post('features') @ApiOperation({ summary: 'Add a feature (SUPER_ADMIN)' })
  createFeature(@Body() dto: CreateFeatureDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.features.createFeature(dto, actorOf(user, req)); }

  @Put('features/:key') @ApiOperation({ summary: 'Change a feature; needs expectedUpdatedAt (SUPER_ADMIN)' })
  updateFeature(@Param('key') key: string, @Body() dto: UpdateFeatureDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.features.updateFeature(key, dto, actorOf(user, req)); }

  @Delete('features/:key') @ApiOperation({ summary: 'Delete an unused feature (SUPER_ADMIN)' })
  deleteFeature(@Param('key') key: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.features.deleteFeature(key, actorOf(user, req)); }

  // ---- matrix
  @Get('plans/:id/features') @ApiOperation({ summary: 'The feature rows of one plan' })
  getPlanFeatures(@Param('id') id: string) { return this.features.getPlanFeatures(id); }

  @Put('plans/:id/features') @ApiOperation({ summary: 'Save feature rows of a plan in one transaction; needs the plan\'s expectedUpdatedAt (SUPER_ADMIN)' })
  savePlanFeatures(@Param('id') id: string, @Body() dto: SaveMatrixDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.features.savePlanFeatures(id, dto, actorOf(user, req)); }
}
