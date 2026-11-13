import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf, pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { AdminActionsService } from '../admin-actions.service';
import { HostVisitService } from '../host-visits.service';

export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class BusinessNameDto { @IsString() @MaxLength(200) businessName!: string; @IsString() @MaxLength(400) reason!: string }
export class PlanChangeDto {
  @IsString() @MaxLength(60) planKey!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(120) termMonths?: number;
  @IsOptional() @IsDateString() effectiveAt?: string;
  @IsString() @MaxLength(400) reason!: string;
}
export class MergeDto { @IsString() @MaxLength(64) keepVendorId!: string; @IsString() @MaxLength(64) mergedVendorId!: string; @IsString() @MaxLength(400) reason!: string }
export class MergePlanDto { @IsString() @MaxLength(64) keepVendorId!: string; @IsString() @MaxLength(64) mergedVendorId!: string }
export class ReverseDto { @IsString() @MaxLength(400) reason!: string }
export class VisitsQueryDto { @IsOptional() @IsString() @MaxLength(10) from?: string; @IsOptional() @IsString() @MaxLength(10) to?: string }
export class MergeListDto extends PageDto { @IsOptional() @IsString() @MaxLength(64) vendorId?: string }

/**
 * Staff actions on one business (Amendment 09 Part A and Amendment 11 Q12). OPERATIONS and SUPER_ADMIN; MARKETING is refused. Each needs a written reason, and every call is written to the activity
 * log with the staff member as the actor (the activity interceptor does it for every signed-in route under /v3/admin).
 */
@ApiTags('v3-admin-actions')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminActionsController {
  constructor(private readonly actions: AdminActionsService, private readonly visits: HostVisitService) {}

  @Put('vendors/:id/business-name') @HttpCode(200) @ApiOperation({ summary: 'Change a business name (free sites too); the old name is kept and the payee-name check runs again' })
  rename(@Param('id') id: string, @Body() b: BusinessNameDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.actions.changeBusinessName(id, actorOf(u, req), b); }
  @Get('vendors/:id/business-name-history') @ApiOperation({ summary: 'Every earlier business name of one business, newest first' })
  async nameHistory(@Param('id') id: string, @Query() q: PageDto) { const { page, pageSize } = pageArgs(q); const r = await this.actions.nameHistory(id, page, pageSize); return paged(r.items, r.total, page, pageSize); }

  @Post('vendors/:id/plan-change') @HttpCode(200) @ApiOperation({ summary: 'Change a business plan to any plan, now or at an effective date (a later date waits and can be cancelled)' })
  planChange(@Param('id') id: string, @Body() b: PlanChangeDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.actions.requestPlanChange(id, actorOf(u, req), b); }
  @Get('vendors/:id/plan-changes') @ApiOperation({ summary: 'The plan changes staff made or scheduled for one business, newest first' })
  async planChanges(@Param('id') id: string, @Query() q: PageDto) { const { page, pageSize } = pageArgs(q); const r = await this.actions.listPlanChanges(id, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Post('plan-changes/:id/cancel') @HttpCode(200) @ApiOperation({ summary: 'Cancel a plan change that is still waiting for its date' })
  cancelPlanChange(@Param('id') id: string) { return this.actions.cancelPlanChange(id); }

  @Get('vendors/:id/visits') @ApiOperation({ summary: 'Page visits per host (subdomain and custom domain) per day for one business: counts only' })
  visitReport(@Param('id') id: string, @Query() q: VisitsQueryDto) { return this.visits.report(id, q); }
}

/**
 * Merging two listings (Amendment 09 A4). SUPER_ADMIN only. Off until staff set how many days a merge can be undone. Contacts move; money history stays on the original with the merge record as the
 * pointer; SUPER_ADMIN can undo it until the window ends.
 */
@ApiTags('v3-admin-merges')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/listing-merges')
export class AdminMergesController {
  constructor(private readonly actions: AdminActionsService) {}

  @Post('plan') @HttpCode(200) @ApiOperation({ summary: 'What a merge would do (which contacts would move, which stay), without doing it' })
  plan(@Body() b: MergePlanDto) { return this.actions.planMerge(b.keepVendorId, b.mergedVendorId); }
  @Post() @HttpCode(200) @ApiOperation({ summary: 'Merge the second listing into the first (contacts move; money history stays; reversible for the set number of days)' })
  merge(@Body() b: MergeDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.actions.merge(actorOf(u, req), b); }
  @Get() @ApiOperation({ summary: 'Merges, newest first; filter by a business on either side' })
  async list(@Query() q: MergeListDto) { const { page, pageSize } = pageArgs(q); const r = await this.actions.listMerges(q.vendorId ?? null, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Post(':id/reverse') @HttpCode(200) @ApiOperation({ summary: 'Undo a merge within its window: the contacts that are still on the kept business go back' })
  reverse(@Param('id') id: string, @Body() b: ReverseDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.actions.reverseMerge(actorOf(u, req), id, b.reason); }
}
