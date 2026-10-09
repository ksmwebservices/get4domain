import { Body, Controller, Get, Header, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { RATE } from '../common/throttling';
import { LeadspaceStaffGuard } from './staff.guard';
import { PromotionToggleDto, RegulatedReviewDto, ReportActionDto, ReportPageDto, SavePageDto, SuspendDto, TrackDto, VerifyPhoneConfirmDto, VerifyPhoneRequestDto } from './leadspace.dto';
import { LeadspaceProfileService } from './profile.service';
import { PageModel } from './page-builder';

/** Public: the page itself, funnel beacons, abuse reports, the sitemap and the product feed. Nothing here needs a login and nothing private is returned. */
@ApiTags('leadspace-public')
@Public()
@Controller('leadspace/public')
export class LeadspacePagesPublicController {
  constructor(private readonly pages: LeadspaceProfileService) {}

  @Get('page/:slug')
  @ApiOperation({ summary: "The page model a LeadSpace page is rendered from (blocks, form, SEO). The vendor's phone number is never included." })
  page(@Param('slug') slug: string): Promise<PageModel> { return this.pages.publicPage(slug); }

  @Post('track')
  @Throttle(RATE.publicAction)
  @ApiOperation({ summary: 'Count a page view, a button tap or a started form (the top of the funnel)' })
  track(@Body() dto: TrackDto) { return this.pages.track(dto.slug, dto.kind); }

  @Post('report')
  @Throttle(RATE.otpRequest)
  @ApiOperation({ summary: 'Report a page for abuse. Every page links here.' })
  report(@Body() dto: ReportPageDto, @Req() req: Request) { return this.pages.report(dto.slug, dto.reason, dto.note, req.ip); }

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({ summary: 'Sitemap of verified, published pages' })
  sitemap(): Promise<string> { return this.pages.sitemapXml(); }

  @Get('feed/:file')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @ApiOperation({ summary: 'Google Merchant Centre product feed for a product vendor (RSS 2.0)' })
  feed(@Param('file') file: string): Promise<string> { return this.pages.feedXml(file.replace(/\.xml$/i, '')); }
}

/** Vendor: build, edit, publish and verify the page. Scoped to the signed-in vendor. */
@ApiTags('leadspace')
@ApiBearerAuth()
@RequireModule('website')
@Controller('leadspace/page')
export class LeadspacePageVendorController {
  constructor(private readonly pages: LeadspaceProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Page tab: your page, the live preview, what is missing, the embed code and whether promotion is allowed' })
  mine(@CurrentUser() u: AuthenticatedUser) { return this.pages.mine(u.sub); }

  @Post()
  @ApiOperation({ summary: 'Create your page from your company details (name, trade, city; the rest is filled from your site and catalogue)' })
  create(@CurrentUser() u: AuthenticatedUser, @Body() dto: SavePageDto, @Req() req: Request) { return this.pages.create(u.sub, dto, req.ip); }

  @Put()
  @ApiOperation({ summary: 'Save changes to your page' })
  save(@CurrentUser() u: AuthenticatedUser, @Body() dto: SavePageDto) { return this.pages.save(u.sub, dto); }

  @Post('publish')
  @ApiOperation({ summary: 'Put the page live' })
  publish(@CurrentUser() u: AuthenticatedUser) { return this.pages.publish(u.sub); }

  @Post('unpublish')
  @ApiOperation({ summary: 'Take the page down (it can be published again)' })
  unpublish(@CurrentUser() u: AuthenticatedUser) { return this.pages.unpublish(u.sub); }

  @Post('verify-phone/request')
  @Throttle(RATE.otpRequest)
  @ApiOperation({ summary: 'Send a code to your phone to prove it is yours (pages that are not verified are not shown in search or promoted)' })
  verifyRequest(@CurrentUser() u: AuthenticatedUser, @Body() dto: VerifyPhoneRequestDto) { return this.pages.verifyPhoneRequest(u.sub, dto.phone); }

  @Post('verify-phone/confirm')
  @Throttle(RATE.otpVerify)
  @ApiOperation({ summary: 'Confirm the code. This number becomes the one your alerts go to.' })
  verifyConfirm(@CurrentUser() u: AuthenticatedUser, @Body() dto: VerifyPhoneConfirmDto) { return this.pages.verifyPhoneConfirm(u.sub, dto.otpId, dto.phone, dto.code); }

  @Put('promotion')
  @ApiOperation({ summary: "Let Get4Domain promote your page (only when the page is verified and your trade's rules are met)" })
  promotion(@CurrentUser() u: AuthenticatedUser, @Body() dto: PromotionToggleDto) { return this.pages.setPromotion(u.sub, dto.on); }

  @Get('feed')
  @ApiOperation({ summary: 'Product vendors: your Merchant Centre feed address and which items are ready' })
  feed(@CurrentUser() u: AuthenticatedUser) { return this.pages.feedStatus(u.sub); }
}

/** Admin: the page queue, regulated-trade review, suspend and abuse reports. */
@ApiTags('admin-leadspace')
@ApiBearerAuth()
@UseGuards(LeadspaceStaffGuard)
@Controller('admin/leadspace')
export class LeadspacePagesAdminController {
  constructor(private readonly pages: LeadspaceProfileService) {}

  @Get('pages')
  @ApiOperation({ summary: 'Vendor queue: pages with their verification, regulated review and open reports' })
  list(@Query('status') status?: string, @Query('verification') verification?: string, @Query('regulated') regulated?: string, @Query('search') search?: string, @Query('take') take?: string, @Query('skip') skip?: string) {
    return this.pages.adminList({ status, verification, regulated, search, take: take ? Number(take) : undefined, skip: skip ? Number(skip) : undefined });
  }

  @Put('pages/:id/suspend')
  @ApiOperation({ summary: 'Suspend a page (it stops serving, promotion stops)' })
  suspend(@Param('id') id: string, @Body() dto: SuspendDto) { return this.pages.suspend(id, dto.reason); }

  @Put('pages/:id/unsuspend')
  @ApiOperation({ summary: 'Lift a suspension (the page returns as a draft)' })
  unsuspend(@Param('id') id: string) { return this.pages.unsuspend(id); }

  @Put('pages/:id/review')
  @ApiOperation({ summary: 'Regulated trades: approve or refuse the page, and switch promotion on for an advocate or a clinic' })
  review(@Param('id') id: string, @Body() dto: RegulatedReviewDto) { return this.pages.reviewRegulated(id, dto.approve, dto.allowPromotion === true); }

  @Get('reports')
  @ApiOperation({ summary: 'Abuse reports from the public' })
  reports(@Query('status') status?: string) { return this.pages.reports(status ?? 'OPEN'); }

  @Put('reports/:id')
  @ApiOperation({ summary: 'Close a report, optionally suspending the page' })
  action(@Param('id') id: string, @Body() dto: ReportActionDto) { return this.pages.actionReport(id, dto.action, dto.suspendReason); }
}
