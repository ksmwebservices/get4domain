import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReelsService, ReelRenderResult } from './reels.service';
import { RenderReelDto } from './dto/render-reel.dto';
import { MusicTrack } from './reels.tracks';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

// Internal Get4Domain staff render for free (same rule as AI Studio content gen).
function isInternalStaff(user: AuthenticatedUser): boolean {
  return Boolean(user.adminRole) || user.kind === 'admin_member';
}

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
  render(@CurrentUser() user: AuthenticatedUser, @Body() dto: RenderReelDto): Promise<ReelRenderResult> {
    return this.service.render(user.sub, dto, isInternalStaff(user));
  }
}
