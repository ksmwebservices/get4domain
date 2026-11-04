import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf, pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { PlanBillingRepository } from '../plan-billing.repository';
import { PaymentSettlementService } from '../settlement.service';
import { AdminEventsDto, AdminOrdersDto, MarkPaidDto, RefundDto } from './dto/billing.dto';

/** Staff side of plan purchases. Reads: OPERATIONS and SUPER_ADMIN. Marking an order paid offline and recording a refund: SUPER_ADMIN only. MARKETING is refused everywhere. All writes are audited. */
@ApiTags('v3-billing-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/billing')
export class BillingAdminController {
  constructor(private readonly repo: PlanBillingRepository, private readonly settlement: PaymentSettlementService) {}

  @Get('orders') @ApiOperation({ summary: 'Plan orders, newest first, by vendor or status' })
  async orders(@Query() q: AdminOrdersDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const r = await this.repo.listOrders({ vendorId: q.vendorId, status: q.status, skip, take });
    return paged(r.items.map((o) => ({ id: o.id, vendorId: o.vendorId, planId: o.planId, kind: o.kind, termMonths: o.termMonths, amountPaise: o.amountPaise, currency: o.currency, status: o.status, providerOrderId: o.providerOrderId, paymentId: o.paymentId, paidAmountPaise: o.paidAmountPaise, paidAt: o.paidAt, source: o.source, reason: o.reason, subscriptionId: o.subscriptionId, refundRecordedPaise: o.refundRecordedPaise, refundNote: o.refundNote, quote: o.quote, expiresAt: o.expiresAt, createdAt: o.createdAt })), r.total, page, pageSize);
  }

  @Get('payment-events') @ApiOperation({ summary: 'The payment webhook inbox (payloads are stored redacted)' })
  async events(@Query() q: AdminEventsDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const r = await this.repo.listEvents({ orderId: q.orderId, skip, take });
    return paged(r.items.map((e) => ({ id: e.id, provider: e.provider, providerEventId: e.providerEventId, type: e.type, signatureValid: e.signatureValid, orderId: e.orderId, processedAt: e.processedAt, result: e.result, payload: e.payloadRedacted, createdAt: e.createdAt })), r.total, page, pageSize);
  }

  @Post('orders/:id/mark-paid') @HttpCode(200)
  @ApiOperation({ summary: 'Mark an order paid offline (SUPER_ADMIN, reason required). Creates the same subscription and invoice as an online payment, with source STAFF.' })
  markPaid(@Param('id') id: string, @Body() dto: MarkPaidDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.settlement.markPaid(id, dto.reason, actorOf(u, req)); }

  @Post('orders/:id/refund') @HttpCode(200)
  @ApiOperation({ summary: 'Record a refund that was made elsewhere (SUPER_ADMIN). A record only: no money moves and the subscription is not changed.' })
  refund(@Param('id') id: string, @Body() dto: RefundDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.settlement.recordRefund(id, dto, actorOf(u, req)); }
}
