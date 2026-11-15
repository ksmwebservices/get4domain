import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { PageQueryDto, pageArgs } from '../../plans/admin/plans-admin.common';
import { LocationService } from '../location/location.service';
import { ReviewLinkService } from '../review-link/review-link.service';
import { TestimonialsService } from '../testimonials/testimonials.service';
import { SeoService } from '../seo/seo.service';
import { SEO_ISSUES, SeoIssueCode } from '../core/seo-core';

export class SeoReportQuery extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @IsIn([...SEO_ISSUES]) issue?: SeoIssueCode;
}

/** Staff SEO reports (slice B1): read only, from the projection written when a version goes live. Page titles and descriptions carry no personal data, so all staff roles may read them. */
@ApiTags('v3-website-seo-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminSeoController {
  constructor(private readonly seo: SeoService, private readonly location: LocationService, private readonly reviewLink: ReviewLinkService, private readonly testimonials: TestimonialsService) {}

  @Get('seo/pages')
  @ApiOperation({ summary: 'Pages with something to fix: still on the default text, sharing a title or a description, a short description, a site with no locality, a title with none of the category words (filter by vendor and issue)' })
  issues(@Query() q: SeoReportQuery) { const { page, pageSize } = pageArgs(q); return this.seo.staffIssues({ vendorId: q.vendorId, issue: q.issue, page, pageSize }); }

  @Get('vendors/:id/site/testimonials')
  @ApiOperation({ summary: 'The testimonials of one vendor\'s live site (customers\' words: OPERATIONS and SUPER_ADMIN only)' })
  vendorTestimonials(@Param('id') id: string) { return this.testimonials.staffList(id); }

  @Get('vendors/:id/site/review-link')
  @ApiOperation({ summary: 'The Google review link of one vendor\'s live site' })
  vendorReviewLink(@Param('id') id: string) { return this.reviewLink.staffGet(id); }

  @Get('vendors/:id/site/location')
  @ApiOperation({ summary: 'The location of one vendor\'s live site (an address can be a home address: OPERATIONS and SUPER_ADMIN only)' })
  vendorLocation(@Param('id') id: string) { return this.location.staffGet(id); }

  @Get('vendors/:id/site/seo')
  @ApiOperation({ summary: 'The search-result text of every page of one vendor\'s live site' })
  vendor(@Param('id') id: string) { return this.seo.staffRows(id); }
}
