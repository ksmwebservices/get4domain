import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { RATE } from '../../common/throttling';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { Actor } from '../../plans/admin/audit.service';
import { PageQueryDto, pageArgs } from '../../plans/admin/plans-admin.common';
import { OrderStatus } from '../core/registrar-core';
import { IdentityService, StaffRef } from '../identity.service';
import { RegistrarService } from '../registrar.service';
import { OrderKind, RegistrantStatus } from '../registrar.store';

const actor = (user: AuthenticatedUser, req: Request, type: 'VENDOR' | 'STAFF'): Actor => ({ type, id: user?.sub ?? null, ip: req?.ip ?? null });
const staffOf = (user: AuthenticatedUser): StaffRef => ({ id: user.sub, role: user.adminRole ?? 'OPERATIONS' });

export class QuoteDto { @IsString() @MaxLength(253) domain!: string; @IsInt() @Min(1) @Max(10) years!: number; @IsOptional() @IsBoolean() privacy?: boolean; }
export class PurchaseDto extends QuoteDto {
  @IsString() @MinLength(8) @MaxLength(80) idempotencyKey!: string; @IsInt() @Min(1) expectedTotalPaise!: number; @IsOptional() @IsBoolean() consent?: boolean;
}
export class TransferQuoteDto { @IsString() @MaxLength(253) domain!: string; @IsOptional() @IsBoolean() privacy?: boolean; }
export class TransferDto extends TransferQuoteDto {
  @IsString() @MinLength(6) @MaxLength(64) authCode!: string; @IsString() @MinLength(8) @MaxLength(80) idempotencyKey!: string; @IsInt() @Min(1) expectedTotalPaise!: number; @IsBoolean() confirmUnlocked!: boolean; @IsOptional() @IsBoolean() consent?: boolean;
}
export class RenewDto { @IsInt() @Min(1) @Max(10) years!: number; @IsString() @MinLength(8) @MaxLength(80) idempotencyKey!: string; @IsInt() @Min(1) expectedTotalPaise!: number; }
export class RenewQuoteDto { @IsInt() @Min(1) @Max(10) years!: number; }
export class SearchQuery { @IsString() @MaxLength(253) name!: string; }
export class OnBehalfDto extends PurchaseDto { @IsString() @MinLength(5) @MaxLength(300) reason!: string; }
export class OrderListQuery extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @IsIn(['CREATED', 'HELD', 'SUBMITTED', 'COMPLETED', 'FAILED', 'UNKNOWN']) status?: OrderStatus;
  @IsOptional() @IsIn(['REGISTER', 'RENEW', 'TRANSFER_IN']) kind?: OrderKind;
}
export class ProposeMarginDto { @IsString() @MaxLength(70) tld!: string; @IsIn(['PERCENT_BP', 'FIXED_PAISE']) kind!: string; @IsInt() @Min(0) value!: number; @IsOptional() @IsString() @MaxLength(300) note?: string; }
export class ApproveMarginDto { @IsString() @MaxLength(40) effectiveFrom!: string; }
export class RecoverDto { @IsInt() @Min(0) olderThanMinutes!: number; }

export class DetailsDto {
  @IsString() @MaxLength(120) legalName!: string; @IsString() @MaxLength(160) company!: string; @IsString() @MaxLength(254) email!: string; @IsString() @MaxLength(4) phoneCc!: string; @IsString() @MaxLength(15) phone!: string;
  @IsString() @MaxLength(200) addressLine1!: string; @IsString() @MaxLength(80) city!: string; @IsString() @MaxLength(80) state!: string; @IsOptional() @IsString() @MaxLength(2) country?: string; @IsString() @MaxLength(12) zipcode!: string;
}
export class OtpDto { @IsIn(['EMAIL', 'PHONE']) channel!: 'EMAIL' | 'PHONE'; }
export class OtpVerifyDto extends OtpDto { @IsString() @MaxLength(6) code!: string; }
export class DocumentDto { @IsString() @MaxLength(30) kind!: string; @IsOptional() @IsString() @MaxLength(4) last4?: string; @IsString() @MaxLength(40) mime!: string; @IsString() @MaxLength(14_000_000) dataBase64!: string; }
export class SubmitDto { @IsBoolean() consent!: boolean; }
export class ReasonDto { @IsString() @MinLength(5) @MaxLength(300) reason!: string; }
export class DecisionDto { @IsOptional() @IsString() @MaxLength(300) note?: string; }
export class IdentityQueueQuery extends PageQueryDto { @IsOptional() @IsIn(['INCOMPLETE', 'IN_REVIEW', 'APPROVED', 'REJECTED']) status?: RegistrantStatus; }

/** The signed-in vendor's own domain sales screens. The vendor is ALWAYS the verified principal's vendor (@UseTenant); another vendor's id answers like one that does not exist. OWNER ONLY (it spends money). */
@ApiTags('v3-domain-sales')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/domain-sales')
export class MeDomainSalesController {
  constructor(private readonly svc: RegistrarService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Find and register a domain: is it open (Pro) or a locked preview, my identity check, and the extensions that have an approved price' })
  overview(@Tenant() t: TenantContext) { return this.svc.overview(t.vendorId); }

  @Throttle(RATE.domainVerify) @Get('search')
  @ApiOperation({ summary: 'Search a name across the extensions on sale: availability and price from the registrar (a real read-only call, off until staff switch it on)' })
  search(@Tenant() t: TenantContext, @Query() q: SearchQuery) { return this.svc.search(t.vendorId, q.name); }

  @Post('quote') @HttpCode(200)
  @ApiOperation({ summary: 'The exact price of registering a name: cost plus approved margin, GST as its own line, the total that would be held and charged' })
  quote(@Tenant() t: TenantContext, @Body() dto: QuoteDto) { return this.svc.quote(t.vendorId, dto); }

  @Post('purchase') @HttpCode(200)
  @ApiOperation({ summary: 'Register a domain from my wallet (hold, registrar, charge; the hold is released if the registrar fails; the same key never buys twice)' })
  purchase(@Tenant() t: TenantContext, @Body() dto: PurchaseDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.svc.purchase(t.vendorId, dto, { type: 'VENDOR', actor: actor(user, req, 'VENDOR') }); }

  @Post('transfer-quote') @HttpCode(200)
  @ApiOperation({ summary: 'The exact price of moving a domain I already own into the Get4Domain account: transfer cost plus approved margin, GST as its own line' })
  transferQuote(@Tenant() t: TenantContext, @Body() dto: TransferQuoteDto) { return this.svc.transferQuote(t.vendorId, dto.domain, dto.privacy === true); }

  @Post('transfer') @HttpCode(200)
  @ApiOperation({ summary: 'Move a domain in from another registrar (authorisation code, domain unlocked); the price is held from my wallet and charged when the transfer finishes. The code is never stored' })
  transfer(@Tenant() t: TenantContext, @Body() dto: TransferDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.svc.transferIn(t.vendorId, dto, { type: 'VENDOR', actor: actor(user, req, 'VENDOR') }); }

  @Get('orders')
  @ApiOperation({ summary: 'My domain orders, newest first' })
  orders(@Tenant() t: TenantContext, @Query() q: PageQueryDto) { const p = pageArgs(q); return this.svc.ordersForVendor(t.vendorId, p.page, p.pageSize); }

  @Get('orders/:id')
  @ApiOperation({ summary: 'One of my domain orders with its invoice' })
  order(@Tenant() t: TenantContext, @Param('id') id: string) { return this.svc.orderForVendor(t.vendorId, id); }

  @Get('registered')
  @ApiOperation({ summary: 'My registered domains with their expiry' })
  registered(@Tenant() t: TenantContext) { return this.svc.registeredForVendor(t.vendorId); }

  @Post('registered/:id/renew-quote') @HttpCode(200)
  @ApiOperation({ summary: 'The exact price of renewing one of my domains (before it expires)' })
  renewQuote(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: RenewQuoteDto) { return this.svc.renewQuote(t.vendorId, id, dto.years); }

  @Post('registered/:id/renew') @HttpCode(200)
  @ApiOperation({ summary: 'Renew one of my domains from my wallet; only before it expires' })
  renew(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: RenewDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.svc.renew(t.vendorId, id, dto, { type: 'VENDOR', actor: actor(user, req, 'VENDOR') }); }
}

/** The vendor's identity check for domain buying. OWNER ONLY. The document is never returned to the vendor. */
@ApiTags('v3-identity')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/identity')
export class MeIdentityController {
  constructor(private readonly id: IdentityService) {}

  @Get() @ApiOperation({ summary: 'My identity check: status, what is verified, the kind of document on file (never the document)' })
  mine(@Tenant() t: TenantContext) { return this.id.mine(t.vendorId); }

  @Put('details') @HttpCode(200) @ApiOperation({ summary: 'Save the registrant details (name, business, email, phone, postal address); an Aadhaar number is refused' })
  details(@Tenant() t: TenantContext, @Body() dto: DetailsDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.id.saveDetails(t.vendorId, dto, actor(user, req, 'VENDOR')); }

  @Throttle(RATE.domainVerify) @Post('otp') @HttpCode(200) @ApiOperation({ summary: 'Send a one-time code to my email or phone' })
  otp(@Tenant() t: TenantContext, @Body() dto: OtpDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.id.sendOtp(t.vendorId, dto.channel, actor(user, req, 'VENDOR')); }

  @Throttle(RATE.domainVerify) @Post('otp/verify') @HttpCode(200) @ApiOperation({ summary: 'Check the one-time code' })
  verify(@Tenant() t: TenantContext, @Body() dto: OtpVerifyDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.id.verifyOtp(t.vendorId, dto.channel, dto.code, actor(user, req, 'VENDOR')); }

  @Put('document') @HttpCode(200) @ApiOperation({ summary: 'Add one government document (PAN, GST certificate, Udyam, business registration, or a masked Aadhaar copy with its last four digits); stored encrypted' })
  document(@Tenant() t: TenantContext, @Body() dto: DocumentDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.id.uploadDocument(t.vendorId, dto, actor(user, req, 'VENDOR')); }

  @Post('submit') @HttpCode(200) @ApiOperation({ summary: 'Send my check for review' })
  submit(@Tenant() t: TenantContext, @Body() dto: SubmitDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.id.submit(t.vendorId, dto.consent, actor(user, req, 'VENDOR')); }
}

/** Staff: OPERATIONS and SUPER_ADMIN (MARKETING refused everywhere here: personal data and money). Approving or rejecting a price is SUPER_ADMIN only. */
@ApiTags('v3-domain-sales-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminRegistrarController {
  constructor(private readonly svc: RegistrarService, private readonly id: IdentityService) {}

  @Get('domain-orders') @ApiOperation({ summary: 'The domain sales list: every order, newest first; filter by vendor, status and kind' })
  orders(@Query() q: OrderListQuery) { const p = pageArgs(q); return this.svc.ordersForStaff({ vendorId: q.vendorId, status: q.status, kind: q.kind }, p.page, p.pageSize); }

  @Post('vendors/:id/domains/register') @HttpCode(200)
  @ApiOperation({ summary: 'Register a domain on behalf of a vendor, from the vendor\'s own wallet (a reason is required; the vendor must be Pro with an approved identity)' })
  onBehalf(@Param('id') id: string, @Body() dto: OnBehalfDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.svc.purchase(id, dto, { type: 'STAFF', actor: actor(user, req, 'STAFF'), reason: dto.reason }); }

  @Get('domain-margins') @ApiOperation({ summary: 'The price book of domain margins, with the privacy protection price under "privacy"' })
  margins() { return this.svc.margins(); }
  @Post('domain-margins') @HttpCode(200) @ApiOperation({ summary: 'Propose a margin (a percentage in basis points or a fixed amount in paise) for an extension' })
  propose(@Body() dto: ProposeMarginDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.svc.proposeMargin(dto, actor(user, req, 'STAFF')); }
  @Post('domain-margins/:id/approve') @HttpCode(200) @ApiOperation({ summary: 'Approve a proposed margin with an effective date (SUPER_ADMIN only)' })
  approve(@Param('id') id: string, @Body() dto: ApproveMarginDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.svc.approveMargin(id, dto.effectiveFrom, actor(user, req, 'STAFF')); }
  @Post('domain-margins/:id/reject') @HttpCode(200) @ApiOperation({ summary: 'Reject a proposed margin (SUPER_ADMIN only)' })
  reject(@Param('id') id: string) { return this.svc.rejectMargin(id); }

  @Post('registrar/recover') @HttpCode(200) @ApiOperation({ summary: 'Settle orders left unfinished for longer than the given minutes (a crash or an unsure registrar answer)' })
  recover(@Body() dto: RecoverDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.svc.recover(dto.olderThanMinutes, actor(user, req, 'STAFF')); }
  @Post('registrar/reconcile') @HttpCode(200) @ApiOperation({ summary: 'Compare our orders and domains with the registrar now (the daily job does the same)' })
  reconcile(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.svc.reconcile(actor(user, req, 'STAFF')); }
  @Get('registrar/runs') @ApiOperation({ summary: 'The latest reconciliation runs and what they found' })
  runs() { return this.svc.runs(); }

  @Get('identity-checks') @ApiOperation({ summary: 'Identity checks waiting for review, oldest first' })
  queue(@Query() q: IdentityQueueQuery) { const p = pageArgs(q); return this.id.queue(q.status ?? 'IN_REVIEW', p.page, p.pageSize); }
  @Get('vendors/:id/identity') @ApiOperation({ summary: 'One vendor\'s identity check and its access log (never the document)' })
  identity(@Param('id') id: string) { return this.id.forStaff(id); }
  @Post('vendors/:id/identity/document') @HttpCode(200) @ApiOperation({ summary: 'Open the identity document (a reason is required and the access is logged first)' })
  document(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthenticatedUser) { return this.id.openDocument(id, staffOf(user), dto.reason); }
  @Post('vendors/:id/identity/approve') @HttpCode(200) @ApiOperation({ summary: 'Approve an identity check' })
  approveIdentity(@Param('id') id: string, @Body() dto: DecisionDto, @CurrentUser() user: AuthenticatedUser) { return this.id.decide(id, staffOf(user), 'APPROVED', dto.note ?? ''); }
  @Post('vendors/:id/identity/reject') @HttpCode(200) @ApiOperation({ summary: 'Reject an identity check (a reason the vendor will see is required)' })
  rejectIdentity(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthenticatedUser) { return this.id.decide(id, staffOf(user), 'REJECTED', dto.reason); }
}
