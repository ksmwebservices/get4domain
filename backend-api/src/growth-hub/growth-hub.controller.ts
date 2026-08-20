import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GrowthHubService } from './growth-hub.service';
import { AdRequestDto, PublishDto } from './dto/growth-hub.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('growth-hub')
@ApiBearerAuth()
@RequireModule('campaigns')
@Controller('growth-hub')
export class GrowthHubController {
  constructor(private readonly service: GrowthHubService) {}

  @Post('publish')
  @ApiOperation({ summary: 'Publish approved content to Facebook/Instagram (MOCK Meta layer)' })
  publish(@Body() dto: PublishDto) {
    return this.service.publish(dto);
  }

  @Post('ads')
  @ApiOperation({ summary: 'Submit a paid-ad request (stored as Pending Review)' })
  requestAd(@CurrentUser() user: AuthenticatedUser, @Body() dto: AdRequestDto) {
    return this.service.requestAd(user.sub, dto);
  }

  @Get('ads')
  @ApiOperation({ summary: 'List the current vendor’s ad campaigns' })
  listAds(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listAds(user.sub);
  }

  @UseGuards(AdminGuard)
  @Post('ads/:id/launch')
  @ApiOperation({ summary: 'Launch an approved ad campaign (admin only, MOCK ads layer)' })
  launchAd(@Param('id') id: string) {
    return this.service.launchAd(id);
  }
}
