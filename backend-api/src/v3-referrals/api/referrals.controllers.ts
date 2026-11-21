import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Request, Response } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { PartnerGuard } from '../../v3-partners/partner.guard';
import { PartnersService } from '../../v3-partners/partners.service';
import { partnerError } from '../../v3-partners/partners.errors';
import { ReferralsService, StaffActor } from '../referrals.service';

const staff = (u: AuthenticatedUser, req: Request): StaffActor => ({ id: u?.sub ?? null, ip: req?.ip ?? null });

/** Loose on purpose: the real checks (ranges, whole paise, dates, overlap) are in the pure core, so every refusal carries a registered code and names what to fix. */
export class SlabDto {
  @IsOptional() minVendors?: unknown;
  @IsOptional() maxVendors?: unknown;
  @IsOptional() amountPerVendorMinor?: unknown;
  @IsOptional() effectiveFrom?: unknown;
}
export class PayoutDto { @IsOptional() partnerId?: unknown; @IsOptional() month?: unknown; @IsOptional() reference?: unknown; /** Wave 4 W8: the TDS amount in paise when the pre-filled one is changed, and the reason that then becomes required */ @IsOptional() tdsMinor?: unknown; @IsOptional() tdsReason?: unknown }
export class PayoutPreviewDto { @IsOptional() @IsString() @MaxLength(64) partnerId?: string; @IsOptional() @IsString() @MaxLength(7) month?: string }
export class AttributionDto { @IsOptional() partnerId?: unknown; @IsOptional() reason?: unknown }
export class LedgerQueryDto {
  @IsOptional() @IsString() @MaxLength(7) month?: string;
  @IsOptional() @IsString() @MaxLength(64) partnerId?: string;
  @IsOptional() @IsIn(['ACCRUED', 'APPROVED', 'PAID', 'REVERSED']) status?: 'ACCRUED' | 'APPROVED' | 'PAID' | 'REVERSED';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() entityId?: string;
}
export class PartnerPageDto { @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number; @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number; @IsOptional() @IsString() entityType?: string; @IsOptional() @IsString() entityId?: string }

/** Staff side of referrals and commission. WHO may call each route is DATA in admin-role-matrix.ts: reads are OPERATIONS, ADMIN and SUPER_ADMIN; writes are ADMIN and SUPER_ADMIN; SALES, SUPPORT and the labels are refused. Writes are audited. */
@ApiTags('v3-referrals-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('partners/:id/links') @ApiOperation({ summary: 'The referral links (codes) of a partner, newest first' })
  links(@Param('id') id: string) { return this.referrals.linksOf(id); }

  @Post('partners/:id/links') @HttpCode(200) @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN, audited: issue a new referral code for a partner (a disabled partner cannot be given one)' })
  issue(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.referrals.issueLink(id, staff(u, req)); }

  @Post('referral-links/:id/disable') @HttpCode(200) @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN, audited: disable a referral code. It then resolves as invalid; attributions already made stay.' })
  disable(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.referrals.disableLink(id, staff(u, req)); }

  @Get('commission/slabs') @ApiOperation({ summary: 'The commission slab rows (the system ships with none)' })
  slabs() { return this.referrals.slabs(); }

  @Post('commission/slabs') @HttpCode(200) @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN, audited: add a slab row: from how many vendors, up to how many (empty = and above), the amount per vendor in paise, and the date it takes effect' })
  addSlab(@Body() dto: SlabDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.referrals.addSlab({ minVendors: dto.minVendors, maxVendors: dto.maxVendors, amountPerVendorMinor: dto.amountPerVendorMinor, effectiveFrom: dto.effectiveFrom }, staff(u, req)); }

  @Put('commission/slabs/:id') @HttpCode(200) @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN, audited: edit a slab row (refused once a closed month may have used it: add a row with a later date instead)' })
  editSlab(@Param('id') id: string, @Body() dto: SlabDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.referrals.editSlab(id, dto, staff(u, req)); }

  @Post('commission/months/:month/close') @HttpCode(200) @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN, audited: close a month (2026-11). Each partner\'s count picks its slab row and its lines get the amount. Safe to repeat. With no slab rows nothing accrues and the answer says so.' })
  close(@Param('month') month: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.referrals.closeMonth(month, staff(u, req)); }

  @Get('commission/ledger') @ApiOperation({ summary: 'The commission ledger, newest month first; filter by month, partner or status' })
  async ledger(@Query() q: LedgerQueryDto) { const a = pageArgs(q); const r = await this.referrals.ledger({ month: q.month, partnerId: q.partnerId, status: q.status, skip: a.skip, take: a.take }); return paged(r.items, r.total, a.page, a.pageSize); }

  @Get('commission/ledger/export.csv') @ApiOperation({ summary: 'The commission ledger as CSV (a typed formula is defused so a spreadsheet never runs it)' })
  async exportCsv(@Query() q: LedgerQueryDto, @Res({ passthrough: true }) res: Response): Promise<string> {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="commission-ledger.csv"'); res.setHeader('Cache-Control', 'private, no-store');
    return this.referrals.exportCsv({ month: q.month, partnerId: q.partnerId, status: q.status });
  }

  @Post('commission/payouts') @HttpCode(200) @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN, audited: record a payout made by bank or UPI (the reference is required). The month must be closed; one payout per partner and month. No money moves from here and no tax is computed.' })
  payout(@Body() dto: PayoutDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.referrals.recordPayout({ partnerId: String(dto.partnerId ?? ''), month: String(dto.month ?? ''), reference: dto.reference, tdsMinor: dto.tdsMinor, tdsReason: dto.tdsReason }, staff(u, req)); }

  @Get('commission/payouts/preview') @ApiOperation({ summary: 'What recording a payout would do, to pre-fill the screen: gross, the TDS percent in force (empty until the owner sets it), the pre-filled TDS, the net, and whether a PAN is on record (never the PAN). Changes nothing.' })
  preview(@Query() q: PayoutPreviewDto) { return this.referrals.previewPayout({ partnerId: String(q.partnerId ?? ''), month: String(q.month ?? '') }); }

  @Get('commission/payouts/export.csv') @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN: the payouts as CSV with gross, TDS and net, the percent, whether the TDS was changed and why, and the partner PAN (a typed formula is defused)' })
  async payoutsCsv(@Query() q: PayoutPreviewDto, @Res({ passthrough: true }) res: Response): Promise<string> {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="commission-payouts.csv"'); res.setHeader('Cache-Control', 'private, no-store');
    return this.referrals.payoutsCsv({ partnerId: q.partnerId, month: q.month });
  }

  @Get('commission/payouts') @ApiOperation({ summary: 'The recorded payouts, newest first, each with gross, TDS and net' })
  async payouts(@Query() q: LedgerQueryDto) { const a = pageArgs(q); const r = await this.referrals.payouts({ partnerId: q.partnerId, month: q.month, skip: a.skip, take: a.take }); return paged(r.items, r.total, a.page, a.pageSize); }

  @Get('vendors/:id/referral') @ApiOperation({ summary: 'Who referred this business (for the vendor detail): the partner name and type, the source and the code, or null' })
  async source(@Param('id') id: string) { return { referral: await this.referrals.sourceOf(id) }; }

  @Put('vendors/:id/referral') @HttpCode(200) @ApiOperation({ summary: 'ADMIN or SUPER_ADMIN, audited: set who referred a business that has no referrer yet (a business created on behalf). A business that already has one is refused (REFERRAL_ATTRIBUTION_EXISTS).' })
  setSource(@Param('id') id: string, @Body() dto: AttributionDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.referrals.setAttribution(id, String(dto.partnerId ?? ''), typeof dto.reason === 'string' ? dto.reason : undefined, staff(u, req)); }

  @Post('vendors/:id/referral/change') @HttpCode(200) @ApiOperation({ summary: 'SUPER_ADMIN only, audited with the before and the after: change the referrer of a business that has one. A reason is required.' })
  changeSource(@Param('id') id: string, @Body() dto: AttributionDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.referrals.changeAttribution(id, String(dto.partnerId ?? ''), typeof dto.reason === 'string' ? dto.reason : undefined, staff(u, req)); }
}

/** The partner's own area under /v3/partner/*: their code, the businesses they referred (name and state only), their commission and their payouts. Every route reads the signed-in partner only. */
@ApiTags('v3-partner')
@ApiBearerAuth()
@UseGuards(PartnerGuard)
@Controller('v3/partner')
export class PartnerReferralsController {
  constructor(private readonly referrals: ReferralsService, private readonly partners: PartnersService) {}

  private async me(u: AuthenticatedUser): Promise<string> {
    const p = await this.partners.forLogin(u.sub);
    if (!p) throw partnerError(404, 'PARTNER_NOT_FOUND', 'This login is not linked to an active partner.');
    return p.id;
  }

  @Get('link') @ApiOperation({ summary: 'My referral code(s) to share' })
  async link(@CurrentUser() u: AuthenticatedUser) { return { codes: await this.referrals.myLinks(await this.me(u)) }; }

  @Get('vendors') @ApiOperation({ summary: 'The businesses I referred: business name, state and the day only, no contact details' })
  async vendors(@CurrentUser() u: AuthenticatedUser, @Query() q: PartnerPageDto) { const a = pageArgs(q); const r = await this.referrals.myVendors(await this.me(u), a.skip, a.take); return paged(r.items, r.total, a.page, a.pageSize); }

  @Get('commission') @ApiOperation({ summary: 'My commission lines: month, business name, status, amount' })
  async commission(@CurrentUser() u: AuthenticatedUser, @Query() q: PartnerPageDto) { const a = pageArgs(q); const r = await this.referrals.myCommission(await this.me(u), a.skip, a.take); return paged(r.items, r.total, a.page, a.pageSize); }

  @Get('payouts') @ApiOperation({ summary: 'My recorded payouts: month, gross, TDS, net, reference, day' })
  async payouts(@CurrentUser() u: AuthenticatedUser, @Query() q: PartnerPageDto) { const a = pageArgs(q); const r = await this.referrals.myPayouts(await this.me(u), a.skip, a.take); return paged(r.items, r.total, a.page, a.pageSize); }
}

/** The public check of a referral code (Wave 3 Part I): valid or not, and the NAME of the source. Nothing else. Never cached. */
@ApiTags('v3-referral-public')
@Controller('v3/public/referral')
export class PublicReferralController {
  constructor(private readonly referrals: ReferralsService) {}

  @Public() @Throttle(RATE.directoryRead)
  @Get(':code') @ApiOperation({ summary: 'Is this referral code valid, and who is the source (its display name only; no personal data)' })
  async resolve(@Param('code') code: string, @Res({ passthrough: true }) res: Response) { res.set('Cache-Control', 'no-store'); return this.referrals.resolveCode(code); }
}
