import { Body, Controller, Get, HttpCode, Optional, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { invoiceStatusOf } from '../../v3-admin-gaps/core/admin-gaps-core';
import { staffDisplayName } from '../../v3-admin-gaps/staff-name';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf, pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { PlanBillingRepository } from '../plan-billing.repository';
import { PaymentSettlementService } from '../settlement.service';
import { PaymentGatewaySettingsService } from '../gateway/gateway-settings.service';
import { PlanOrderService } from '../plan-order.service';
import { HeldPaymentsService } from '../held-payments.service';
import { AdminEventsDto, AdminOrdersDto, CashConfirmDto, CreateCashOrderDto, HeldListDto, HeldResolveDto, RefundDto, UpdateGatewayDto } from './dto/billing.dto';

/** Staff side of plan purchases. Reads: OPERATIONS and SUPER_ADMIN. Marking an order paid offline and recording a refund: SUPER_ADMIN only. MARKETING is refused everywhere. All writes are audited. */
@ApiTags('v3-billing-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/billing')
export class BillingAdminController {
  constructor(private readonly repo: PlanBillingRepository, private readonly settlement: PaymentSettlementService, private readonly planOrders: PlanOrderService, @Optional() private readonly prisma?: PrismaService) {}

  @Get('orders') @ApiOperation({ summary: 'Plan orders, newest first, by vendor or status' })
  async orders(@Query() q: AdminOrdersDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const r = await this.repo.listOrders({ vendorId: q.vendorId, status: q.status, skip, take });
    return paged(r.items.map((o) => ({ id: o.id, vendorId: o.vendorId, planId: o.planId, kind: o.kind, termMonths: o.termMonths, amountPaise: o.amountPaise, currency: o.currency, status: o.status, providerOrderId: o.providerOrderId, paymentId: o.paymentId, paidAmountPaise: o.paidAmountPaise, paidAt: o.paidAt, source: o.source, reason: o.reason, subscriptionId: o.subscriptionId, refundRecordedPaise: o.refundRecordedPaise, refundNote: o.refundNote, settledReference: o.settledReference, settledOn: o.settledOn ? o.settledOn.toISOString().slice(0, 10) : null, settledAmountPaise: o.settledAmountPaise, settledByName: o.settledByName, quote: o.quote, expiresAt: o.expiresAt, createdAt: o.createdAt })), r.total, page, pageSize);
  }

  @Get('payment-events') @ApiOperation({ summary: 'The payment webhook inbox (payloads are stored redacted)' })
  async events(@Query() q: AdminEventsDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const r = await this.repo.listEvents({ orderId: q.orderId, skip, take });
    return paged(r.items.map((e) => ({ id: e.id, provider: e.provider, providerEventId: e.providerEventId, type: e.type, signatureValid: e.signatureValid, orderId: e.orderId, processedAt: e.processedAt, result: e.result, payload: e.payloadRedacted, createdAt: e.createdAt })), r.total, page, pageSize);
  }

  @Post('orders/:id/mark-paid') @HttpCode(200)
  @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN, audited: confirm that CASH was received for a cash order (a special case). Requires the method CASH, a receipt reference, the day received, the amount equal to the order total including GST, and a special-case note. Marks the order paid, activates the plan and makes the invoice in one transaction; the answer shows the invoice number and the reference. Nothing but cash can be confirmed here.' })
  async markPaid(@Param('id') id: string, @Body() dto: CashConfirmDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) {
    return this.settlement.confirmCash(id, dto, actorOf(u, req), await staffDisplayName(this.prisma, u));
  }

  @Post('vendors/:vendorId/cash-orders') @HttpCode(200)
  @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN, audited: make a CASH order for a vendor who paid cash in a special case. The amount is the server price (price book plus GST). Idempotent by key. It is settled only by an admin confirming the cash.' })
  createCashOrder(@Param('vendorId') vendorId: string, @Body() dto: CreateCashOrderDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.planOrders.createCashOrder(vendorId, dto, actorOf(u, req)); }

  @Post('orders/:id/refund') @HttpCode(200)
  @ApiOperation({ summary: 'Record a refund that was made elsewhere (SUPER_ADMIN). A record only: no money moves and the subscription is not changed.' })
  refund(@Param('id') id: string, @Body() dto: RefundDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.settlement.recordRefund(id, dto, actorOf(u, req)); }
}

/**
 * Wave 4 W2: held payments. A payment the gateway reported whose amount or currency did not match its order (or that arrived for a closed order) waits here. ADMIN and SUPER_ADMIN only (the role matrix); every other
 * role is refused. The admin checks the gateway dashboard, then ACCEPTS (only when the verified amount equals the order total including GST) or REJECTS with a note. Refunds are done in the gateway dashboard.
 */
@ApiTags('v3-billing-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/billing/held-payments')
export class HeldPaymentsAdminController {
  constructor(private readonly held: HeldPaymentsService, @Optional() private readonly prisma?: PrismaService) {}

  @Get() @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN: payments on hold, newest first, paged; filter by business, gateway and the day held (from, to)' })
  async list(@Query() q: HeldListDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const day = (v?: string, plus = 0): Date | undefined => (v ? new Date(Date.parse(`${v}T00:00:00.000Z`) + plus * 86400000) : undefined);
    const r = await this.held.list({ vendorId: q.vendorId, gateway: q.gateway, from: day(q.from), to: day(q.to, 1), skip, take });
    return paged(r.items, r.total, page, pageSize);
  }

  @Get(':id') @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN: one held payment: the order, the expected total, the amount seen, the gateway ids, when it was held, and how it was resolved if it was' })
  detail(@Param('id') id: string) { return this.held.detail(id); }

  @Post(':id/resolve') @HttpCode(200)
  @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN, audited, idempotent: ACCEPT (needs the verified amount, equal to the order total including GST, and the gateway payment id; activates the plan and makes the invoice in one transaction) or REJECT (marks the order failed and queues the vendor message). A note is required.' })
  async resolve(@Param('id') id: string, @Body() dto: HeldResolveDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) {
    return this.held.resolve(id, dto, actorOf(u, req), await staffDisplayName(this.prisma, u));
  }
}

class InvoiceListDto {
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @IsIn(['PAID', 'REFUND_RECORDED']) status?: 'PAID' | 'REFUND_RECORDED';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

/**
 * C7: every business's plan invoices in one list, newest first, paged, filtered by business and status. Staff read, OPERATIONS and SUPER_ADMIN (MARKETING refused), the same as the plan orders list.
 * A plan invoice exists only for a paid order, so its status is PAID, or REFUND_RECORDED once a refund was recorded on that order (the amounts ride on the row).
 */
@ApiTags('v3-billing-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/invoices')
export class AdminInvoicesController {
  constructor(private readonly repo: PlanBillingRepository) {}

  @Get() @ApiOperation({ summary: 'All plan invoices, newest first, paged; filter by business and status' })
  async list(@Query() q: InvoiceListDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const r = await this.repo.listInvoicesForStaff({ vendorId: q.vendorId, status: q.status, skip, take });
    return paged(r.items.map((i) => ({
      id: i.id, number: i.invoiceNumber, vendorId: i.vendorId, totalPaise: typeof i.snapshot.amountPaise === 'number' ? i.snapshot.amountPaise : i.paidAmountPaise, status: invoiceStatusOf(i.refundRecordedPaise),
      refundRecordedPaise: i.refundRecordedPaise, issuedAt: i.issuedAt, financialYear: i.financialYear, orderId: i.orderId,
    })), r.total, page, pageSize);
  }
}

/**
 * The payment gateway setting (Wave 3 Part C). Reading: OPERATIONS, ADMIN and SUPER_ADMIN. Changing the gateway or its mode: ADMIN and SUPER_ADMIN, audited. It starts OFF; test and live are accepted only when the
 * server has that gateway's keys (and, for live, the live flag). Only whether keys exist is shown, never a key.
 */
@ApiTags('v3-billing-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/payment-gateway')
export class AdminPaymentGatewayController {
  constructor(private readonly gateways: PaymentGatewaySettingsService) {}

  @Get() @ApiOperation({ summary: 'Which payment gateway checkout uses, its mode (off, test or live), and which gateways have keys on this server' })
  get() { return this.gateways.get(); }

  @Put() @HttpCode(200) @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN, audited: choose the gateway (razorpay or cashfree) and its mode. Refused unless the server has that gateway keys; live also needs the live flag.' })
  update(@Body() dto: UpdateGatewayDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.gateways.update(dto, { id: u?.sub ?? null, ip: req?.ip ?? null }); }
}
