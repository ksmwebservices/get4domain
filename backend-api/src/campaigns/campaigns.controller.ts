import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a campaign request' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the current vendor's campaigns" })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.findAllForVendor(user.sub);
  }

  @UseGuards(AdminGuard)
  @Get('admin/all')
  @ApiOperation({ summary: 'List all vendor campaigns (admin only)' })
  findAllAdmin() {
    return this.campaignsService.findAllAdmin();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single campaign (owner only)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.findOne(id, user.sub);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a campaign — checks and deducts wallet balance for selected channels' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.approve(id, user.sub);
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get performance analytics for a campaign' })
  analytics(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.analytics(id, user.sub);
  }
}
