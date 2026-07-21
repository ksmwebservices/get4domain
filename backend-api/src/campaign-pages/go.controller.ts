import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CampaignPagesService } from './campaign-pages.service';
import { SubmitLeadDto } from './dto/submit-lead.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('go')
@Public()
@Controller('go')
export class GoController {
  constructor(private readonly campaignPagesService: CampaignPagesService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Public: get a campaign page by slug (no auth required)' })
  getBySlug(@Param('slug') slug: string) {
    return this.campaignPagesService.getPublicBySlug(slug);
  }

  @Post(':slug/lead')
  @ApiOperation({ summary: 'Public: submit an enquiry lead on a campaign page (no auth required)' })
  submitLead(@Param('slug') slug: string, @Body() dto: SubmitLeadDto) {
    return this.campaignPagesService.submitLead(slug, dto);
  }
}
