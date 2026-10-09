import { Body, Controller, Delete, Get, Header, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RATE } from '../common/throttling';
import { CommercialAdminGuard, actorOf } from '../commercial/foundation.services';
import { WhatsappGatewayService } from '../messaging/whatsapp/whatsapp-gateway.service';
import { SandboxWhatsappProvider } from '../messaging/whatsapp/sandbox.provider';
import { PrismaService } from '../prisma/prisma.service';
import { LeadCaptureService } from './capture.service';
import { LeadCreditsService } from './credits.service';
import { CONSENT_TEXT, CONSENT_TEXT_VERSION } from './goals';
import {
  ApplyDto, BlockPhoneDto, CaptureEventDto, DisputeDecisionDto, DisputeDto, LeadStatusDto, LowBalanceModeDto, OrderDecisionDto, OtpRequestDto, RefundDecisionDto, RefundRequestDto, SetPriceDto, SettingValueDto, TemplateApprovalDto,
} from './leadspace.dto';
import { LeadsService } from './leads.service';
import { LeadOtpService } from './otp.service';
import { LeadPricingService } from './pricing.service';
import { LeadPurseService } from './purse.service';
import { LeadspaceSettingsService, LsSettings } from './settings.service';

/** Public: what a customer does on a LeadSpace page. Multi-tenant by page slug; nothing here needs a login. */
@ApiTags('leadspace-public')
@Public()
@Controller('leadspace/public')
export class LeadspacePublicController {
  constructor(private readonly capture: LeadCaptureService) {}

  @Get('consent')
  @ApiOperation({ summary: 'The consent words shown beside the Send me a code button, with their version' })
  consent(): { version: string; text: string } { return { version: CONSENT_TEXT_VERSION, text: CONSENT_TEXT }; }

  @Post('otp')
  @Throttle(RATE.otpRequest)
  @ApiOperation({ summary: 'Send a one-time code to the customer on WhatsApp (consent required; limits per phone, device and network)' })
  otp(@Body() dto: OtpRequestDto, @Req() req: Request) { return this.capture.requestOtp({ ...dto, ip: req.ip }); }

  @Post('event')
  @Throttle(RATE.publicAction)
  @ApiOperation({ summary: 'Capture one verified enquiry, booking, appointment, site visit or cart order' })
  event(@Body() dto: CaptureEventDto, @Req() req: Request) {
    return this.capture.capture({ ...dto, utm: dto.utm as Record<string, string> | undefined, ip: req.ip });
  }
}

/** Vendor: leads, the LEADS purse, disputes and the low-balance choice. Every query is scoped to the signed-in vendor. */
@ApiTags('leadspace')
@ApiBearerAuth()
@Controller('leadspace')
export class LeadspaceVendorController {
  constructor(
    private readonly leads: LeadsService, private readonly purse: LeadPurseService, private readonly credits: LeadCreditsService,
    private readonly pricing: LeadPricingService, private readonly prisma: PrismaService, private readonly captureSvc: LeadCaptureService, private readonly settings: LeadspaceSettingsService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Home tab: counts, spend, page state and wallet balance' })
  summary(@CurrentUser() u: AuthenticatedUser) { return this.leads.summary(u.sub); }

  @Get('leads')
  @ApiOperation({ summary: 'Leads tab. Held leads show a masked contact only.' })
  list(@CurrentUser() u: AuthenticatedUser, @Query('status') status?: string, @Query('type') type?: string, @Query('search') search?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('take') take?: string, @Query('skip') skip?: string) {
    return this.leads.list(u.sub, { status, type, search, from, to, take: take ? Number(take) : undefined, skip: skip ? Number(skip) : undefined });
  }

  @Get('leads/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="leadspace-leads.csv"')
  @ApiOperation({ summary: 'Download delivered leads as CSV' })
  csv(@CurrentUser() u: AuthenticatedUser) { return this.leads.csv(u.sub); }

  @Put('leads/:id/status')
  @ApiOperation({ summary: 'Mark a lead Contacted, Won or Lost' })
  status(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: LeadStatusDto) { return this.leads.setStatus(u.sub, id, dto.status, dto.note); }

  @Put('leads/:id/order')
  @ApiOperation({ summary: 'Confirm or decline a cart order request' })
  order(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: OrderDecisionDto) { return this.leads.decideOrder(u.sub, id, dto.decision, dto.note); }

  @Post('leads/:id/dispute')
  @ApiOperation({ summary: 'Say a delivered lead is not valid. An admin decides; a credit lands in your wallet.' })
  dispute(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: DisputeDto) { return this.credits.dispute(u.sub, id, dto.reason, dto.note); }

  @Get('wallet')
  @ApiOperation({ summary: 'Wallet tab: balance, the price list for your trade and city, and the ledger' })
  async wallet(@CurrentUser() u: AuthenticatedUser) {
    const [balancePaise, ledger, profile, held, s] = await Promise.all([
      this.purse.balance(u.sub), this.purse.ledger(u.sub, 50), this.prisma.leadspaceProfile.findUnique({ where: { vendorId: u.sub } }),
      this.prisma.leadEvent.count({ where: { vendorId: u.sub, status: 'HELD' } }), this.settings.get(),
    ]);
    const prices = profile ? await this.pricing.priceList(profile.category, profile.city) : {};
    return { balancePaise, held, ledger, prices, lowBalanceMode: profile?.lowBalanceMode ?? 'HOLD', lowBalanceThresholdsPaise: s.lowBalanceThresholdsPaise, expiryMonths: s.expiryMonths, refundWindowMonths: s.refundWindowMonths, disputeWindowHours: s.disputeWindowHours };
  }

  @Put('wallet/low-balance-mode')
  @ApiOperation({ summary: 'Choose what happens to a customer when your wallet is empty: hold their request (default) or show a polite message' })
  async mode(@CurrentUser() u: AuthenticatedUser, @Body() dto: LowBalanceModeDto) {
    await this.prisma.leadspaceProfile.updateMany({ where: { vendorId: u.sub }, data: { lowBalanceMode: dto.mode } });
    return { lowBalanceMode: dto.mode };
  }

  @Post('wallet/release')
  @ApiOperation({ summary: 'Release waiting customers, oldest first, as far as the balance allows' })
  release(@CurrentUser() u: AuthenticatedUser) { return this.captureSvc.releaseHeld(u.sub); }

  @Post('wallet/refund-request')
  @ApiOperation({ summary: 'Ask for unused balance to be refunded (inside the refund window, less the payment fee)' })
  refund(@CurrentUser() u: AuthenticatedUser, @Body() dto: RefundRequestDto) { return this.credits.requestRefund(u.sub, dto.note); }
}

/** Admin: prices, rules, disputes, refunds, blocked numbers and the common WhatsApp number. Platform admins only; MARKETING is refused. */
@ApiTags('admin-leadspace')
@ApiBearerAuth()
@UseGuards(CommercialAdminGuard)
@Controller('admin/leadspace')
export class LeadspaceAdminController {
  constructor(
    private readonly pricing: LeadPricingService, private readonly settings: LeadspaceSettingsService, private readonly credits: LeadCreditsService,
    private readonly otp: LeadOtpService, private readonly gateway: WhatsappGatewayService, private readonly prisma: PrismaService, private readonly captureSvc: LeadCaptureService,
  ) {}

  @Get('prices')
  @ApiOperation({ summary: 'Every price rule ever set, newest first (history is never edited)' })
  prices() { return this.pricing.list(); }

  @Post('prices')
  @ApiOperation({ summary: 'Set a price: the rule in force ends now and the new one starts now' })
  setPrice(@Body() dto: SetPriceDto, @CurrentUser() u: AuthenticatedUser) { return this.pricing.setPrice(dto, actorOf(u).id); }

  @Get('settings')
  @ApiOperation({ summary: 'All LeadSpace rules: windows, limits, refund and expiry, margin floor, kill switch' })
  getSettings(): Promise<LsSettings> { return this.settings.get(); }

  @Put('settings/:key')
  @ApiOperation({ summary: 'Change one LeadSpace rule' })
  setSetting(@Param('key') key: string, @Body() dto: SettingValueDto, @CurrentUser() u: AuthenticatedUser) { return this.settings.set(key as keyof LsSettings, dto.value, actorOf(u).id); }

  @Get('disputes')
  @ApiOperation({ summary: 'Invalid-lead disputes waiting for a decision' })
  disputes(@Query('status') status?: string) { return this.credits.queue(status ?? 'OPEN'); }

  @Put('disputes/:id')
  @ApiOperation({ summary: 'Credit or reject a disputed lead (a credit is a ledger entry)' })
  decide(@Param('id') id: string, @Body() dto: DisputeDecisionDto, @CurrentUser() u: AuthenticatedUser) { return this.credits.decide(id, actorOf(u).id, dto.decision, dto.note); }

  @Get('refunds')
  @ApiOperation({ summary: 'Refund requests' })
  refunds(@Query('status') status?: string) { return this.credits.refunds(status); }

  @Put('refunds/:id')
  @ApiOperation({ summary: 'Approve (debits the wallet), reject, or mark a refund as paid' })
  decideRefund(@Param('id') id: string, @Body() dto: RefundDecisionDto, @CurrentUser() u: AuthenticatedUser) { return this.credits.decideRefund(id, actorOf(u).id, dto.decision, dto.paymentFeePaise ?? 0); }

  @Post('expiry-sweep')
  @ApiOperation({ summary: 'Write off balance older than the expiry window. Shows what it would do unless apply is true.' })
  expiry(@Body() dto: ApplyDto, @CurrentUser() u: AuthenticatedUser) { return this.credits.expirySweep(dto.apply === true, actorOf(u).id); }

  @Post('vendors/:vendorId/release')
  @ApiOperation({ summary: 'Release a vendor\'s held customers as far as their balance allows' })
  release(@Param('vendorId') vendorId: string) { return this.captureSvc.releaseHeld(vendorId); }

  @Post('blocked-phones')
  @ApiOperation({ summary: 'Never send a code to this number again' })
  async block(@Body() dto: BlockPhoneDto) { await this.otp.block(dto.phone, dto.reason ?? 'Blocked by admin'); return { blocked: true }; }

  @Delete('blocked-phones/:phone')
  @ApiOperation({ summary: 'Allow codes to this number again' })
  async unblock(@Param('phone') phone: string) { await this.otp.unblock(phone); return { blocked: false }; }

  @Get('whatsapp')
  @ApiOperation({ summary: 'Common WhatsApp number: live status and the template list with approval status' })
  async whatsapp() { return { ...(await this.gateway.liveStatus()), templates: await this.gateway.templates() }; }

  @Put('whatsapp/templates/:name')
  @ApiOperation({ summary: 'Record the approval status Meta gave a template' })
  approval(@Param('name') name: string, @Body() dto: TemplateApprovalDto) { return this.gateway.setApproval(name, dto.approvalStatus, dto.providerTemplateId); }

  @Get('whatsapp/log')
  @ApiOperation({ summary: 'Recent messages from the common number (numbers masked)' })
  log(@Query('vendorId') vendorId?: string) { return this.prisma.whatsappMessageLog.findMany({ where: vendorId ? { vendorId } : {}, orderBy: { createdAt: 'desc' }, take: 200 }); }

  @Get('whatsapp/outbox')
  @ApiOperation({ summary: 'Sandbox only: the messages the sandbox provider would have sent, so a pilot can be tested before Meta approves the number' })
  outbox() {
    const p = this.gateway.getProvider();
    return p instanceof SandboxWhatsappProvider ? { sandbox: true, messages: [...p.outbox].reverse().slice(0, 50) } : { sandbox: false, messages: [] };
  }
}
