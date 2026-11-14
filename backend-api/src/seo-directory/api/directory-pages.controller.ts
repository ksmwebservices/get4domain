import { Controller, Get, Headers, HttpException, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { createHash } from 'crypto';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { DirectorySettingsService } from '../../directory/settings/directory-settings.service';
import { PageSpec, PINCODE, SLUG } from '../core/url-scheme';
import { PageResult, SeoPageService } from '../pages/seo-page.service';
import { seoError } from '../seo-directory.errors';
import { PageQueryDto, ResolveQueryDto } from './dto/directory-pages.dto';

const TYPES = ['home', 'state', 'city', 'category', 'city-category', 'locality-category', 'pincode-category', 'business'] as const;

/**
 * The directory page models (SEO block slice 2). Public, read only, rate limited, cacheable with an ETag. The front end only renders what these return. Every model says noindex until the
 * setting directoryPagesIndexable is switched on (default OFF: counsel approves the wording first).
 */
@ApiTags('v3-directory-pages')
@Controller('v3/directory/pages')
export class DirectoryPagesController {
  constructor(private readonly pages: SeoPageService, private readonly settings: DirectorySettingsService) {}

  private async send(r: PageResult, res: Response, inm: string | undefined) {
    if (r.kind === 'notFound') throw new NotFoundException(seoError('SEO_NOT_FOUND', 'That page does not exist.'));
    if (r.kind === 'gone') throw new HttpException({ message: 'That business has been removed from the directory.', code: 'DIRECTORY_GONE' }, 410);
    const etag = `"${createHash('sha256').update(JSON.stringify(r.model)).digest('hex').slice(0, 32)}"`;
    const s = await this.settings.get();
    res.set({ ETag: etag, 'Cache-Control': `public, max-age=${s.directoryCacheSeconds}, stale-while-revalidate=${s.directoryCacheSeconds}` });
    if (inm && inm.replace(/^W\//, '') === etag) { res.status(304); return null; }
    return r.model;
  }

  @Public() @Throttle(RATE.directoryRead) @Get('resolve')
  @ApiOperation({ summary: 'A path such as /chennai/plumbers-in-adyar/page/2 to its page model. 404 for an unknown page, 410 for a removed business.' })
  async resolve(@Query() q: ResolveQueryDto, @Res({ passthrough: true }) res: Response, @Headers('if-none-match') inm?: string) { return this.send(await this.pages.resolve(q.path), res, inm); }

  @Public() @Throttle(RATE.directoryRead) @Get(':type')
  @ApiOperation({ summary: 'One page model by type: home, state, city, category, city-category, locality-category, pincode-category, business (slugs in the query; page from 2)' })
  async byType(@Param('type') type: string, @Query() q: PageQueryDto, @Res({ passthrough: true }) res: Response, @Headers('if-none-match') inm?: string) {
    const spec = this.specOf(type, q);
    if (!spec) throw new NotFoundException(seoError('SEO_NOT_FOUND', 'That page does not exist.'));
    return this.send(await this.pages.model(spec), res, inm);
  }

  private specOf(type: string, q: PageQueryDto): PageSpec | null {
    if (!(TYPES as readonly string[]).includes(type)) return null;
    const page = q.page && q.page >= 1 ? Math.min(q.page, 1000) : 1;
    const ok = (v: string | undefined): v is string => !!v && SLUG.test(v);
    switch (type) {
      case 'home': return { type: 'home' };
      case 'state': return ok(q.state) ? { type: 'state', state: q.state, page } : null;
      case 'city': return ok(q.city) ? { type: 'city', city: q.city, page } : null;
      case 'category': return ok(q.category) ? { type: 'category', category: q.category, page } : null;
      case 'city-category': return ok(q.city) && ok(q.term) ? { type: 'cityCategory', city: q.city, term: q.term, page } : null;
      case 'locality-category': return ok(q.city) && ok(q.locality) && ok(q.term) ? { type: 'localityCategory', city: q.city, locality: q.locality, term: q.term, page } : null;
      case 'pincode-category': return !!q.pincode && PINCODE.test(q.pincode) && ok(q.category) ? { type: 'pincodeCategory', pincode: q.pincode, category: q.category, page } : null;
      case 'business': return ok(q.slug) ? { type: 'business', slug: q.slug } : null;
      default: return null;
    }
  }
}
