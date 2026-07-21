import { Body, Controller, Get, Param, Post, Put, Delete } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CampaignPagesService } from './campaign-pages.service';
import { GeneratePageDto } from './dto/generate-page.dto';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('campaign-pages')
@ApiBearerAuth()
@Controller('campaign-pages')
export class CampaignPagesController {
  constructor(private readonly campaignPagesService: CampaignPagesService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate landing page copy with Claude AI' })
  generate(@Body() dto: GeneratePageDto) {
    return this.campaignPagesService.generate(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create a campaign landing page' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePageDto) {
    return this.campaignPagesService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the current vendor's campaign pages with lead counts" })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.campaignPagesService.findAllForVendor(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single campaign page (owner only)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignPagesService.findOne(id, user.sub);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a campaign page (owner only)' })
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePageDto) {
    return this.campaignPagesService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete (deactivate) a campaign page (owner only)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignPagesService.softDelete(id, user.sub);
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get views/leads/conversion analytics for a campaign page' })
  analytics(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignPagesService.analytics(id, user.sub);
  }

  @Public()
  @Post(':pageId/view')
  @ApiOperation({ summary: 'Increment the view counter for a campaign page (public, no auth)' })
  incrementView(@Param('pageId') pageId: string) {
    return this.campaignPagesService.incrementView(pageId);
  }
}
