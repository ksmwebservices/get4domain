import { Body, Controller, Get, HttpCode, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { Actor } from '../../plans/admin/audit.service';
import { PublishService } from '../publish/publish.service';
import { SiteBuildService } from '../publish/site-build.service';
import { SitePreviewService } from '../publish/site-preview.service';
import { SiteSettingsService, summarise } from '../publish/site-settings.service';
import { BuildSiteDto, PublishSiteDto, RollbackSiteDto, SetThemeDto } from './dto/site.dto';
import { previewHeaders, settingsView } from './site-http';

/**
 * The signed-in vendor's own website. The vendor is ALWAYS the verified principal's vendor (@UseTenant): there is no vendor id in the URL, query or body.
 * Team members need the `website` area; changing the theme, publishing and rolling back are owner-only (they change what the public sees).
 * No route here serves a page publicly: the preview is for the signed-in owner and is never indexable.
 */
@ApiTags('v3-site')
@ApiBearerAuth()
@UseTenant()
@RequireModule('website')
@Controller('v3/me/site')
export class MeSiteController {
  constructor(private readonly settings: SiteSettingsService, private readonly build: SiteBuildService, private readonly publisher: PublishService, private readonly preview: SitePreviewService) {}

  private actor(user: AuthenticatedUser, req: Request): Actor { return { type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null }; }

  @Get()
  @ApiOperation({ summary: 'My site: settings, the current and newest publication, what is missing for search engines, and the themes I may use' })
  status(@Tenant() t: TenantContext) { return this.settings.status(t.vendorId); }

  @UseGuards(VendorOwnerGuard)
  @Put('theme') @HttpCode(200)
  @ApiOperation({ summary: 'Choose my theme (owner only; the plan decides which themes are allowed)' })
  async theme(@Tenant() t: TenantContext, @Body() dto: SetThemeDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return settingsView(await this.settings.setTheme(t.vendorId, dto.themeId, this.actor(user, req)));
  }

  @Post('build') @HttpCode(200)
  @ApiOperation({ summary: 'Build a preview of my whole site (nothing goes live). The same inputs return the same preview.' })
  async buildSite(@Tenant() t: TenantContext, @Body() dto: BuildSiteDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const r = await this.build.build(t.vendorId, { themeId: dto.themeId, actor: this.actor(user, req) });
    return { publication: summarise(r.publication), reused: r.reused };
  }

  @UseGuards(VendorOwnerGuard)
  @Post('publish') @HttpCode(200)
  @ApiOperation({ summary: 'Publish a preview (owner only)' })
  async publish(@Tenant() t: TenantContext, @Body() dto: PublishSiteDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return summarise(await this.publisher.publish(t.vendorId, dto.publicationId, this.actor(user, req)));
  }

  @UseGuards(VendorOwnerGuard)
  @Post('rollback') @HttpCode(200)
  @ApiOperation({ summary: 'Go back to an earlier published version as a new version (owner only; needs version history on the plan)' })
  async rollback(@Tenant() t: TenantContext, @Body() dto: RollbackSiteDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return summarise(await this.publisher.rollback(t.vendorId, dto.toVersion, this.actor(user, req)));
  }

  @Get('preview/:publicationId/:path')
  @ApiOperation({ summary: 'One stored page of one of my publications (path URL-encoded, for example %2Fabout). Preview only: never indexable, never cached.' })
  async previewPage(@Tenant() t: TenantContext, @Param('publicationId') id: string, @Param('path') path: string, @Res() res: Response): Promise<void> {
    const page = await this.preview.page(t.vendorId, id, path, `/v3/me/site/preview/${id}`);
    res.set(previewHeaders(page.contentType)).status(200).send(page.html);
  }
}
