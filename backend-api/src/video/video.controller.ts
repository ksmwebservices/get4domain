import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VideoService, VideoProvider } from './video.service';
import { GenerateVideoDto } from './dto/generate-video.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

/** Internal Get4Domain staff generate video for free (no wallet), like AI Studio. */
function isInternalStaff(user: AuthenticatedUser): boolean {
  return Boolean(user.adminRole) || user.kind === 'admin_member';
}

@ApiTags('video')
@ApiBearerAuth()
@Controller('video')
export class VideoController {
  constructor(private readonly video: VideoService) {}

  @Get('provider')
  @ApiOperation({ summary: 'Active video provider (runway | heygen | none) + per-video cost' })
  async provider(): Promise<{ provider: VideoProvider; cost: number }> {
    const [provider, cost] = await Promise.all([this.video.activeProvider(), this.video.cost()]);
    return { provider, cost };
  }

  @Post('generate')
  @ApiOperation({ summary: 'Start a video/reel generation job (deducts wallet; free for internal staff)' })
  generate(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateVideoDto) {
    return this.video.generate(user.sub, dto, isInternalStaff(user));
  }

  @Get('status')
  @ApiOperation({ summary: 'Poll a video generation job by provider + jobId' })
  status(@Query('provider') provider: VideoProvider, @Query('jobId') jobId: string) {
    return this.video.status(provider, jobId);
  }
}
