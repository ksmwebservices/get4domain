import { Controller, Get, NotFoundException, Param, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { ClickOutService } from '../click-out/click-out.service';
import { seoError } from '../seo-directory.errors';
import { ClickOutQueryDto } from './dto/click-out.dto';

/**
 * The click-out of a directory card. 302 to the business's get4domain subdomain, never a custom domain. Not indexable (X-Robots-Tag, and disallowed in robots), rate limited per IP, never
 * cached, and the target is built from the stored subdomain only: nothing in the request can choose where it goes.
 */
@ApiTags('v3-directory-go')
@Controller('v3/go')
export class ClickOutController {
  constructor(private readonly clickOut: ClickOutService) {}

  @Public() @Throttle(RATE.directoryGo) @Get(':businessId')
  @ApiOperation({ summary: 'Visit site: counts the click and answers 302 to the business subdomain. One uniform 404 for anything that cannot be visited.' })
  async go(@Param('businessId') businessId: string, @Query() q: ClickOutQueryDto, @Req() req: Request, @Res() res: Response): Promise<void> {
    res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' });
    const url = await this.clickOut.go(String(businessId).slice(0, 64), q.src, q.kw, req.ip ?? null);
    if (!url) throw new NotFoundException(seoError('SEO_NOT_FOUND', 'Not found.'));
    res.redirect(302, url);
  }
}
