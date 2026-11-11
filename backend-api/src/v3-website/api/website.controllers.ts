import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { Actor } from '../../plans/admin/audit.service';
import { ReviewService } from '../review/review.service';
import { SeoService } from '../seo/seo.service';
import { WebsiteService } from '../website.service';
import { CompareRevisionsQuery, DraftBrandDto, DraftFieldDto, DraftListDto, DraftNavigationDto, DraftSectionsDto, RestoreRevisionDto } from './dto/website.dto';

/**
 * The signed-in vendor's Website manager (slice 5.5). The vendor is ALWAYS the verified principal's vendor (@UseTenant): there is no vendor id in the URL, query or
 * body. Team members with the `website` area edit the draft; publishing and restoring change what the public sees, so they are owner only. A Free vendor's publish
 * becomes a review submission (slice 5.5c). Responses use the standard envelope added by the global interceptor.
 */
@ApiTags('v3-website')
@ApiBearerAuth()
@UseTenant()
@RequireModule('website')
@Controller('v3/me/site')
export class MeWebsiteController {
  constructor(private readonly web: WebsiteService, private readonly reviews: ReviewService, private readonly seo: SeoService) {}

  private actor(user: AuthenticatedUser, req: Request): Actor { return { type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null }; }

  @Get('editor/map')
  @ApiOperation({ summary: 'What I can edit: the pages and sections of my theme, the typed fields, the plan limits and whether my plan is Pro' })
  editor(@Tenant() t: TenantContext) { return this.web.editor(t.vendorId); }

  @Get('draft')
  @ApiOperation({ summary: 'My draft: every edit I have made that is not live yet' })
  draft(@Tenant() t: TenantContext) { return this.web.draft(t.vendorId); }

  @Put('draft/field') @HttpCode(200)
  @ApiOperation({ summary: 'Autosave one text, link or image field of a page (locked SEO and markup fields are refused)' })
  field(@Tenant() t: TenantContext, @Body() dto: DraftFieldDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.web.save(t.vendorId, this.actor(user, req), { kind: 'field', key: dto.key, value: dto.value });
  }

  @Put('draft/list/:name') @HttpCode(200)
  @ApiOperation({ summary: 'Save one list of a page: questions, gallery, steps, why choose us, numbers, team, credentials or extra pages' })
  list(@Tenant() t: TenantContext, @Param('name') name: string, @Body() dto: DraftListDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.web.save(t.vendorId, this.actor(user, req), { kind: 'list', name, items: dto.items });
  }

  @Put('draft/sections') @HttpCode(200)
  @ApiOperation({ summary: 'Show, hide and reorder sections (the top banner cannot be hidden)' })
  sections(@Tenant() t: TenantContext, @Body() dto: DraftSectionsDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.web.save(t.vendorId, this.actor(user, req), { kind: 'sections', value: { hidden: dto.hidden, order: dto.order } });
  }

  @Put('draft/brand') @HttpCode(200)
  @ApiOperation({ summary: 'Brand within the theme: accent colours, fonts from the theme list and the logo' })
  brand(@Tenant() t: TenantContext, @Body() dto: DraftBrandDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.web.save(t.vendorId, this.actor(user, req), { kind: 'brand', value: dto.brand });
  }

  @Put('draft/navigation') @HttpCode(200)
  @ApiOperation({ summary: 'Header and footer menus: order, wording and show or hide' })
  navigation(@Tenant() t: TenantContext, @Body() dto: DraftNavigationDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.web.save(t.vendorId, this.actor(user, req), { kind: 'navigation', value: { header: dto.header, footer: dto.footer } });
  }

  @Get('seo')
  @ApiOperation({ summary: 'My pages with their search-result title and description (the default until I write my own), the limits, and the slug of each page' })
  seoView(@Tenant() t: TenantContext) { return this.seo.view(t.vendorId); }

  @Put('draft/seo/:pageKey') @HttpCode(200)
  @ApiOperation({ summary: 'Autosave one page\'s search-result title, description and share picture (the slug and every platform-written part are locked)' })
  seoSave(@Tenant() t: TenantContext, @Param('pageKey') pageKey: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.web.save(t.vendorId, this.actor(user, req), { kind: 'seo', pageKey, edit: body });
  }

  @Delete('draft') @HttpCode(200)
  @ApiOperation({ summary: 'Throw my draft away and start again from what is live' })
  discard(@Tenant() t: TenantContext) { return this.web.discard(t.vendorId); }

  @Post('draft/preview') @HttpCode(200)
  @ApiOperation({ summary: 'Build a preview of my whole site from my draft (nothing goes live; open it with the preview route)' })
  preview(@Tenant() t: TenantContext, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.web.preview(t.vendorId, this.actor(user, req)); }

  @UseGuards(VendorOwnerGuard)
  @Post('draft/publish') @HttpCode(200)
  @ApiOperation({ summary: 'Publish my draft (owner only). Pro goes live at once; Free is sent to our team for review (mode SUBMITTED)' })
  publish(@Tenant() t: TenantContext, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.reviews.publishOrSubmit(t.vendorId, this.actor(user, req)); }

  @Get('submissions')
  @ApiOperation({ summary: 'My submissions for review, newest first, with their decision and the reason when one was rejected' })
  submissions(@Tenant() t: TenantContext) { return this.reviews.mine(t.vendorId); }

  @Get('submissions/:id')
  @ApiOperation({ summary: 'One of my submissions' })
  submission(@Tenant() t: TenantContext, @Param('id') id: string) { return this.reviews.mineOne(t.vendorId, id); }

  @Get('revisions')
  @ApiOperation({ summary: 'My earlier versions of the site' })
  revisions(@Tenant() t: TenantContext) { return this.web.revisions(t.vendorId); }

  @Get('revisions/compare')
  @ApiOperation({ summary: 'What differs between two versions' })
  compare(@Tenant() t: TenantContext, @Query() q: CompareRevisionsQuery) { return this.web.compare(t.vendorId, q.from, q.to); }

  @UseGuards(VendorOwnerGuard)
  @Post('revisions/restore') @HttpCode(200)
  @ApiOperation({ summary: 'Go back to an earlier version as a new version (owner only; needs version history on the plan)' })
  restore(@Tenant() t: TenantContext, @Body() dto: RestoreRevisionDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.web.restore(t.vendorId, dto.toVersion, this.actor(user, req));
  }
}
