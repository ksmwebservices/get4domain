import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { staffRoleOf } from '../../auth/guards/staff-access';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { RATE } from '../../common/throttling';
import { BlocklistService, ProofsService, ReportsService, StaffBy, TakedownService, TermsService } from '../trust.service';
import {
  BlockListDto, CreateBlockDto, CreateTakedownDto, CreateTermDto, ProofListDto, ReportBusinessDto, ReportListDto, ReverseTakedownDto, ReviewProofDto, SubmitProofDto, TakedownListDto, TrustPageDto, UpdateReportDto,
  UpdateTermDto,
} from './dto/trust.dto';

const page = (q: TrustPageDto): { page: number; pageSize: number } => ({ page: q.page ?? 1, pageSize: q.pageSize ?? 25 });
const id64 = (v: string): string => String(v).slice(0, 64);
const by = (u: AuthenticatedUser, req: Request): StaffBy => ({ id: u?.sub ?? null, ip: req?.ip ?? null, role: staffRoleOf(u) ?? null });

/** Anyone may report a business. No sign-in, no personal data required, one answer whatever happened (a report is never a way to learn what exists), rate limited per address. */
@ApiTags('v3-trust-public')
@Controller('v3/public')
export class PublicReportController {
  constructor(private readonly reports: ReportsService) {}

  @Public() @Throttle(RATE.reportSubmit)
  @Post('report-business') @HttpCode(202)
  @ApiOperation({ summary: 'Report a listing or a site. Always answers the same; nothing is revealed about what exists.' })
  async report(@Body() dto: ReportBusinessDto, @Req() req: Request): Promise<{ received: true }> {
    await this.reports.submit({ subjectType: dto.subjectType, subject: dto.subject, reason: dto.reason, contact: dto.contact }, req.ip ?? null);
    return { received: true };
  }
}

/** The signed-in OWNER's side: offer a business proof, read their own proofs, and read their own takedown notice (with the reason). The vendor is always the verified principal's vendor. */
@ApiTags('v3-trust')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me')
export class MeTrustController {
  constructor(private readonly proofs: ProofsService, private readonly takedowns: TakedownService) {}

  @Post('business-proof') @HttpCode(200) @ApiOperation({ summary: 'Offer a business proof (GST, Udyam, shop licence, professional registration or other). Optional; sending it again replaces it.' })
  submit(@Tenant() t: TenantContext, @Body() dto: SubmitProofDto) { return this.proofs.submit(t.vendorId, dto); }

  @Get('business-proofs') @ApiOperation({ summary: 'My business proofs and what staff made of them' })
  mine(@Tenant() t: TenantContext) { return this.proofs.mine(t.vendorId); }

  @Get('takedown') @ApiOperation({ summary: 'Whether a legal takedown is in force on my business, and the written reason' })
  takedown(@Tenant() t: TenantContext) { return this.takedowns.mine(t.vendorId); }
}

/**
 * Staff side of trust and safety. OPERATIONS and SUPER_ADMIN work reports, proofs and the block list (MARKETING is refused: they carry personal data). The prohibited-phrase table and the takedowns
 * (create and reverse) are SUPER_ADMIN only; the service checks the role again, and a written reason is always required.
 */
@ApiTags('v3-trust-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminTrustController {
  constructor(private readonly proofs: ProofsService, private readonly blocks: BlocklistService, private readonly reports: ReportsService, private readonly terms: TermsService, private readonly takedowns: TakedownService) {}

  @Get('business-reports') @ApiOperation({ summary: 'Reports from the public, newest first (contact masked)' })
  reportList(@Query() q: ReportListDto) { const p = page(q); return this.reports.list({ status: q.status }, p.page, p.pageSize); }

  @Patch('business-reports/:id') @HttpCode(200) @ApiOperation({ summary: 'Move a report (NEW, LOOKING, CLOSED) or add a note; refused if it changed since it was read' })
  reportUpdate(@Param('id') id: string, @Body() dto: UpdateReportDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.reports.update(id64(id), by(u, req), dto); }

  @Get('trust-blocklist') @ApiOperation({ summary: 'The trust block list (values are kept as hashes and never shown)' })
  blockList(@Query() q: BlockListDto) { const p = page(q); return this.blocks.list({ kind: q.kind }, p.page, p.pageSize); }

  @Post('trust-blocklist') @HttpCode(201) @ApiOperation({ summary: 'Add a phone, e-mail, domain, UPI handle or name to the block list, with a reason' })
  blockAdd(@Body() dto: CreateBlockDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.blocks.add(by(u, req), dto); }

  @Delete('trust-blocklist/:id') @HttpCode(200) @ApiOperation({ summary: 'Take an entry off the block list' })
  async blockRemove(@Param('id') id: string): Promise<{ removed: true }> { await this.blocks.remove(id64(id)); return { removed: true }; }

  @Get('business-proofs') @ApiOperation({ summary: 'Business proofs waiting for a check, or filtered by status or vendor' })
  proofList(@Query() q: ProofListDto) { const p = page(q); return this.proofs.list({ status: q.status, vendorId: q.vendorId }, p.page, p.pageSize); }

  @Patch('business-proofs/:id') @HttpCode(200) @ApiOperation({ summary: 'Mark a proof CHECKED or MISMATCH (refused if it changed since it was read). A mismatch blocks nothing.' })
  proofReview(@Param('id') id: string, @Body() dto: ReviewProofDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.proofs.review(id64(id), by(u, req), dto); }

  @Get('prohibited-terms') @ApiOperation({ summary: 'The prohibited phrases the scan looks for (SUPER_ADMIN)' })
  termList() { return this.terms.list(); }

  @Post('prohibited-terms') @HttpCode(201) @ApiOperation({ summary: 'Add a prohibited phrase (SUPER_ADMIN)' })
  termAdd(@Body() dto: CreateTermDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.terms.create(by(u, req), dto); }

  @Put('prohibited-terms/:id') @HttpCode(200) @ApiOperation({ summary: 'Change a prohibited phrase, its category or its on switch (SUPER_ADMIN)' })
  termUpdate(@Param('id') id: string, @Body() dto: UpdateTermDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.terms.update(id64(id), by(u, req), dto); }

  @Delete('prohibited-terms/:id') @HttpCode(200) @ApiOperation({ summary: 'Remove a prohibited phrase (SUPER_ADMIN)' })
  async termRemove(@Param('id') id: string): Promise<{ removed: true }> { await this.terms.remove(id64(id)); return { removed: true }; }

  @Get('takedowns') @ApiOperation({ summary: 'Legal takedowns, newest first' })
  takedownList(@Query() q: TakedownListDto) { const p = page(q); return this.takedowns.list({ status: q.status, vendorId: q.vendorId }, p.page, p.pageSize); }

  @Post('takedowns') @HttpCode(201) @ApiOperation({ summary: 'Legal takedown of a business (SUPER_ADMIN, written reason required): the site serves a plain notice and the listing leaves the directory' })
  takedownCreate(@Body() dto: CreateTakedownDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.takedowns.create(by(u, req), dto); }

  @Post('takedowns/:id/reverse') @HttpCode(200) @ApiOperation({ summary: 'Reverse a takedown (SUPER_ADMIN, written reason required): the notice ends and the listing returns as it was' })
  takedownReverse(@Param('id') id: string, @Body() dto: ReverseTakedownDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.takedowns.reverse(id64(id), by(u, req), dto); }
}
