import { Controller, Get, Headers, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { SitePublicService } from '../publish/site-public.service';

const str = (v: unknown, max: number): string => (typeof v === 'string' && v.length <= max ? v : '');

/**
 * Internal, read-only: the PUBLISHED page of the site behind a host name, for the Next.js app and the future host mapper (nothing is exposed on any real host
 * by this slice). Every miss is the same plain 404, and bad input is that 404 too, so the route reveals nothing about which hosts exist. Preview rows are
 * never reachable. Rate limited per IP.
 */
@ApiTags('v3-site-public')
@Controller('v3/public/site')
export class PublicSiteController {
  constructor(private readonly sites: SitePublicService) {}

  @Public()
  @Throttle(RATE.siteRead)
  @Get('by-host')
  @ApiOperation({ summary: 'The published page for host, path and language: html with an ETag (the page sha256), or one uniform 404' })
  async byHost(@Query('host') host: string, @Query('path') path: string, @Query('lang') lang: string, @Headers('if-none-match') ifNoneMatch: string | undefined, @Res() res: Response): Promise<void> {
    const page = await this.sites.lookup(str(host, 253), str(path, 300) || '/', str(lang, 5));
    if (page && page.status === 451) { res.status(451).set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }).send(page.html); return; }
    if (page && page.status !== 200) { res.status(page.status).set({ Location: page.location, 'Cache-Control': 'public, max-age=300' }).end(); return; }
    if (!page) { res.status(404).set({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).send('Not found'); return; }
    const headers: Record<string, string> = { ETag: page.etag, 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120', 'Content-Language': page.lang };
    if (page.robots) headers['X-Robots-Tag'] = page.robots;
    if (page.canonicalHost) headers['X-Canonical-Host'] = page.canonicalHost;
    if (ifNoneMatch && ifNoneMatch.replace(/^W\//, '') === page.etag) { res.status(304).set(headers).end(); return; }
    res.status(200).set({ ...headers, 'Content-Type': page.contentType }).send(page.html);
  }
}
