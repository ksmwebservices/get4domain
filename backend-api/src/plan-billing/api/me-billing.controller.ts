import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { RATE } from '../../common/throttling';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { Actor } from '../../plans/admin/audit.service';
import { PlanOrderService } from '../plan-order.service';
import { ConfirmOrderDto, CreateOrderDto, PageDto } from './dto/billing.dto';

/**
 * The signed-in owner buys and renews a plan. The vendor is ALWAYS the verified principal's vendor (@UseTenant): never in the URL, query or body. OWNER ONLY (a team member cannot start a
 * payment). Creating an order or confirming a payment never activates a plan by itself: the settlement does, after the provider has been asked.
 */
@ApiTags('v3-billing')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/billing')
export class MeBillingController {
  constructor(private readonly orders: PlanOrderService) {}
  private actor(user: AuthenticatedUser, req: Request): Actor { return { type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null }; }

  @Throttle(RATE.payment) @Post('orders') @HttpCode(200)
  @ApiOperation({ summary: 'Start buying or renewing a Pro plan for 3, 6 or 12 months (idempotent by key). Returns the quote and the provider order for the checkout.' })
  create(@Tenant() t: TenantContext, @Body() dto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.orders.create(t.vendorId, dto, this.actor(user, req)); }

  @Throttle(RATE.payment) @Post('orders/:id/confirm') @HttpCode(200)
  @ApiOperation({ summary: 'Tell us the checkout finished. The signature is checked and the payment provider is asked; the plan is activated only if it really paid the exact amount.' })
  confirm(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: ConfirmOrderDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.orders.confirm(t.vendorId, id, dto, this.actor(user, req)); }

  @Get('orders') @ApiOperation({ summary: 'My orders, newest first' })
  async list(@Tenant() t: TenantContext, @Query() q: PageDto) { const page = q.page ?? 1; const pageSize = q.pageSize ?? 25; const r = await this.orders.listMine(t.vendorId, page, pageSize); return { items: r.items, page, pageSize, total: r.total }; }

  @Get('invoices') @ApiOperation({ summary: 'My plan invoices, newest first' })
  async invoices(@Tenant() t: TenantContext, @Query() q: PageDto) { const page = q.page ?? 1; const pageSize = q.pageSize ?? 25; const r = await this.orders.invoicesMine(t.vendorId, page, pageSize); return { items: r.items, page, pageSize, total: r.total }; }
}
