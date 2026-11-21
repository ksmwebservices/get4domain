import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { packDemo } from '../pack-demo/pack-demo';
import { PackEngineService } from '../pack-engine.service';

/**
 * The public list of the industry packs for the marketing site (audit gap G31): what each pack gives (its working tabs), whether it is a regulated pack the owner has not opened, and the add-on packs with
 * their price status (a price is never a number here: it stays PENDING until the price book has an approved one). Public, cacheable, no vendor data, no money.
 */
@ApiTags('v3-packs-public')
@Controller('v3/public/packs')
export class PublicPacksController {
  constructor(private readonly packs: PackEngineService) {}

  @Public() @Throttle(RATE.directoryRead) @Get()
  @ApiOperation({ summary: 'The industry packs with their working tabs, whether each is a regulated pack that is still closed, and the add-on packs with their price status' })
  async list(@Res({ passthrough: true }) res: Response) { res.set('Cache-Control', 'public, max-age=300'); return this.packs.publicPacks(); }

  @Public() @Throttle(RATE.directoryRead) @Get(':key/demo')
  @ApiOperation({ summary: 'The sample business of a pack (invented name, services, people, questions; no price) used by demos and by the theme gallery' })
  demo(@Param('key') key: string, @Res({ passthrough: true }) res: Response) {
    const d = packDemo(String(key).toUpperCase().slice(0, 40));
    if (!d) throw new NotFoundException('Not found');
    res.set('Cache-Control', 'public, max-age=300');
    return d;
  }
}
