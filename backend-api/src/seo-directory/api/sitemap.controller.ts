import { Controller, Get, Headers, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createHash } from 'crypto';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { DirectorySettingsService } from '../../directory/settings/directory-settings.service';
import { chunkNumber } from '../core/sitemap';
import { seoError } from '../seo-directory.errors';
import { SeoSitemapService } from '../sitemaps/seo-sitemap.service';

/**
 * The directory sitemaps and the robots.txt text of the main site. The Next.js site serves them at /sitemap.xml, /sitemaps/directory-{n}.xml and /robots.txt by fetching these routes (they
 * answer the raw body, not the JSON wrapper). Public, read only, rate limited, ETag, cacheable.
 */
@ApiTags('v3-directory-sitemaps')
@Controller('v3/directory')
export class SitemapController {
  constructor(private readonly sitemaps: SeoSitemapService, private readonly settings: DirectorySettingsService) {}

  private async send(body: string, type: string, res: Response, inm: string | undefined): Promise<void> {
    const etag = `"${createHash('sha256').update(body).digest('hex').slice(0, 32)}"`;
    const s = await this.settings.get();
    res.set({ 'Content-Type': type, ETag: etag, 'Cache-Control': `public, max-age=${s.directoryCacheSeconds}, stale-while-revalidate=${s.directoryCacheSeconds}` });
    if (inm && inm.replace(/^W\//, '') === etag) { res.status(304).end(); return; }
    res.status(200).send(body);
  }

  @Public() @Throttle(RATE.directoryRead) @Get('sitemaps/index.xml')
  @ApiOperation({ summary: 'The sitemap index of the indexable directory pages (empty while directoryPagesIndexable is OFF)' })
  async index(@Res() res: Response, @Headers('if-none-match') inm?: string): Promise<void> { await this.send(await this.sitemaps.index(), 'application/xml; charset=utf-8', res, inm); }

  @Public() @Throttle(RATE.directoryRead) @Get('sitemaps/:file')
  @ApiOperation({ summary: 'One sitemap chunk, directory-{n}.xml, at most 10,000 urls (empty while directoryPagesIndexable is OFF)' })
  async chunk(@Param('file') file: string, @Res() res: Response, @Headers('if-none-match') inm?: string): Promise<void> {
    const n = chunkNumber(file);
    const xml = n === null ? null : await this.sitemaps.chunk(n);
    if (xml === null) throw new NotFoundException(seoError('SEO_NOT_FOUND', 'That sitemap does not exist.'));
    await this.send(xml, 'application/xml; charset=utf-8', res, inm);
  }

  @Public() @Throttle(RATE.directoryRead) @Get('robots.txt')
  @ApiOperation({ summary: 'The robots.txt text of the main site: allow all, disallow the click-out, internal search and sort or filter URLs, the Sitemap line only when indexable' })
  async robots(@Res() res: Response, @Headers('if-none-match') inm?: string): Promise<void> { await this.send(await this.sitemaps.robots(), 'text/plain; charset=utf-8', res, inm); }
}
