import { Body, Controller, Get, HttpCode, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf, pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { DEFAULT_SEO_TEMPLATES, SEO_PAGE_TYPES } from '../core/default-templates';
import { SEO_PLACEHOLDERS } from '../core/template-engine';
import { DEFAULT_SEO_CRAWLERS } from '../settings/seo-settings';
import { SeoKeywordService } from '../keywords/seo-keyword.service';
import { SeoSitemapService } from '../sitemaps/seo-sitemap.service';
import { SeoSettingsService } from '../settings/seo-settings.service';
import { CrawlersUpdateDto, KeywordListDto, KeywordUpdateDto, TemplatesUpdateDto, VendorSitesQueryDto } from './dto/seo-admin.dto';

/**
 * Staff routes of the SEO block (platform-level data, no tenant). Reading: SUPER_ADMIN, ADMIN and SALES (the MARKETING role). Writing the keyword sets and the page templates: ADMIN and
 * SUPER_ADMIN. The role matrix (auth/guards/admin-role-matrix.ts) is the single place that says so; every write leaves an audit row.
 */
@ApiTags('v3-seo-directory-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/seo-directory')
export class SeoAdminController {
  constructor(private readonly keywords: SeoKeywordService, private readonly settings: SeoSettingsService, private readonly sitemaps: SeoSitemapService) {}

  @Get('category-keywords') @ApiOperation({ summary: 'The keyword sets (singular, plural, synonyms, specialisations) of the categories' })
  async list(@Query() q: KeywordListDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const r = await this.keywords.list({ q: q.q, skip, take });
    return paged(r.items, r.total, page, pageSize);
  }

  @Get('category-keywords/:slug') @ApiOperation({ summary: 'One category keyword set' })
  one(@Param('slug') slug: string) { return this.keywords.get(slug); }

  @Put('category-keywords/:slug') @HttpCode(200) @ApiOperation({ summary: 'Edit singular, plural and synonyms of a category (the loader never overwrites an edited row)' })
  update(@Param('slug') slug: string, @Body() dto: KeywordUpdateDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.keywords.update(slug, dto, actorOf(u, req)); }

  @Get('templates') @ApiOperation({ summary: 'The page templates in force, the defaults, what staff typed, the page types and the placeholders' })
  async templates() {
    return { templates: await this.settings.templates(), defaults: DEFAULT_SEO_TEMPLATES, stored: await this.settings.stored(), pageTypes: SEO_PAGE_TYPES, placeholders: SEO_PLACEHOLDERS, limits: { title: 60, description: 160 } };
  }

  @Put('templates') @HttpCode(200) @ApiOperation({ summary: 'Change the templates of one or more page types (checked: placeholders, no markup, no price)' })
  async saveTemplates(@Body() dto: TemplatesUpdateDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return { templates: await this.settings.saveTemplates(dto.templates, actorOf(u, req)) }; }

  @Get('crawlers') @ApiOperation({ summary: 'The crawlers robots.txt names, and the default list' })
  async crawlers() { return { crawlers: await this.settings.crawlers(), defaults: DEFAULT_SEO_CRAWLERS }; }

  @Put('crawlers') @HttpCode(200) @ApiOperation({ summary: 'Replace the list of crawlers robots.txt names (SUPER_ADMIN only)' })
  async saveCrawlers(@Body() dto: CrawlersUpdateDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return { crawlers: await this.settings.saveCrawlers(dto.crawlers, actorOf(u, req)) }; }

  @Get('vendor-sites') @ApiOperation({ summary: 'Live, indexable vendor subdomain home URLs, for monitoring (staff only; each site keeps its own sitemap)' })
  async vendorSites(@Query() q: VendorSitesQueryDto) { const { skip, take, page, pageSize } = pageArgs(q); const r = await this.sitemaps.vendorSites(skip, take); return paged(r.items, r.total, page, pageSize); }
}
