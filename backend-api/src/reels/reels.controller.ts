import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReelsService, ReelRenderResult } from './reels.service';
import { RenderReelDto } from './dto/render-reel.dto';
import { MusicTrack } from './reels.tracks';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { staffMayUse } from '../auth/guards/staff-access';
import { RouteKey } from '../common/decorators/route-key.decorator';

// Free internal rendering for Get4Domain staff (no wallet) is decided by the staff matrix (auth/guards/admin-role-matrix.ts), keyed by the route.

@ApiTags('reels')
@ApiBearerAuth()
@Controller('reels')
export class ReelsController {
  constructor(private readonly service: ReelsService) {}

  @Get('tracks')
  @ApiOperation({ summary: 'Licensed background-music tracks for reels (empty until KSM adds cleared tracks)' })
  tracks(): MusicTrack[] {
    return this.service.tracks();
  }

  @Post('render')
  @ApiOperation({ summary: "Render a slideshow reel from the vendor's own photos + text + optional music (MP4)" })
  render(@CurrentUser() user: AuthenticatedUser, @RouteKey() route: string, @Body() dto: RenderReelDto): Promise<ReelRenderResult> {
    return this.service.render(user.sub, dto, staffMayUse(user, route));
  }
}
