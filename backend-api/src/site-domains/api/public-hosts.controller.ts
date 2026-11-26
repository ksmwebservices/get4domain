import { createHash } from 'crypto';
import { Controller, Get, Headers, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { HostList, HostListService } from '../host-list.service';

/**
 * E11d: read by the server's host sync script. Public on purpose (owner decision D1): a published business's address is public already, and the answer holds
 * host names only. The ETag is made from the names alone, so it changes only when the list does.
 */
@ApiTags('v3-site-public')
@Controller('v3/public/site')
export class PublicHostsController {
  constructor(private readonly hosts: HostListService) {}

  @Public()
  @Throttle(RATE.siteRead)
  @Get('hosts')
  @ApiOperation({ summary: 'The free host names that have a published Version 3 site (names only), for the web server host mapper' })
  async list(@Headers('if-none-match') ifNoneMatch: string | undefined, @Res({ passthrough: true }) res: Response): Promise<HostList | null> {
    const value = await this.hosts.list();
    const etag = `"${createHash('sha256').update(value.hosts.join('\n')).digest('hex')}"`;
    res.set({ ETag: etag, 'Cache-Control': 'public, max-age=30' });
    if (ifNoneMatch && ifNoneMatch.replace(/^W\//, '') === etag) { res.status(304); return null; }
    return value;
  }
}
