import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf, pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { SeededSitesService, StaffRole } from '../seeded-sites.service';
import { SeededSettingsService } from '../seeded-settings.service';
import { BatchDto, CallDto, ConsentDto, CreateSeededDto, IndexingModeDto, OutreachDto, ReasonDto, RegisterAddDto, RegisterListDto, SeededListDto } from './dto/seeded.dto';

const role = (u: AuthenticatedUser): StaffRole => (u?.adminRole as StaffRole) ?? 'MARKETING';

/**
 * Staff API for seeded sites (slice 5.13a). SUPER_ADMIN and OPERATIONS read and write. MARKETING may only READ the list and one site, and only the non-personal fields (the service redacts
 * for it). The register and the claim links are OPERATIONS and SUPER_ADMIN only. The indexing mode is SUPER_ADMIN only and needs a reason. There are no public routes in this slice.
 */
@ApiTags('v3-seeded-sites-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/seeded-sites')
export class SeededAdminController {
  constructor(private readonly seeded: SeededSitesService, private readonly settings: SeededSettingsService) {}
  private who(u: AuthenticatedUser, req: Request) { return { actor: actorOf(u, req), role: role(u) }; }

  @Get() @ApiOperation({ summary: 'Seeded sites, newest first (MARKETING: non-personal fields only)' })
  async list(@Query() q: SeededListDto, @CurrentUser() user: AuthenticatedUser) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const r = await this.seeded.list({ lifecycle: q.lifecycle, outreachStatus: q.outreachStatus, batchId: q.batchId, q: q.q, skip, take }, role(user));
    return paged(r.items, r.total, page, pageSize);
  }

  @Post() @HttpCode(200) @ApiOperation({ summary: 'Create one seeded Free site from public facts (the staff checkbox is required)' })
  create(@Body() dto: CreateSeededDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { const { overrideReason, ...raw } = dto; return this.seeded.create(raw as unknown as Record<string, unknown>, this.who(user, req), { overrideReason }); }

  @Post('batches/dry-run') @HttpCode(200) @ApiOperation({ summary: 'Validate a CSV batch and report duplicates; creates NO site' })
  dryRun(@Body() dto: BatchDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.seeded.batch(dto.csv, dto.fileName ?? 'batch.csv', 'DRY_RUN', this.who(user, req), dto.overrideReason); }

  @Post('batches/apply') @HttpCode(200) @ApiOperation({ summary: 'Create the sites of a CSV batch that pass validation' })
  apply(@Body() dto: BatchDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.seeded.batch(dto.csv, dto.fileName ?? 'batch.csv', 'APPLIED', this.who(user, req), dto.overrideReason); }

  @Get('register') @ApiOperation({ summary: 'The do-not-contact register (hash prefixes only; OPERATIONS and SUPER_ADMIN)' })
  async register(@Query() q: RegisterListDto) { const { skip, take, page, pageSize } = pageArgs(q); const r = await this.seeded.readRegister(skip, take); return paged(r.items, r.total, page, pageSize); }

  @Post('register') @HttpCode(200) @ApiOperation({ summary: 'Add a phone to the do-not-contact register (stored as a keyed hash; never removed)' })
  addRegister(@Body() dto: RegisterAddDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.seeded.addToRegister(dto.phone, dto.reason, this.who(user, req)); }

  @Get('indexing-mode') @ApiOperation({ summary: 'The seeded-site indexing mode (OFF or QUALITY)' })
  mode() { return this.settings.mode(); }

  @Put('indexing-mode') @HttpCode(200) @ApiOperation({ summary: 'Change the seeded-site indexing mode (SUPER_ADMIN only, reason required, audited)' })
  setMode(@Body() dto: IndexingModeDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.settings.setMode(dto.mode, dto.reason, actorOf(user, req)); }

  @Get(':id') @ApiOperation({ summary: 'One seeded site (MARKETING: non-personal fields only)' })
  one(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.seeded.get(id, role(user)); }

  @Put(':id/outreach') @HttpCode(200) @ApiOperation({ summary: 'Update outreach status, owner and next follow-up; do-not-contact removes the site' })
  outreach(@Param('id') id: string, @Body() dto: OutreachDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.seeded.updateOutreach(id, dto, this.who(user, req)); }

  @Post(':id/calls') @HttpCode(200) @ApiOperation({ summary: 'Log a call' })
  call(@Param('id') id: string, @Body() dto: CallDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.seeded.logCall(id, dto, this.who(user, req)); }

  @Put(':id/consent') @HttpCode(200) @ApiOperation({ summary: 'Record (or withdraw) that the owner agreed to be contacted; needed before a claim link' })
  consent(@Param('id') id: string, @Body() dto: ConsentDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.seeded.setConsent(id, dto.agreed, this.who(user, req)); }

  @Post(':id/claim-link') @HttpCode(200) @ApiOperation({ summary: 'Issue a claim link (consent required, not on the register). Shown once; nothing is sent.' })
  issue(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.seeded.issueClaimLink(id, this.who(user, req)); }

  @Post(':id/claim-link/revoke') @HttpCode(200) @ApiOperation({ summary: 'Revoke the active claim link' })
  revoke(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.seeded.revokeClaimLink(id, this.who(user, req)); }

  @Post(':id/removal') @HttpCode(200) @ApiOperation({ summary: 'Execute a removal now: hidden, noindex, kept in the audit trail, phone added to the register. Permanent.' })
  remove(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.seeded.remove(id, dto.reason, this.who(user, req)); }
}
