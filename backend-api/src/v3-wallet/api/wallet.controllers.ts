import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { RATE } from '../../common/throttling';
import { Actor } from '../../plans/admin/audit.service';
import { actorOf } from '../../plans/admin/plans-admin.common';
import { CreateOrderDto } from '../../plan-billing/api/dto/billing.dto';
import { PlanRenewalService } from '../plan-renewal.service';
import { V3WalletService } from '../wallet.service';
import { AdjustWalletDto, AdminWalletsDto, BillingProfileDto, ConfirmTopupDto, CreateTopupDto, FreezeWalletDto, WalletPageDto } from './dto/wallet.dto';

const page = (q: WalletPageDto): { page: number; pageSize: number } => ({ page: q.page ?? 1, pageSize: q.pageSize ?? 25 });

/**
 * The signed-in OWNER's wallet. The vendor is ALWAYS the verified principal's vendor (@UseTenant): never in the URL, query or body. OWNER ONLY: a team member cannot see the balance or start a
 * payment (money). A Free vendor can open this and sees a locked preview, never an error. No route here spends money: spending happens inside a service, pack or plan purchase.
 */
@ApiTags('v3-wallet')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/wallet')
export class MeWalletController {
  constructor(private readonly wallet: V3WalletService) {}
  private actor(user: AuthenticatedUser, req: Request): Actor { return { type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null }; }

  @Get() @ApiOperation({ summary: 'My wallet: balance, held, available, why it is locked (a Free vendor sees a locked preview), top-up limits and billing profile' })
  view(@Tenant() t: TenantContext) { return this.wallet.view(t.vendorId); }

  @Get('ledger') @ApiOperation({ summary: 'My wallet ledger, newest first (own rows only)' })
  ledger(@Tenant() t: TenantContext, @Query() q: WalletPageDto) { const p = page(q); return this.wallet.ledger(t.vendorId, p.page, p.pageSize); }

  @Get('topups') @ApiOperation({ summary: 'My top-ups, newest first' })
  topups(@Tenant() t: TenantContext, @Query() q: WalletPageDto) { const p = page(q); return this.wallet.topups(t.vendorId, p.page, p.pageSize); }

  @Throttle(RATE.payment) @Post('topups') @HttpCode(200)
  @ApiOperation({ summary: 'Start adding credit (idempotent by key). The wallet must be active and the amount inside the staff limits. Returns the provider order for the checkout.' })
  createTopup(@Tenant() t: TenantContext, @Body() dto: CreateTopupDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.wallet.createTopup(t.vendorId, dto, this.actor(user, req)); }

  @Throttle(RATE.payment) @Post('topups/:id/confirm') @HttpCode(200)
  @ApiOperation({ summary: 'Tell us the checkout finished. The signature is checked and the payment provider is asked; credit is added only if it really paid the exact amount, and only once.' })
  confirmTopup(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: ConfirmTopupDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.wallet.confirmTopup(t.vendorId, id, dto, this.actor(user, req)); }

  @Put('billing-profile') @ApiOperation({ summary: 'Set the state code and GST number used on tax invoices for services' })
  billingProfile(@Tenant() t: TenantContext, @Body() dto: BillingProfileDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.wallet.setBillingProfile(t.vendorId, dto, this.actor(user, req)); }
}

/**
 * Buy or renew a Pro plan with wallet credit instead of the payment provider. OWNER ONLY (it spends money). The vendor is ALWAYS the verified principal's vendor. The amount is the plan price from
 * the plan tables, never from the request; the answer for a short wallet is 409 INSUFFICIENT_WALLET with the exact shortfall and the top-up that covers it. Idempotent by key.
 */
@ApiTags('v3-wallet')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/plan')
export class MePlanRenewController {
  constructor(private readonly renewal: PlanRenewalService) {}

  @Throttle(RATE.payment) @Post('renew-with-wallet') @HttpCode(200)
  @ApiOperation({ summary: 'Buy or renew a Pro plan for 3, 6 or 12 months from wallet credit. The charge, the paid order, the new term and the invoice happen together or not at all; a term that cannot start gives the charge back.' })
  renew(@Tenant() t: TenantContext, @Body() dto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.renewal.renew(t.vendorId, dto, { type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null });
  }
}

/**
 * Staff side. Reads and the reconciliation report: OPERATIONS and SUPER_ADMIN. A manual adjustment and the freeze toggle: SUPER_ADMIN only, with a reason, audited. MARKETING is refused
 * everywhere (a wallet is money). There is no route that spends from a wallet on its own.
 */
@ApiTags('v3-wallet-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/wallets')
export class AdminWalletController {
  constructor(private readonly wallet: V3WalletService) {}

  @Get() @ApiOperation({ summary: 'All wallets, by status' })
  list(@Query() q: AdminWalletsDto) { const p = page(q); return this.wallet.adminList({ status: q.status, ...p }); }

  @Get('reconciliation') @ApiOperation({ summary: 'Replay every ledger and report the wallets whose cached numbers or lots disagree with it' })
  reconciliation() { return this.wallet.reconcileAll(); }

  @Post('expiry-run') @HttpCode(200) @ApiOperation({ summary: 'Write off credit past its date now (the hourly job does the same; safe to run any time and to run twice)' })
  expiryRun() { return this.wallet.runExpiry(); }

  @Get(':vendorId') @ApiOperation({ summary: 'One vendor\'s wallet with its lots' })
  get(@Param('vendorId') vendorId: string) { return this.wallet.adminGet(String(vendorId).slice(0, 64)); }

  @Get(':vendorId/ledger') @ApiOperation({ summary: 'One vendor\'s ledger, newest first' })
  ledger(@Param('vendorId') vendorId: string, @Query() q: WalletPageDto) { const p = page(q); return this.wallet.adminLedger(String(vendorId).slice(0, 64), p.page, p.pageSize); }

  @Get(':vendorId/reconcile') @ApiOperation({ summary: 'Replay one vendor\'s ledger against the cached numbers and the lots' })
  reconcile(@Param('vendorId') vendorId: string) { return this.wallet.reconcileVendor(String(vendorId).slice(0, 64)); }

  @Post(':vendorId/adjustments') @HttpCode(200) @ApiOperation({ summary: 'SUPER_ADMIN: add or remove credit with a reason (idempotent by key; can never take held money)' })
  adjust(@Param('vendorId') vendorId: string, @Body() dto: AdjustWalletDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.wallet.adjust(String(vendorId).slice(0, 64), dto, actorOf(u, req)); }

  @Put(':vendorId/frozen') @ApiOperation({ summary: 'SUPER_ADMIN: freeze or unfreeze a wallet with a reason' })
  frozen(@Param('vendorId') vendorId: string, @Body() dto: FreezeWalletDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.wallet.setFrozen(String(vendorId).slice(0, 64), dto, actorOf(u, req)); }
}
