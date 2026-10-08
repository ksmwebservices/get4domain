import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Ip, Param, Post, Put, Query, Req, StreamableFile, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RATE } from '../common/throttling';
import { PrismaService } from '../prisma/prisma.service';
import {
  Actor, CommercialAdminGuard, MoneyAdminGuard, PayeeService, CommercialAuditService, actorOf,
} from './foundation.services';
import { DealsService, DealSpec } from './deals.service';
import { InvoiceAdminService, PromosService, PromoInput } from './promos-and-invoices.service';
import { ManualPaymentsService } from './manual-payments.service';
import { TermsService, PlanChangeService, vendorTermView, TermOverride } from './terms.service';
import { RenewalService } from './renewal.service';
import { PayService, PayCtx } from './pay.service';
import { SAFE_INVOICE_SELECT, balanceDue } from './invoice-builder.service';
import {
  ConfirmPaymentDto, CreateDealInvoiceDto, DealSpecDto, PayeeDto, PlanChangeApproveDto, PlanChangeRequestDto, ProofFormDto, PromoApplyDto,
  PromoCreateDto, PromoUpdateDto, RazorpayVerifyDto, ReasonDto, SaveDraftDto, ScheduleNextDto, SendLinkDto, TermOverrideDto,
} from './dto';
import { PlanKey } from './entitlements';
import { BillingCycle } from './pricing-math';
import { Prisma } from '@prisma/client';
import { Invoice } from '@prisma/client';

/** Strip an invoice row down to its safe fields before it leaves the API. */
function safeInvoice(inv: Invoice) {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(SAFE_INVOICE_SELECT)) out[k] = (inv as unknown as Record<string, unknown>)[k];
  out.balanceDuePaise = balanceDue(inv);
  return out;
}

// ═══ ADMIN ═══════════════════════════════════════════════════════════════════════════════════════

@ApiTags('admin-commerce')
@ApiBearerAuth()
@UseGuards(CommercialAdminGuard)
@Controller('admin/commerce')
export class AdminCommerceController {
  constructor(
    private readonly payee: PayeeService,
    private readonly deals: DealsService,
    private readonly invoices: InvoiceAdminService,
    private readonly payments: ManualPaymentsService,
    private readonly promos: PromosService,
    private readonly terms: TermsService,
    private readonly planChanges: PlanChangeService,
    private readonly renewal: RenewalService,
    private readonly prisma: PrismaService,
    private readonly audit: CommercialAuditService,
  ) {}

  // — overview badges —
  @Get('summary')
  @ApiOperation({ summary: 'Nav badge counts: payments to confirm, plan-change requests (platform admin)' })
  async summary() {
    const [paymentsToConfirm, planChangeRequests] = await Promise.all([
      this.payments.pendingCount(),
      this.prisma.planChangeRequest.count({ where: { status: 'REQUESTED' } }),
    ]);
    return { paymentsToConfirm, planChangeRequests };
  }

  // — payee —
  @Get('payee')
  @ApiOperation({ summary: 'Payee & QR settings (platform admin)' })
  getPayee() { return this.payee.get(); }

  @Get('payee/preview')
  @ApiOperation({ summary: 'Server-generated UPI QR preview (₹1.00 sample) (platform admin)' })
  previewPayee() { return this.payee.preview(); }

  @UseGuards(MoneyAdminGuard)
  @Put('payee')
  @ApiOperation({ summary: 'Update UPI ID, payee name, static QR, bank details, instructions (platform admin)' })
  updatePayee(@Body() dto: PayeeDto, @CurrentUser() u: AuthenticatedUser) { return this.payee.update(dto, actorOf(u)); }

  // — deals —
  @Post('deals/preview')
  @ApiOperation({ summary: 'Live totals preview — server-computed from the same code that issues the invoice (platform admin)' })
  preview(@Body() dto: DealSpecDto) { return this.deals.preview(dto as DealSpec); }

  @Post('deals/draft')
  @ApiOperation({ summary: 'Save a deal as a draft (platform admin)' })
  saveDraft(@Body() dto: SaveDraftDto, @CurrentUser() u: AuthenticatedUser) { const { dealId, ...spec } = dto; return this.deals.saveDraft(spec as DealSpec, actorOf(u), dealId); }

  @Get('deals')
  @ApiOperation({ summary: 'List deals (platform admin)' })
  listDeals(@Query('vendorId') vendorId?: string) { return this.deals.listDeals(vendorId); }

  @Get('deals/:id')
  @ApiOperation({ summary: 'Get one deal (platform admin)' })
  getDeal(@Param('id') id: string) { return this.deals.getDeal(id); }

  @UseGuards(MoneyAdminGuard)
  @Post('deals/invoice')
  @ApiOperation({ summary: 'Create the deal invoice + pay link; optionally activate now with payment due in N days (platform admin)' })
  async createInvoice(@Body() dto: CreateDealInvoiceDto, @CurrentUser() u: AuthenticatedUser) {
    const { dealId, activateNow, sendNow, overrideReason, ...spec } = dto;
    const r = await this.deals.createInvoice(spec as DealSpec, actorOf(u), { dealId, activateNow, sendNow, overrideReason });
    return { invoice: safeInvoice(r.invoice), payLink: r.payLink, dealId: r.dealId, vendorId: r.vendorId };
  }

  // — invoices —
  @Get('invoices')
  @ApiOperation({ summary: 'List commercial invoices with filters (platform admin)' })
  listInvoices(@Query('status') status?: string, @Query('kind') kind?: string, @Query('vendorId') vendorId?: string, @Query('q') q?: string) {
    return this.invoices.list({ status, kind, vendorId, q });
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'One invoice with payment submissions and audit trail (platform admin)' })
  getInvoice(@Param('id') id: string) { return this.invoices.get(id); }

  @UseGuards(MoneyAdminGuard)
  @Post('invoices/:id/link')
  @ApiOperation({ summary: 'Issue a fresh pay link (previous link stops working); optionally send it (platform admin)' })
  link(@Param('id') id: string, @Body() dto: SendLinkDto, @CurrentUser() u: AuthenticatedUser) { return this.invoices.reissueLink(id, actorOf(u), { send: dto.send, expiryDays: dto.expiryDays }); }

  @UseGuards(MoneyAdminGuard)
  @Post('invoices/:id/void')
  @ApiOperation({ summary: 'Void an unpaid invoice (platform admin)' })
  async voidInvoice(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() u: AuthenticatedUser) { return safeInvoice(await this.invoices.void(id, dto.reason, actorOf(u))); }

  @Get('invoices/:id/pdf')
  @ApiOperation({ summary: 'Invoice as printable HTML (platform admin)' })
  async pdf(@Param('id') id: string) { return { html: await this.invoices.pdfHtml(id) }; }

  // — payments to confirm —
  @Get('payments')
  @ApiOperation({ summary: 'Payments to confirm queue (platform admin)' })
  listPayments(@Query('status') status?: 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'ALL') { return this.payments.list(status ?? 'SUBMITTED'); }

  @UseGuards(MoneyAdminGuard)
  @Post('payments/:id/confirm')
  @ApiOperation({ summary: 'Confirm a manual payment with the amount actually received (platform admin)' })
  confirm(@Param('id') id: string, @Body() dto: ConfirmPaymentDto, @CurrentUser() u: AuthenticatedUser) { return this.payments.confirm(id, dto.receivedAmountPaise, actorOf(u), dto.note); }

  @UseGuards(MoneyAdminGuard)
  @Post('payments/:id/reject')
  @ApiOperation({ summary: 'Reject a manual payment with a reason; the payer is notified (platform admin)' })
  reject(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() u: AuthenticatedUser) { return this.payments.reject(id, dto.reason, actorOf(u)); }

  @UseGuards(MoneyAdminGuard)
  @Get('payments/:id/proof')
  @ApiOperation({ summary: 'Download the private payment screenshot (platform admin only)' })
  async proof(@Param('id') id: string): Promise<StreamableFile> {
    const p = await this.payments.proof(id);
    return new StreamableFile(p.buffer, { type: p.mime, disposition: 'inline' });
  }

  // — promos —
  @Get('promos')
  @ApiOperation({ summary: 'List promo codes with redemption counts (platform admin)' })
  listPromos() { return this.promos.list(); }

  @UseGuards(MoneyAdminGuard)
  @Post('promos')
  @ApiOperation({ summary: 'Create a promo code (platform admin)' })
  createPromo(@Body() dto: PromoCreateDto, @CurrentUser() u: AuthenticatedUser) { return this.promos.create(dto as PromoInput, actorOf(u)); }

  @UseGuards(MoneyAdminGuard)
  @Put('promos/:id')
  @ApiOperation({ summary: 'Update a promo code (type/value are immutable) (platform admin)' })
  updatePromo(@Param('id') id: string, @Body() dto: PromoUpdateDto, @CurrentUser() u: AuthenticatedUser) { return this.promos.update(id, dto, actorOf(u)); }

  // — vendor billing terms —
  @Get('vendors/:vendorId/billing')
  @ApiOperation({ summary: 'A vendor\'s current term, history, invoices and audit trail (platform admin)' })
  vendorBilling(@Param('vendorId') vendorId: string) { return this.terms.adminView(vendorId); }

  @UseGuards(MoneyAdminGuard)
  @Post('vendors/:vendorId/billing/override')
  @ApiOperation({ summary: 'Override the current billing term (creates a new history row; reason mandatory) (platform admin)' })
  override(@Param('vendorId') vendorId: string, @Body() dto: TermOverrideDto, @CurrentUser() u: AuthenticatedUser) { return this.terms.override(vendorId, dto as TermOverride, actorOf(u)); }

  @UseGuards(MoneyAdminGuard)
  @Post('vendors/:vendorId/billing/schedule-next')
  @ApiOperation({ summary: 'Schedule a plan/cycle change for the next renewal (platform admin)' })
  schedule(@Param('vendorId') vendorId: string, @Body() dto: ScheduleNextDto, @CurrentUser() u: AuthenticatedUser) { return this.terms.scheduleNext(vendorId, dto.planKey as PlanKey, dto.billingCycle as BillingCycle, dto.customMonths, actorOf(u)); }

  @UseGuards(MoneyAdminGuard)
  @Delete('vendors/:vendorId/billing/schedule-next')
  @ApiOperation({ summary: 'Clear a scheduled change (platform admin)' })
  clearSchedule(@Param('vendorId') vendorId: string, @CurrentUser() u: AuthenticatedUser) { return this.terms.clearScheduled(vendorId, actorOf(u)); }

  // — plan change requests —
  @Get('plan-changes')
  @ApiOperation({ summary: 'Plan-change requests queue (platform admin)' })
  planQueue(@Query('status') status?: string) { return this.planChanges.queue(status); }

  @UseGuards(MoneyAdminGuard)
  @Post('plan-changes/:id/approve')
  @ApiOperation({ summary: 'Approve a plan change — at renewal, or now with a proration credit (platform admin)' })
  approve(@Param('id') id: string, @Body() dto: PlanChangeApproveDto, @CurrentUser() u: AuthenticatedUser) { return this.planChanges.approve(id, dto, actorOf(u)); }

  @UseGuards(MoneyAdminGuard)
  @Post('plan-changes/:id/reject')
  @ApiOperation({ summary: 'Reject a plan-change request (platform admin)' })
  rejectPlan(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() u: AuthenticatedUser) { return this.planChanges.reject(id, dto.reason, actorOf(u)); }

  @UseGuards(MoneyAdminGuard)
  @Post('renewal/run')
  @ApiOperation({ summary: 'Run the daily renewal job now (safe: advisory-locked and idempotent) (platform admin)' })
  runRenewal() { return this.renewal.runOnce(new Date()); }
}

// ═══ PUBLIC PAY PAGE ═════════════════════════════════════════════════════════════════════════════

const PAY_VIEW = { default: { limit: 30, ttl: 60_000 } };
const PAY_ACTION = { default: { limit: 10, ttl: 60_000 } };
const PAY_PROOF = { default: { limit: 5, ttl: 60_000 } };
const PAY_PROMO = { default: { limit: 6, ttl: 60_000 } };

interface UploadedFileLike { buffer: Buffer; mimetype: string; size: number }

@ApiTags('public-pay')
@Public()
@Controller('public/pay')
export class PublicPayController {
  constructor(private readonly pay: PayService) {}

  @Throttle(PAY_VIEW)
  @Get(':token')
  @ApiOperation({ summary: 'Pay page data for a pay-link token (no login; token is 256-bit, hashed at rest, expiring)' })
  async view(@Param('token') token: string) { return this.pay.view(await this.pay.loadByToken(token)); }

  @Throttle(PAY_ACTION)
  @Post(':token/razorpay/order')
  @ApiOperation({ summary: 'Create a Razorpay order for the invoice balance — amount is server-derived, never sent by the client' })
  async order(@Param('token') token: string) { return this.pay.razorpayOrder(await this.pay.loadByToken(token)); }

  @Throttle(PAY_ACTION)
  @Post(':token/razorpay/verify')
  @ApiOperation({ summary: 'Verify a captured Razorpay payment (idempotent)' })
  async verify(@Param('token') token: string, @Body() dto: RazorpayVerifyDto) { return this.pay.razorpayVerify(await this.pay.loadByToken(token), dto); }

  @Throttle(PAY_VIEW)
  @Get(':token/upi')
  @ApiOperation({ summary: 'UPI deep link + QR for the exact balance due' })
  async upi(@Param('token') token: string) { return this.pay.upi(await this.pay.loadByToken(token)); }

  @Throttle(PAY_PROOF)
  @Post(':token/proof')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 3 * 1024 * 1024, files: 1 } }))
  @ApiOperation({ summary: 'Submit "I have paid" (UTR, date, optional screenshot) for admin confirmation' })
  async proof(@Param('token') token: string, @Body() dto: ProofFormDto, @UploadedFile() file: UploadedFileLike | undefined, @Ip() ip: string) {
    return this.pay.submitProof(await this.pay.loadByToken(token), { utr: dto.utr, claimedAmountRupees: Number(dto.amount), paidAt: dto.paidAt, payerNote: dto.note, file: file ?? null, ip });
  }

  @Throttle(PAY_PROMO)
  @Post(':token/promo')
  @ApiOperation({ summary: 'Apply a promo code (only when the invoice allows it and is unpaid) — recomputed server-side' })
  async promo(@Param('token') token: string, @Body() dto: PromoApplyDto, @Ip() ip: string) { return this.pay.applyPromo(await this.pay.loadByToken(token), dto.code, ip); }

  @Throttle(PAY_PROMO)
  @Delete(':token/promo')
  @ApiOperation({ summary: 'Remove the applied promo code' })
  async removePromo(@Param('token') token: string) { return this.pay.removePromo(await this.pay.loadByToken(token)); }
}

// ═══ VENDOR DASHBOARD ════════════════════════════════════════════════════════════════════════════

function assertVendorPrincipal(u: AuthenticatedUser): string {
  if (u.kind === 'sandbox') throw new ForbiddenException('Billing is available once your account is live');
  if (u.kind === 'team_member' && !(u.modules ?? []).includes('wallet')) throw new ForbiddenException('You do not have access to billing');
  return u.sub;
}

@ApiTags('vendor-billing')
@ApiBearerAuth()
@Controller('billing')
export class VendorBillingController {
  constructor(
    private readonly pay: PayService,
    private readonly terms: TermsService,
    private readonly planChanges: PlanChangeService,
    private readonly invoices: InvoiceAdminService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Current plan, term, status and invoices (own account)' })
  async me(@CurrentUser() u: AuthenticatedUser) {
    const vendorId = assertVendorPrincipal(u);
    const [term, invoices, requests] = await Promise.all([
      this.terms.currentFor(vendorId),
      this.prisma.invoice.findMany({ where: { vendorId, kind: { not: null }, status: { not: 'DRAFT' } }, orderBy: { createdAt: 'desc' }, take: 50, select: { ...SAFE_INVOICE_SELECT } }),
      this.planChanges.forVendor(vendorId),
    ]);
    return { term: vendorTermView(term), invoices: invoices.map((i) => ({ ...i, balanceDuePaise: balanceDue(i) })), planChangeRequests: requests };
  }

  @Get('invoices/:id/pay')
  @ApiOperation({ summary: 'Pay panel data for one of your invoices' })
  async panel(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) { return this.pay.view(await this.ctx(id, u)); }

  @Get('invoices/:id/pdf')
  @ApiOperation({ summary: 'Printable invoice HTML (own invoices)' })
  async pdf(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) { await this.ctx(id, u); return { html: await this.invoices.pdfHtml(id) }; }

  @Throttle(RATE.payment)
  @Post('invoices/:id/razorpay/order')
  @ApiOperation({ summary: 'Create a Razorpay order for the balance (server-derived amount)' })
  async order(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) { return this.pay.razorpayOrder(await this.ctx(id, u)); }

  @Throttle(RATE.payment)
  @Post('invoices/:id/razorpay/verify')
  @ApiOperation({ summary: 'Verify a captured Razorpay payment (idempotent)' })
  async verify(@Param('id') id: string, @Body() dto: RazorpayVerifyDto, @CurrentUser() u: AuthenticatedUser) { return this.pay.razorpayVerify(await this.ctx(id, u), dto); }

  @Get('invoices/:id/upi')
  @ApiOperation({ summary: 'UPI link + QR — only when the admin enabled UPI for this invoice' })
  async upi(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) { return this.pay.upi(await this.ctx(id, u)); }

  @Throttle(PAY_PROOF)
  @Post('invoices/:id/proof')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 3 * 1024 * 1024, files: 1 } }))
  @ApiOperation({ summary: 'Submit proof of a UPI/bank payment' })
  async proof(@Param('id') id: string, @Body() dto: ProofFormDto, @UploadedFile() file: UploadedFileLike | undefined, @CurrentUser() u: AuthenticatedUser, @Req() req: { ip?: string }) {
    return this.pay.submitProof(await this.ctx(id, u), { utr: dto.utr, claimedAmountRupees: Number(dto.amount), paidAt: dto.paidAt, payerNote: dto.note, file: file ?? null, ip: req.ip });
  }

  @Throttle(PAY_PROMO)
  @Post('invoices/:id/promo')
  @ApiOperation({ summary: 'Apply a promo code when the invoice allows it' })
  async promo(@Param('id') id: string, @Body() dto: PromoApplyDto, @CurrentUser() u: AuthenticatedUser, @Req() req: { ip?: string }) { return this.pay.applyPromo(await this.ctx(id, u), dto.code, req.ip); }

  @Throttle(PAY_PROMO)
  @Delete('invoices/:id/promo')
  @ApiOperation({ summary: 'Remove an applied promo code' })
  async removePromo(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) { return this.pay.removePromo(await this.ctx(id, u)); }

  @Throttle(RATE.payment)
  @Post('plan-change-requests')
  @ApiOperation({ summary: 'Request a plan or billing-cycle change (reviewed by Get4Domain)' })
  requestChange(@Body() dto: PlanChangeRequestDto, @CurrentUser() u: AuthenticatedUser) {
    return this.planChanges.request(assertVendorPrincipal(u), { toPlanKey: dto.toPlanKey as PlanKey, toCycle: dto.toCycle as BillingCycle, customMonths: dto.customMonths, effective: dto.effective, note: dto.note });
  }

  private ctx(id: string, u: AuthenticatedUser): Promise<PayCtx> { return this.pay.loadForVendor(id, assertVendorPrincipal(u)); }
}

export { BadRequestException, Prisma };
export type { Actor };
