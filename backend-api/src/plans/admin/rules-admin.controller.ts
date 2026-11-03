import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from './audit.service';
import { CreateDiscountRuleDto, CreateTaxRateDto, PutPlanSettingDto, UpdateDiscountRuleDto, UpdateTaxRateDto } from './dto/plans-admin.dto';
import { actorOf, PageQueryDto } from './plans-admin.common';
import { RulesAdminService } from './rules-admin.service';

/** Staff API for tax rates, discount rules, plan settings and the audit log. Reads: SUPER_ADMIN and OPERATIONS. Writes: SUPER_ADMIN only. */
@ApiTags('v3-plans-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class RulesAdminController {
  constructor(private readonly rules: RulesAdminService, private readonly audit: AuditService) {}

  @Get('tax-rates') @ApiOperation({ summary: 'Tax rates (paginated)' })
  listTax(@Query() q: PageQueryDto) { return this.rules.listTaxRates(q); }

  @Post('tax-rates') @ApiOperation({ summary: 'Add a tax rate (SUPER_ADMIN)' })
  createTax(@Body() dto: CreateTaxRateDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.rules.createTaxRate(dto, actorOf(user, req)); }

  @Put('tax-rates/:id') @ApiOperation({ summary: 'Change a tax rate; needs expectedUpdatedAt (SUPER_ADMIN)' })
  updateTax(@Param('id') id: string, @Body() dto: UpdateTaxRateDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.rules.updateTaxRate(id, dto, actorOf(user, req)); }

  @Delete('tax-rates/:id') @ApiOperation({ summary: 'Delete a tax rate (SUPER_ADMIN)' })
  deleteTax(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.rules.deleteTaxRate(id, actorOf(user, req)); }

  @Get('discount-rules') @ApiOperation({ summary: 'Discount rules (paginated)' })
  listDiscounts(@Query() q: PageQueryDto) { return this.rules.listDiscountRules(q); }

  @Post('discount-rules') @ApiOperation({ summary: 'Add a discount rule (SUPER_ADMIN)' })
  createDiscount(@Body() dto: CreateDiscountRuleDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.rules.createDiscountRule(dto, actorOf(user, req)); }

  @Put('discount-rules/:id') @ApiOperation({ summary: 'Change a discount rule; needs expectedUpdatedAt (SUPER_ADMIN)' })
  updateDiscount(@Param('id') id: string, @Body() dto: UpdateDiscountRuleDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.rules.updateDiscountRule(id, dto, actorOf(user, req)); }

  @Delete('discount-rules/:id') @ApiOperation({ summary: 'Delete a discount rule (SUPER_ADMIN)' })
  deleteDiscount(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.rules.deleteDiscountRule(id, actorOf(user, req)); }

  @Get('plan-settings') @ApiOperation({ summary: 'Plan settings (grace days, monthly switch, downgrade behaviour, base rates...)' })
  listSettings(@Query() q: PageQueryDto) { return this.rules.listSettings(q); }

  @Put('plan-settings/:key') @ApiOperation({ summary: 'Set one plan setting (SUPER_ADMIN)' })
  putSetting(@Param('key') key: string, @Body() dto: PutPlanSettingDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.rules.putSetting(key, dto, actorOf(user, req)); }

  @Get('audit-logs') @ApiOperation({ summary: 'The change log of this area (paginated, filter by entityType and entityId)' })
  listAudit(@Query() q: PageQueryDto) { return this.audit.list(q); }
}
