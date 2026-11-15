import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { DirectorySettingsService } from '../../directory/settings/directory-settings.service';
import { SeoBacklinkService } from '../backlinks/seo-backlink.service';
import { SeoUtmService } from '../campaigns/seo-utm.service';
import { seoError } from '../seo-directory.errors';
import { PageVisitDto } from './dto/seo-targets.dto';

const notFound = (): NotFoundException => new NotFoundException(seoError('SEO_NOT_FOUND', 'Not found.'));
const BADGE_FILE = /^([A-Za-z0-9_-]{1,64})\.svg$/;

/**
 * Public SEO routes of slice 5: the page-visit beacon (UTM capture), the backlink block and the embeddable badge. Read only apart from the beacon, which adds one to a daily counter. Rate limited
 * per address. A business that is unknown, removed or a draft gets the same 404 on every route.
 */
@ApiTags('v3-directory-seo')
@Controller('v3/directory')
export class SeoPublicController {
  constructor(private readonly utm: SeoUtmService, private readonly backlinks: SeoBacklinkService, private readonly settings: DirectorySettingsService) {}

  @Public() @Throttle(RATE.directoryVisit) @Post('page-visits') @HttpCode(200)
  @ApiOperation({ summary: 'Report that a directory page was opened with campaign parameters (utm_source, utm_medium, utm_campaign, kw). Stores a daily count only. Always answers ok.' })
  async pageVisit(@Body() dto: PageVisitDto): Promise<{ ok: true }> { await this.utm.record(dto); return { ok: true }; }

  @Public() @Throttle(RATE.directoryRead) @Get('backlink-block/:businessId')
  @ApiOperation({ summary: 'The backlink block of a listed business: a brand link and up to four directory links with rotating anchor text (directory links only while the directory pages are indexable)' })
  async block(@Param('businessId') businessId: string) { const b = await this.backlinks.block(businessId); if (!b) throw notFound(); return b; }

  @Public() @Throttle(RATE.directoryRead) @Get('badge-embed/:businessId')
  @ApiOperation({ summary: 'The HTML snippet of the "Listed on Get4Domain" badge for a listed business' })
  async embed(@Param('businessId') businessId: string) { const e = await this.backlinks.embed(businessId); if (!e) throw notFound(); return e; }

  @Public() @Throttle(RATE.directoryRead) @Get('badge/:file')
  @ApiOperation({ summary: 'The "Listed on Get4Domain" badge picture (SVG) for a listed business, as {businessId}.svg. The picture is fixed text.' })
  async badge(@Param('file') file: string, @Res() res: Response): Promise<void> {
    const m = BADGE_FILE.exec(String(file ?? ''));
    const svg = m ? await this.backlinks.badge(m[1]) : null;
    if (!svg) throw notFound();
    const s = await this.settings.get();
    // sandboxed even if the picture is opened on its own; embeddable from any site; the picture never changes, so it is cacheable
    res.set({
      'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox", 'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'cross-origin', 'Cache-Control': `public, max-age=${s.directoryCacheSeconds}`, 'X-Robots-Tag': 'noindex',
    });
    res.status(200).send(svg);
  }
}
