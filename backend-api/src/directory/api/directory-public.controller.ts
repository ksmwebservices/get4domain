import { Body, Controller, Get, Headers, HttpCode, HttpException, NotFoundException, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createHash } from 'crypto';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { DirectoryReadService } from '../directory-read.service';
import { DirectoryRemovalService } from '../directory-removal.service';
import { directoryError, REMOVAL_ACCEPTED_MESSAGE } from '../directory.errors';
import { DirectorySettingsService } from '../settings/directory-settings.service';
import { PublicListDto, RemovalRequestDto, SitemapDto } from './dto/directory.dto';

/**
 * The public directory: read only, rate limited, cacheable with an ETag, and it never exposes an email, an owner name, an internal id, a vendor id, a staff field or an unclaimed
 * business's private data. Removal requests are uniform (no oracle). Nothing here changes a profile.
 */
@ApiTags('v3-directory')
@Controller('v3/directory')
export class DirectoryPublicController {
  constructor(private readonly read: DirectoryReadService, private readonly removal: DirectoryRemovalService, private readonly settings: DirectorySettingsService) {}

  /** Sets the cache headers and answers 304 when the caller already has this exact body. */
  private async cached<T>(data: T, res: Response, ifNoneMatch: string | undefined): Promise<T | null> {
    const etag = `"${createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 32)}"`;
    const s = await this.settings.get();
    res.set({ ETag: etag, 'Cache-Control': `public, max-age=${s.directoryCacheSeconds}, stale-while-revalidate=${s.directoryCacheSeconds}` });
    if (ifNoneMatch && ifNoneMatch.replace(/^W\//, '') === etag) { res.status(304); return null; }
    return data;
  }

  @Public() @Throttle(RATE.directoryRead) @Get('locations')
  @ApiOperation({ summary: 'The place tree: state, districts, cities' })
  async locations(@Res({ passthrough: true }) res: Response, @Headers('if-none-match') inm?: string) { return this.cached(await this.read.locations(), res, inm); }

  @Public() @Throttle(RATE.directoryRead) @Get('categories')
  @ApiOperation({ summary: 'The category tree: families and categories' })
  async categories(@Res({ passthrough: true }) res: Response, @Headers('if-none-match') inm?: string) { return this.cached(await this.read.categories(), res, inm); }

  @Public() @Throttle(RATE.directoryRead) @Get('businesses')
  @ApiOperation({ summary: 'Search and list businesses by place, category and text. Page size is capped. Sponsored items are labelled and never change the organic order.' })
  async list(@Query() q: PublicListDto, @Res({ passthrough: true }) res: Response, @Headers('if-none-match') inm?: string) { return this.cached(await this.read.list(q), res, inm); }

  @Public() @Throttle(RATE.directoryRead) @Get('businesses/:slug')
  @ApiOperation({ summary: 'One business. 404 for an unknown or non-public one; 410 for one that has been removed.' })
  async one(@Param('slug') slug: string, @Res({ passthrough: true }) res: Response, @Headers('if-none-match') inm?: string) {
    const r = await this.read.detail(slug);
    if (!r) throw new NotFoundException(directoryError('DIRECTORY_NOT_FOUND', 'That business is not in the directory.'));
    if (r.gone) throw new HttpException({ message: 'That business has been removed from the directory.', code: 'DIRECTORY_GONE' }, 410);
    return this.cached(r.business, res, inm);
  }

  @Public() @Throttle(RATE.directoryRead) @Get('sitemap-data')
  @ApiOperation({ summary: 'Paged business URLs with their last modified date: indexable and public only' })
  async sitemap(@Query() q: SitemapDto, @Res({ passthrough: true }) res: Response, @Headers('if-none-match') inm?: string) { return this.cached(await this.read.sitemapData(q.page, q.pageSize), res, inm); }

  @Public() @Throttle(RATE.removalRequest) @Post('removal-requests') @HttpCode(202)
  @ApiOperation({ summary: 'Ask for a business to be removed. The answer is always the same; a confirmation link goes to the phone number on file.' })
  async requestRemoval(@Body() dto: RemovalRequestDto, @Req() req: Request) { await this.removal.request(dto, req.ip ?? null); return { accepted: true, message: REMOVAL_ACCEPTED_MESSAGE }; }

  @Public() @Throttle(RATE.claimStatus) @Get('removal-requests/:token')
  @ApiOperation({ summary: 'Check a removal link (one uniform 404 for every link that cannot be used)' })
  linkStatus(@Param('token') token: string) { return this.removal.linkStatus(String(token).slice(0, 200)); }

  @Public() @Throttle(RATE.removalRequest) @Post('removal-requests/:token/confirm') @HttpCode(200)
  @ApiOperation({ summary: 'Confirm a removal request with the link sent to the business contact' })
  confirm(@Param('token') token: string) { return this.removal.confirm(String(token).slice(0, 200)); }
}
