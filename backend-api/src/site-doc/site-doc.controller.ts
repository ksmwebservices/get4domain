import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { UpdateVendorCmsDto } from '../cms/dto/update-vendor-cms.dto';
import { SiteDocService } from './site-doc.service';

class PublishDto {
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

/**
 * Website Manager for the signed-in vendor: edit a draft, preview it, publish it, go back to an earlier version.
 * Every plan gets all of it; plans only limit the number of pages and the media storage. Scoped to the vendor in the token.
 */
@ApiTags('site-doc')
@ApiBearerAuth()
@RequireModule('website')
@Controller('site-doc/me')
export class SiteDocController {
  constructor(private readonly site: SiteDocService) {}

  @Get()
  @ApiOperation({ summary: 'Your site: what is live, what the editor shows (live plus pending edits), the plan limits and whether anything is waiting to be published' })
  view(@CurrentUser() u: AuthenticatedUser) { return this.site.view(u.sub); }

  @Put('draft')
  @ApiOperation({ summary: 'Save edits as a draft. Nothing changes on your public site until you publish.' })
  save(@CurrentUser() u: AuthenticatedUser, @Body() dto: UpdateVendorCmsDto) { return this.site.saveDraft(u.sub, dto); }

  @Delete('draft')
  @ApiOperation({ summary: 'Throw away the unpublished edits' })
  discard(@CurrentUser() u: AuthenticatedUser) { return this.site.discardDraft(u.sub); }

  @Post('preview-link')
  @ApiOperation({ summary: 'A private link (valid 30 minutes) that shows your site with the unpublished edits' })
  preview(@CurrentUser() u: AuthenticatedUser) { return this.site.previewLink(u.sub); }

  @Post('publish')
  @ApiOperation({ summary: 'Make the draft live and refresh your public pages. If anything fails, your live site is unchanged.' })
  publish(@CurrentUser() u: AuthenticatedUser, @Body() dto: PublishDto) { return this.site.publish(u.sub, u.sub, dto?.note); }

  @Get('versions')
  @ApiOperation({ summary: 'Your last published versions' })
  versions(@CurrentUser() u: AuthenticatedUser) { return this.site.versions(u.sub); }

  @Post('versions/:version/restore')
  @ApiOperation({ summary: 'Put an earlier version live again (it becomes a new version; nothing is deleted)' })
  restore(@CurrentUser() u: AuthenticatedUser, @Param('version', ParseIntPipe) version: number) { return this.site.restore(u.sub, version, u.sub); }
}
