import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf, PageQueryDto, pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { PublishService } from '../publish/publish.service';
import { SiteBuildService } from '../publish/site-build.service';
import { SiteProvisionFacts } from '../publish/site-provision-facts.service';
import { SitePreviewService } from '../publish/site-preview.service';
import { SiteSettingsService, summarise } from '../publish/site-settings.service';
import { SiteRepository } from '../publish/site.repository';
import { AssignThemeDto, BuildSiteDto, NoindexDto, PublishSiteDto, SetThemeDto } from './dto/site.dto';
import { previewHeaders, settingsView } from './site-http';

/** How many sites of one list page are checked at the same time: each check reads several tables, and a whole page at once would take every pooled database connection. */
const INDEXING_CHECKS_AT_ONCE = 4;
async function inBatches<T, R>(rows: readonly T[], size: number, work: (row: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < rows.length; i += size) out.push(...(await Promise.all(rows.slice(i, i + size).map(work))));
  return out;
}

/**
 * Staff API for vendors' sites. Role matrix: everything that carries html (the preview) and every write is OPERATIONS and SUPER_ADMIN; MARKETING reads
 * summaries only (the list and one site), never html. The services and rules are the same ones the vendor routes use.
 */
@ApiTags('v3-site-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class SitesAdminController {
  constructor(
    private readonly repo: SiteRepository, private readonly settings: SiteSettingsService, private readonly build: SiteBuildService,
    private readonly publisher: PublishService, private readonly preview: SitePreviewService, private readonly facts: SiteProvisionFacts,
  ) {}

  @Get('sites')
  @ApiOperation({ summary: 'Sites of all vendors, newest first (summaries only, no html). indexable and publishedIndexable are the values of the one-vendor route; indexable is null when it could not be worked out.' })
  async list(@Query() q: PageQueryDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const { items, total } = await this.repo.listSites({ skip, take });
    const indexable = await inBatches(items, INDEXING_CHECKS_AT_ONCE, (i) => this.settings.indexableOf(i.vendorId, i.settings));
    return paged(items.map((i, n) => ({
      vendorId: i.vendorId, businessName: i.businessName, themeId: i.settings?.themeId ?? null, language: i.settings?.language ?? 'en', forceNoindex: i.settings?.forceNoindex ?? false,
      current: summarise(i.current), preview: i.newest && i.newest.status === 'DRAFT_PREVIEW' ? summarise(i.newest) : null,
      indexable: indexable[n], publishedIndexable: i.current ? i.current.indexable : null,
    })), total, page, pageSize);
  }

  @Get('vendors/:id/site')
  @ApiOperation({ summary: 'One vendor\'s site: settings, current and newest publication, what is missing, allowed themes, the vendor status, subdomain, site address and why the site was not made (siteProvisionStatus, siteProvisionCode, siteProvisionFailedAt); no html' })
  async status(@Param('id') id: string) { const s = await this.settings.status(id); return { ...s, ...(await this.facts.forAdmin(id)) }; }

  @Put('vendors/:id/site/theme') @HttpCode(200)
  @ApiOperation({ summary: 'Choose a vendor\'s theme on their behalf (the plan rules still apply)' })
  async theme(@Param('id') id: string, @Body() dto: SetThemeDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return settingsView(await this.settings.setTheme(id, dto.themeId, actorOf(user, req)));
  }

  @Post('vendors/:id/site/theme/assign') @HttpCode(200)
  @ApiOperation({ summary: 'Assign a theme to a business and publish it when the site is live (a reason is recorded). A theme made privately for that business is always allowed; a public theme follows the plan rules.' })
  async assignTheme(@Param('id') id: string, @Body() dto: AssignThemeDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const r = await this.settings.assignTheme(id, dto.themeId, dto.reason, actorOf(user, req));
    return { settings: settingsView(r.settings), published: summarise(r.published) };
  }

  @Post('vendors/:id/site/build') @HttpCode(200)
  @ApiOperation({ summary: 'Build a preview of a vendor\'s site' })
  async buildSite(@Param('id') id: string, @Body() dto: BuildSiteDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const r = await this.build.build(id, { themeId: dto.themeId, actor: actorOf(user, req) });
    return { publication: summarise(r.publication), reused: r.reused };
  }

  @Post('vendors/:id/site/publish') @HttpCode(200)
  @ApiOperation({ summary: 'Publish a vendor\'s preview' })
  async publish(@Param('id') id: string, @Body() dto: PublishSiteDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return summarise(await this.publisher.publish(id, dto.publicationId, actorOf(user, req)));
  }

  @Put('vendors/:id/site/noindex') @HttpCode(200)
  @ApiOperation({ summary: 'Force a site out of search engines (or lift it); a live site is rebuilt and republished at once' })
  async noindex(@Param('id') id: string, @Body() dto: NoindexDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const r = await this.settings.setForceNoindex(id, dto.forceNoindex, actorOf(user, req));
    return { settings: settingsView(r.settings), published: summarise(r.published) };
  }

  @Get('vendors/:id/site/preview/:publicationId/:path')
  @ApiOperation({ summary: 'One stored page of a vendor\'s publication (html; path URL-encoded). Preview only: never indexable, never cached.' })
  async previewPage(@Param('id') id: string, @Param('publicationId') pubId: string, @Param('path') path: string, @Res() res: Response): Promise<void> {
    const page = await this.preview.page(id, pubId, path, `/v3/admin/vendors/${id}/site/preview/${pubId}`);
    res.set(previewHeaders(page.contentType)).status(200).send(page.html);
  }
}
