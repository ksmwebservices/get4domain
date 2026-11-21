import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VideoService, VideoProvider } from './video.service';
import { GenerateVideoDto } from './dto/generate-video.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { staffMayUse } from '../auth/guards/staff-access';
import { RouteKey } from '../common/decorators/route-key.decorator';
import { REEL_VIDEO_COMING_SOON } from '../common/coming-soon';

// Free internal generation for Get4Domain staff (no wallet) is decided by the staff matrix (auth/guards/admin-role-matrix.ts), keyed by the route.

@ApiTags('video')
@ApiBearerAuth()
@Controller('video')
export class VideoController {
  constructor(private readonly video: VideoService) {}

  @Get('provider')
  @ApiOperation({ summary: 'Active video provider (runway | heygen | none) + per-video cost' })
  async provider(): Promise<{ provider: VideoProvider; cost: number; comingSoon: boolean }> {
    const [provider, cost] = await Promise.all([this.video.activeProvider(), this.video.cost()]);
    return { provider, cost, comingSoon: REEL_VIDEO_COMING_SOON };
  }

  @Post('generate')
  @ApiOperation({ summary: 'Start a video/reel generation job (deducts wallet; free for internal staff)' })
  generate(@CurrentUser() user: AuthenticatedUser, @RouteKey() route: string, @Body() dto: GenerateVideoDto) {
    return this.video.generate(user.sub, dto, staffMayUse(user, route));
  }

  @Get('status')
  @ApiOperation({ summary: 'Poll a video generation job by provider + jobId' })
  status(@Query('provider') provider: VideoProvider, @Query('jobId') jobId: string) {
    return this.video.status(provider, jobId);
  }
}
