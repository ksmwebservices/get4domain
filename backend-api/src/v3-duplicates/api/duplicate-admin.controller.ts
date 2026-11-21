import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsIn, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { DuplicateCheckService } from '../duplicate-check.service';

export class ReviewListDto {
  @IsOptional() @IsIn(['PENDING', 'CLEARED', 'REJECTED']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class ReviewDecisionDto { @IsString() @MaxLength(300) reason!: string }

const staff = (u: AuthenticatedUser) => ({ id: u.sub, role: String(u.adminRole ?? 'MARKETING') });

/** Staff queue of possible duplicates that were let through on the owner's word and are held (not published). Clearing or rejecting needs an ADMIN or SUPER_ADMIN and a written reason. */
@ApiTags('v3-duplicates-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/duplicates/reviews')
export class DuplicateAdminController {
  constructor(private readonly dup: DuplicateCheckService) {}

  @Get() @ApiOperation({ summary: 'Held possible duplicates, newest first' })
  async list(@Query() q: ReviewListDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const r = await this.dup.listReviews({ status: q.status, skip, take });
    return paged(r.items, r.total, page, pageSize);
  }

  @Post(':id/clear') @HttpCode(200) @ApiOperation({ summary: 'Clear a held possible duplicate: it is a different business and may be published (ADMIN or SUPER_ADMIN, reason required)' })
  clear(@Param('id') id: string, @Body() dto: ReviewDecisionDto, @CurrentUser() u: AuthenticatedUser) { return this.dup.decide(id, 'CLEARED', dto.reason, staff(u)); }

  @Post(':id/reject') @HttpCode(200) @ApiOperation({ summary: 'Reject a held possible duplicate: it stays unpublished (ADMIN or SUPER_ADMIN, reason required)' })
  reject(@Param('id') id: string, @Body() dto: ReviewDecisionDto, @CurrentUser() u: AuthenticatedUser) { return this.dup.decide(id, 'REJECTED', dto.reason, staff(u)); }
}
