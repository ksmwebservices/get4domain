import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Actor } from '../../plans/admin/audit.service';
import { PageQueryDto, pageArgs } from '../../plans/admin/plans-admin.common';
import { SUBMISSION_STATUSES, SubmissionStatus } from '../core/review-core';
import { ReviewService } from '../review/review.service';

export class ContentReviewQuery extends PageQueryDto {
  @IsOptional() @IsIn(SUBMISSION_STATUSES as unknown as string[]) status?: SubmissionStatus;
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
}
export class RejectDto { @IsString() @MaxLength(600) reason!: string; }

const staff = (user: AuthenticatedUser, req: Request): Actor => ({ type: 'STAFF', id: user?.sub ?? null, ip: req?.ip ?? null });

/**
 * Staff review of Free vendors' edits (slice 5.5c, amendment 06). Role matrix: OPERATIONS and SUPER_ADMIN (the stage file names SUPPORT, a role that does not exist here; the owner is asked
 * in OPEN QUESTIONS); MARKETING is refused because a submission carries a vendor's own contact details.
 */
@ApiTags('v3-website-review')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/content-reviews')
export class AdminReviewController {
  constructor(private readonly reviews: ReviewService) {}

  @Get()
  @ApiOperation({ summary: 'Submissions waiting for review (filter by status and vendor)' })
  list(@Query() q: ContentReviewQuery) { const { page, pageSize } = pageArgs(q); return this.reviews.adminList({ status: q.status, vendorId: q.vendorId, page, pageSize }); }

  @Get(':id')
  @ApiOperation({ summary: 'One submission with its payload and what changed' })
  one(@Param('id') id: string) { return this.reviews.adminGet(id); }

  @Post(':id/approve') @HttpCode(200)
  @ApiOperation({ summary: 'Approve: the submitted content goes live' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.reviews.approve(id, staff(user, req)); }

  @Post(':id/reject') @HttpCode(200)
  @ApiOperation({ summary: 'Reject with a reason the vendor can read; the old content stays live' })
  reject(@Param('id') id: string, @Body() dto: RejectDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.reviews.reject(id, staff(user, req), dto.reason); }
}
