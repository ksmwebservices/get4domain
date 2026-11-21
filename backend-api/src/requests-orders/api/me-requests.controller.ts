import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { Actor } from '../../plans/admin/audit.service';
import { pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { RequiresFeature } from '../../plans/entitlements/requires-feature.decorator';
import { RequestKind, RequestStatus } from '../core/requests-core';
import { VendorRequestsService } from '../vendor-requests.service';
import { InboxQueryDto, LinkDto, OfferDto, OfferUpdateDto, OrderListDto, OrderStatusDto, PageDto, PaymentMethodDto, PaymentMethodUpdateDto, RefundDto, RespondDto, StockDto, VoidDto } from './dto/requests.dto';

const actor = (u: AuthenticatedUser, req: Request): Actor => ({ type: 'VENDOR', id: u?.sub ?? null, ip: req?.ip ?? null });

/**
 * The vendor's inbox, replies, orders, offers and stock. The vendor is ALWAYS the verified principal's vendor (@UseTenant): no vendor id in the URL, query or body. A team member needs the
 * `website` area. A Free vendor is refused here (FEATURE_LOCKED with the upsell): a Free site receives no requests, orders or leads, so there is nothing to read or change.
 */
@ApiTags('v3-requests-me')
@ApiBearerAuth()
@UseTenant()
@RequireModule('website')
@RequiresFeature('requests.inbox')
@Controller('v3/me')
export class MeRequestsController {
  constructor(private readonly vendor: VendorRequestsService) {}

  @Get('requests') @ApiOperation({ summary: 'My inbox: requests with filters, and the response-time summary' })
  inbox(@Tenant() t: TenantContext, @Query() q: InboxQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    return this.vendor.inbox(t.vendorId, { status: q.status as RequestStatus, kind: q.kind as RequestKind, q: q.q, from: q.from ? new Date(q.from) : undefined, to: q.to ? new Date(q.to) : undefined, skip, take }).then((r) => ({ ...paged(r.items, r.total, page, pageSize), summary: r.summary }));
  }

  @Get('requests/:id') @ApiOperation({ summary: 'One request with its events; reading it the first time marks it seen' })
  one(@Tenant() t: TenantContext, @Param('id') id: string) { return this.vendor.open(t.vendorId, id); }

  @Post('requests/:id/respond') @HttpCode(200) @ApiOperation({ summary: 'Reply to the customer and/or move the request on; the customer is told (sandbox)' })
  respond(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: RespondDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.vendor.respond(t.vendorId, id, { status: dto.status as RequestStatus, message: dto.message }, actor(u, req)); }

  @Post('requests/:id/link') @HttpCode(200) @ApiOperation({ summary: 'Record the customer and booking ids this request became (the CRM and booking modules arrive later; only the ids are stored)' })
  link(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: LinkDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.vendor.link(t.vendorId, id, dto, actor(u, req)); }

  @Get('orders') @ApiOperation({ summary: 'My orders' })
  async orders(@Tenant() t: TenantContext, @Query() q: OrderListDto) { const { skip, take, page, pageSize } = pageArgs(q); const r = await this.vendor.orders(t.vendorId, { status: q.status, skip, take }); return paged(r.items, r.total, page, pageSize); }

  @Get('orders/:id') @ApiOperation({ summary: 'One order with its items' })
  order(@Tenant() t: TenantContext, @Param('id') id: string) { return this.vendor.order(t.vendorId, id); }

  @Put('orders/:id/status') @HttpCode(200) @ApiOperation({ summary: 'Packed, shipped (with tracking), delivered, cancelled, returned. PAID only for an order paid outside the vendor gateway.' })
  status(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: OrderStatusDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.vendor.updateOrder(t.vendorId, id, { status: dto.status, tracking: dto.tracking }, actor(u, req)); }

  @Put('stock/:productRef') @HttpCode(200) @ApiOperation({ summary: 'Set the stock on hand of a product (a product with no stock row is not tracked)' })
  stock(@Tenant() t: TenantContext, @Param('productRef') productRef: string, @Body() dto: StockDto) { return this.vendor.setStock(t.vendorId, productRef, dto.onHand); }
}

/** Offers and coupons: their own plan feature (offers.banners). */
@ApiTags('v3-offers-me')
@ApiBearerAuth()
@UseTenant()
@RequireModule('website')
@RequiresFeature('offers.banners')
@Controller('v3/me/offers')
export class MeOffersController {
  constructor(private readonly vendor: VendorRequestsService) {}
  @Get() @ApiOperation({ summary: 'My offers and coupons' }) list(@Tenant() t: TenantContext) { return this.vendor.offers(t.vendorId); }
  @Post() @HttpCode(200) @ApiOperation({ summary: 'Create a banner or a coupon (percentage or flat amount in paise, optional dates, minimum order and usage limit)' })
  create(@Tenant() t: TenantContext, @Body() dto: OfferDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.vendor.createOffer(t.vendorId, dto, actor(u, req)); }
  @Put(':id') @HttpCode(200) @ApiOperation({ summary: 'Change an offer or pause or end it' })
  update(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: OfferUpdateDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.vendor.updateOffer(t.vendorId, id, dto, actor(u, req)); }
}

/**
 * Money and credentials: payment methods (the gateway key, UPI address and webhook secret are WRITE-ONLY and sealed), refunds (a recorded fact only), and the vendor's own invoices.
 * OWNER ONLY, like every other route that touches payment credentials. Needs the plan feature payments.vendor_methods.
 */
@ApiTags('v3-payments-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@RequiresFeature('payments.vendor_methods')
@Controller('v3/me')
export class MePaymentsController {
  constructor(private readonly vendor: VendorRequestsService) {}

  @Get('payment-methods') @ApiOperation({ summary: 'My ways of being paid: UPI, pay on delivery, pay at the visit, bank transfer (secrets are never returned; only the last four characters)' })
  methods(@Tenant() t: TenantContext) { return this.vendor.listMethods(t.vendorId); }
  @Post('payment-methods') @HttpCode(200) @ApiOperation({ summary: 'Add a way of being paid; gateway details and the webhook secret are write-only' })
  create(@Tenant() t: TenantContext, @Body() dto: PaymentMethodDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.vendor.createMethod(t.vendorId, dto, actor(u, req)); }
  @Put('payment-methods/:id') @HttpCode(200) @ApiOperation({ summary: 'Rename, replace the details, or activate or disable (activation needs the terms accepted and, online, a passed test)' })
  update(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: PaymentMethodUpdateDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.vendor.updateMethod(t.vendorId, id, dto, actor(u, req)); }
  @Delete('payment-methods/:id') @HttpCode(200) @ApiOperation({ summary: 'Disable a way of being paid (it is kept, never erased)' })
  disable(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.vendor.updateMethod(t.vendorId, id, { status: 'DISABLED' }, actor(u, req)); }
  @Post('payment-methods/:id/default') @HttpCode(200) @ApiOperation({ summary: 'Make an active method the one customers are sent to first (one default per business)' })
  setDefault(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.vendor.setDefaultMethod(t.vendorId, id, actor(u, req)); }
  @Post('payment-methods/:id/test') @HttpCode(200) @ApiOperation({ summary: 'Check a method with the sandbox gateway (no real gateway is called unless live is allowed, which it is not in this build)' })
  test(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.vendor.testMethod(t.vendorId, id, actor(u, req)); }

  @Post('orders/:id/refund') @HttpCode(200) @ApiOperation({ summary: 'Record a refund you made yourself (a recorded fact: no provider is called)' })
  refund(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: RefundDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.vendor.recordRefund(t.vendorId, id, dto.amountPaise, actor(u, req)); }
  @Post('orders/:id/invoice') @HttpCode(200) @ApiOperation({ summary: 'Issue your own invoice for an order (your gap-free series; one live invoice per order)' })
  invoice(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.vendor.invoiceFor(t.vendorId, id, actor(u, req)); }
  @Get('invoices') @ApiOperation({ summary: 'My invoices' })
  async invoices(@Tenant() t: TenantContext, @Query() q: PageDto) { const { skip, take, page, pageSize } = pageArgs(q); const r = await this.vendor.invoices(t.vendorId, skip, take); return paged(r.items, r.total, page, pageSize); }
  @Post('invoices/:id/void') @HttpCode(200) @ApiOperation({ summary: 'Void an invoice (the number and the row stay; a number is never reused)' })
  void(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: VoidDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.vendor.voidInvoice(t.vendorId, id, dto.reason, actor(u, req)); }
}
