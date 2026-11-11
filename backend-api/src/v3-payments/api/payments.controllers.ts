import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { RATE } from '../../common/throttling';
import { Actor } from '../../plans/admin/audit.service';
import { pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { RequiresFeature } from '../../plans/entitlements/requires-feature.decorator';
import { PayStatus } from '../core/pay-core';
import { PaymentsService } from '../payments.service';

export class CreatePayRequestDto {
  @IsInt() @Min(1) @Max(999_999_999_999) amountPaise!: number;
  @IsString() @MaxLength(120) customerName!: string;
  @IsOptional() @IsString() @MaxLength(30) customerPhone?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
  @IsOptional() @IsString() @MaxLength(64) methodId?: string;
  @IsOptional() @IsString() @MaxLength(64) orderId?: string;
}
export class MarkPaidDto {
  @IsOptional() @IsString() @MaxLength(40) utr?: string;
  @IsOptional() @IsString() @MaxLength(80) idempotencyKey?: string;
}
export class IHavePaidDto { @IsOptional() @IsString() @MaxLength(40) utr?: string }
export class PayListDto {
  @IsOptional() @IsIn(['AWAITING', 'CUSTOMER_SAYS_PAID', 'PAID', 'EXPIRED', 'CANCELLED']) status?: PayStatus;
  @IsOptional() @IsString() @MaxLength(64) orderId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

const actor = (u: AuthenticatedUser, req: Request): Actor => ({ type: 'VENDOR', id: u?.sub ?? null, ip: req?.ip ?? null });

/** The business's own pay requests. OWNER ONLY (money), needs the plan feature payments.vendor_methods, so a Free vendor gets 403 LOCKED. The vendor is always the signed-in principal's vendor. */
@ApiTags('v3-pay-requests-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@RequiresFeature('payments.vendor_methods')
@Controller('v3/me')
export class MePayRequestsController {
  constructor(private readonly pay: PaymentsService) {}

  @Post('payment-requests') @HttpCode(200) @ApiOperation({ summary: 'Ask a customer to pay an amount by UPI; returns the pay link (refused until staff set how long a link stays valid)' })
  create(@Tenant() t: TenantContext, @Body() dto: CreatePayRequestDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.pay.create(t.vendorId, dto, actor(u, req)); }
  @Get('payment-requests') @ApiOperation({ summary: 'My pay requests, newest first; filter by status or by order' })
  async list(@Tenant() t: TenantContext, @Query() q: PayListDto) { const { skip, take, page, pageSize } = pageArgs(q); const r = await this.pay.list(t.vendorId, { status: q.status, orderId: q.orderId, skip, take }); return paged(r.items, r.total, page, pageSize); }
  @Get('payment-requests/:id') @ApiOperation({ summary: 'One pay request with its payment, when it has been marked paid' })
  one(@Tenant() t: TenantContext, @Param('id') id: string) { return this.pay.get(t.vendorId, id); }
  @Post('payment-requests/:id/cancel') @HttpCode(200) @ApiOperation({ summary: 'Cancel a request that is not paid (the link stops working)' })
  cancel(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.pay.cancel(t.vendorId, id, actor(u, req)); }
  @Post('payment-requests/:id/mark-paid') @HttpCode(200) @ApiOperation({ summary: 'Mark as paid after checking your own bank app: the ONLY way a request or its order becomes paid (idempotent)' })
  markPaid(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: MarkPaidDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.pay.markPaid(t.vendorId, id, dto, actor(u, req)); }
}

/** The customer's pay page data. Public, rate limited, no cookie; anything that must reveal nothing is ONE plain 404, a finished link is 410. */
@ApiTags('v3-pay-public')
@Controller('v3/public/pay')
export class PublicPayController {
  constructor(private readonly pay: PaymentsService) {}

  @Public() @Throttle(RATE.requestSubmit) @Get(':code') @ApiOperation({ summary: 'What the pay page shows: business name, payee name, amount, note, the UPI QR payload and the state' })
  async view(@Param('code') code: string, @Res({ passthrough: true }) res: Response) { res.set('Cache-Control', 'no-store'); return this.pay.publicView(code); }
  @Public() @Throttle(RATE.requestSubmit) @Post(':code/i-have-paid') @HttpCode(200) @ApiOperation({ summary: 'The customer says they paid (optional UPI reference). Tells the business; NEVER marks anything paid' })
  async iHavePaid(@Param('code') code: string, @Body() dto: IHavePaidDto, @Res({ passthrough: true }) res: Response) { res.set('Cache-Control', 'no-store'); return this.pay.iHavePaid(code, dto); }
}
