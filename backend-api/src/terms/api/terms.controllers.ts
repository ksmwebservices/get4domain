import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { actorOf } from '../../plans/admin/plans-admin.common';
import { TermsService } from '../terms.service';
import { AcceptTermsDto, CreateDraftDto, PublishDto, TermsListDto, UpdateDraftDto } from './dto/terms.dto';

/** The latest PUBLISHED text of each document, for everyone. A kind with nothing published is a plain 404 (a draft is never shown). Cacheable for a few minutes. */
@ApiTags('v3-terms-public')
@Controller('v3/public/terms')
export class PublicTermsController {
  constructor(private readonly terms: TermsService) {}

  @Public() @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get(':kind')
  @ApiOperation({ summary: 'The latest published version of a document (VENDOR_TERMS, ACCEPTABLE_USE, DATA_PROCESSING, REFUND_POLICY_TEMPLATE, GRIEVANCE, PRIVACY, COOKIE, CUSTOMER_TERMS)' })
  async latest(@Param('kind') kind: string, @Res({ passthrough: true }) res: Response) { res.set('Cache-Control', 'public, max-age=300'); return this.terms.latest(String(kind).slice(0, 40)); }

  @Public() @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get(':kind/versions')
  @ApiOperation({ summary: 'The published and retired versions of a document, newest first (no text; drafts are never listed)' })
  async versions(@Param('kind') kind: string, @Res({ passthrough: true }) res: Response) { res.set('Cache-Control', 'public, max-age=300'); return this.terms.versions(String(kind).slice(0, 40)); }
}

/** The signed-in OWNER (a team member is refused). The vendor is ALWAYS the verified principal's vendor. */
@ApiTags('v3-terms-vendor')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/terms')
export class MeTermsController {
  constructor(private readonly terms: TermsService) {}

  @Get()
  @ApiOperation({ summary: 'Which required documents are accepted, which are waiting, and the current version of each' })
  status(@Tenant() t: TenantContext) { return this.terms.status(t.vendorId); }

  @Post('accept') @HttpCode(200)
  @ApiOperation({ summary: 'Accept the CURRENT version of each waiting document (kind and version are named, so a stale screen cannot accept something it did not show)' })
  accept(@Tenant() t: TenantContext, @Body() dto: AcceptTermsDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Headers('user-agent') ua?: string) {
    return this.terms.accept(t.vendorId, user?.sub ?? null, dto.documents, { ip: req?.ip ?? null, userAgent: ua ? String(ua).slice(0, 300) : null }, { type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null });
  }
}

/** Staff API. SUPER_ADMIN only (the role matrix); every change is audited and publishing needs a change note. There is no delete: a draft is changed, a published document is replaced by a new version. */
@ApiTags('v3-terms-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/terms')
export class AdminTermsController {
  constructor(private readonly terms: TermsService) {}

  @Get() @ApiOperation({ summary: 'All documents and versions (no text)' })
  list(@Query() q: TermsListDto) { return this.terms.list(q); }

  @Get(':id') @ApiOperation({ summary: 'One document with its text' })
  get(@Param('id') id: string) { return this.terms.get(id); }

  @Post('kinds/:kind/drafts') @HttpCode(200) @ApiOperation({ summary: 'Start the next version of a document as a draft (the placeholder text when none is given)' })
  create(@Param('kind') kind: string, @Body() dto: CreateDraftDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.terms.createDraft(String(kind).slice(0, 40), dto, actorOf(u, req)); }

  @Put(':id') @ApiOperation({ summary: 'Change a draft (a published document cannot be changed)' })
  update(@Param('id') id: string, @Body() dto: UpdateDraftDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.terms.updateDraft(id, dto, actorOf(u, req)); }

  @Post(':id/publish') @HttpCode(200) @ApiOperation({ summary: 'Publish a draft (a change note is required; the placeholder text is refused; the previous version is retired; vendors are asked to accept again)' })
  publish(@Param('id') id: string, @Body() dto: PublishDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.terms.publish(id, dto.changeNote, actorOf(u, req)); }
}
