import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { PageQueryDto, pageArgs } from '../../plans/admin/plans-admin.common';
import { SeoService } from '../seo/seo.service';

export class SeoReportQuery extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @IsIn(['DEFAULT_TITLE', 'DEFAULT_DESCRIPTION', 'DUPLICATE_TITLE', 'SHORT_DESCRIPTION']) issue?: 'DEFAULT_TITLE' | 'DEFAULT_DESCRIPTION' | 'DUPLICATE_TITLE' | 'SHORT_DESCRIPTION';
}

/** Staff SEO reports (slice B1): read only, from the projection written when a version goes live. Page titles and descriptions carry no personal data, so all staff roles may read them. */
@ApiTags('v3-website-seo-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminSeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('seo/pages')
  @ApiOperation({ summary: 'Pages with something to fix: still on the default text, sharing a title, or a short description (filter by vendor and issue)' })
  issues(@Query() q: SeoReportQuery) { const { page, pageSize } = pageArgs(q); return this.seo.staffIssues({ vendorId: q.vendorId, issue: q.issue, page, pageSize }); }

  @Get('vendors/:id/site/seo')
  @ApiOperation({ summary: 'The search-result text of every page of one vendor\'s live site' })
  vendor(@Param('id') id: string) { return this.seo.staffRows(id); }
}
