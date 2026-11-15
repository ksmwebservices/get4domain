import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf, pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { SeoSettingsService } from '../settings/seo-settings.service';
import { SeoBacklinkService } from '../backlinks/seo-backlink.service';
import { seoError } from '../seo-directory.errors';
import { SeoUtmService } from '../campaigns/seo-utm.service';
import { SeoKeywordResearchService } from '../keywords/seo-keyword-research.service';
import { SeoKeywordTargetService } from '../keywords/seo-keyword-target.service';
import { LinkBuildDto, TargetCreateDto, TargetExportQueryDto, TargetImportDto, TargetListDto, TargetUpdateDto, UtmReportQueryDto, VolumeImportDto } from './dto/seo-targets.dto';

/**
 * Staff routes of the keyword targets (slice 5). Reading, the keyword plan, the link builder and the campaign report: SUPER_ADMIN, ADMIN and SALES (the MARKETING role). Creating, editing and
 * importing targets: ADMIN and SUPER_ADMIN. The role matrix (auth/guards/admin-role-matrix.ts) is the single place that says so; every write leaves an audit row. Nothing here deletes: a target
 * that is no longer wanted is set to PAUSED.
 */
@ApiTags('v3-seo-directory-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/seo-directory')
export class SeoTargetsAdminController {
  constructor(private readonly targets: SeoKeywordTargetService, private readonly utm: SeoUtmService, private readonly backlinks: SeoBacklinkService, private readonly research: SeoKeywordResearchService, private readonly settings: SeoSettingsService) {}

  private csv(res: Response, body: string, name: string): void {
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.status(200).send(body);
  }

  @Get('keyword-targets') @ApiOperation({ summary: 'The keyword targets: which keyword a directory page is aimed at (filter by text, status or page)' })
  async list(@Query() q: TargetListDto) { const { skip, take, page, pageSize } = pageArgs(q); const r = await this.targets.list({ q: q.q, status: q.status, path: q.path, sort: q.sort, skip, take }); return paged(r.items, r.total, page, pageSize); }

  @Get('keyword-targets/export.csv') @ApiOperation({ summary: 'Every keyword target as a CSV file (the same columns the import reads)' })
  async exportCsv(@Query() q: TargetExportQueryDto, @Res() res: Response): Promise<void> { this.csv(res, await this.targets.exportCsv(q.status), 'keyword-targets.csv'); }

  @Get('keyword-targets/:id') @ApiOperation({ summary: 'One keyword target' })
  one(@Param('id') id: string) { return this.targets.get(id); }

  @Post('keyword-targets') @HttpCode(201) @ApiOperation({ summary: 'Add a keyword target (PLANNED until made ACTIVE; an ACTIVE one may carry its own title, description and H1)' })
  create(@Body() dto: TargetCreateDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.targets.create({ ...dto }, actorOf(u, req)); }

  @Put('keyword-targets/:id') @HttpCode(200) @ApiOperation({ summary: 'Edit a keyword target: status, priority, title, description, H1, notes (an empty text clears an override)' })
  update(@Param('id') id: string, @Body() dto: TargetUpdateDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.targets.update(id, { ...dto }, actorOf(u, req)); }

  @Post('keyword-targets/import') @HttpCode(200) @ApiOperation({ summary: 'Import keyword targets from CSV. A DRY RUN that writes nothing unless apply is true; one problem blocks the whole apply' })
  importCsv(@Body() dto: TargetImportDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.targets.importCsv(dto.csv, { apply: dto.apply === true }, actorOf(u, req)); }

  @Post('keyword-targets/import-volumes') @HttpCode(200) @ApiOperation({ summary: 'Read a Keyword Planner CSV back into the targets: volume and competition. A DRY RUN unless apply is true; a range or a blank is skipped, never guessed; a keyword that is not ours is ignored' })
  importVolumes(@Body() dto: VolumeImportDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.research.importVolumes(dto.csv, { apply: dto.apply === true }, actorOf(u, req)); }

  @Get('keyword-plan/research') @ApiOperation({ summary: 'The keyword research list for Keyword Planner, COUNTS ONLY (the dry run): how many keywords of each kind, from our own data. Nothing is stored' })
  async researchCounts() { const p = await this.research.plan(); return { total: p.total, truncated: p.truncated, counts: p.counts, modifiers: await this.settings.modifiers() }; }

  @Get('keyword-plan/research.csv') @ApiOperation({ summary: 'The keyword research list as a CSV file: keyword, the page path it maps to, and the kind' })
  async researchCsv(@Res() res: Response): Promise<void> { this.csv(res, (await this.research.csv()).csv, 'keyword-research.csv'); }

  @Get('keyword-plan/planner.csv') @ApiOperation({ summary: 'The keyword research list as one keyword per row under the header Keyword, ready to upload to Google Keyword Planner' })
  async plannerCsv(@Res() res: Response): Promise<void> { this.csv(res, (await this.research.csv()).planner, 'keyword-planner-upload.csv'); }

  @Get('keyword-plan') @ApiOperation({ summary: 'The generated keyword plan: PLANNED rows for every listed city + category and locality + category page (nothing is stored)' })
  plan() { return this.targets.plan(); }

  @Get('keyword-plan/export.csv') @ApiOperation({ summary: 'The generated keyword plan as a CSV file, ready to edit and import back' })
  async planCsv(@Res() res: Response): Promise<void> { this.csv(res, (await this.targets.plan()).csv, 'keyword-plan.csv'); }

  @Post('links') @HttpCode(200) @ApiOperation({ summary: 'Build a tracked link to a directory page: the canonical address plus utm_source, utm_medium, utm_campaign and optionally kw' })
  link(@Body() dto: LinkBuildDto) { return this.targets.link({ ...dto }); }

  @Get('utm-report') @ApiOperation({ summary: 'Page visits that arrived with campaign parameters, per day, page type, source, medium, campaign and keyword target (counts only)' })
  async utmReport(@Query() q: UtmReportQueryDto) { const { skip, take, page, pageSize } = pageArgs(q); const r = await this.utm.report({ from: q.from, to: q.to, skip, take }); return paged(r.items, r.total, page, pageSize); }

  @Get('businesses/:id/badge') @ApiOperation({ summary: 'The badge snippet and the plain text link of one listed business (for a vendor with their own site, Google profile or social bio)' })
  async badge(@Param('id') id: string) { const e = await this.backlinks.embed(id); if (!e) throw new NotFoundException(seoError('SEO_NOT_FOUND', 'Not found.')); return e; }
}
