import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { RequiresFeature } from '../../plans/entitlements/requires-feature.decorator';
import { JOB_STATES, JobState, QUOTE_STATES } from '../core/jobs-core';
import { JobsService } from '../jobs.service';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class JobListDto extends PageDto {
  @IsOptional() @IsIn([...JOB_STATES]) status?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) includeArchived?: boolean;
}
export class CalendarDto { @Matches(DAY) from!: string; @Matches(DAY) to!: string }
export class CreateJobDto {
  @IsString() @MaxLength(120) title!: string;
  @IsString() @MaxLength(120) customerName!: string;
  @IsOptional() @IsString() @MaxLength(20) customerPhone?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsString() @MaxLength(80) assignedTo?: string;
  @IsOptional() @IsString() @MaxLength(40) scheduledAt?: string;
  @IsOptional() @IsString() @MaxLength(40) requestId?: string;
}
export class UpdateJobDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(120) customerName?: string;
  @IsOptional() @IsString() @MaxLength(20) customerPhone?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsString() @MaxLength(80) assignedTo?: string;
  @IsOptional() @IsString() @MaxLength(40) scheduledAt?: string;
}
export class MoveJobDto { @IsIn([...JOB_STATES]) status!: JobState; @IsOptional() @IsString() @MaxLength(300) reason?: string }
export class PaidDto { @IsString() @MaxLength(40) payRequestId!: string }
export class QuoteListDto extends PageDto { @IsOptional() @IsString() @MaxLength(40) jobId?: string; @IsOptional() @IsIn([...QUOTE_STATES]) status?: string }
export class CreateQuoteDto {
  @IsOptional() @IsString() @MaxLength(40) jobId?: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(120) customerName?: string;
  @IsOptional() @IsString() @MaxLength(20) customerPhone?: string;
  @IsOptional() @Matches(DAY) validUntil?: string;
  @IsArray() lines!: unknown[];
}
export class UpdateQuoteDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(120) customerName?: string;
  @IsOptional() @IsString() @MaxLength(20) customerPhone?: string;
  @IsOptional() @Matches(DAY) validUntil?: string;
  @IsOptional() @IsArray() lines?: unknown[];
}

/** Jobs of a Handyman business. OWNER ONLY for now (customer details; staff access arrives with the team slice), plan feature `jobs.manage` (Free sees it locked; other tracks do not see it). */
@ApiTags('v3-jobs-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@RequiresFeature('jobs.manage')
@Controller('v3/me/jobs')
export class MeJobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get() @ApiOperation({ summary: 'My jobs, newest first; filter by status or search by title or customer' })
  async list(@Tenant() t: TenantContext, @Query() q: JobListDto) { const { page, pageSize } = pageArgs(q); const r = await this.jobs.listJobs(t.vendorId, q, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Get('calendar') @ApiOperation({ summary: 'Scheduled jobs between two days, grouped by day' })
  calendar(@Tenant() t: TenantContext, @Query() q: CalendarDto) { return this.jobs.calendar(t.vendorId, q.from, q.to); }
  @Get(':id') @ApiOperation({ summary: 'One job' })
  one(@Tenant() t: TenantContext, @Param('id') id: string) { return this.jobs.getJob(t.vendorId, id); }
  @Post() @HttpCode(200) @ApiOperation({ summary: 'Add a job (a request that came by phone or in person)' })
  create(@Tenant() t: TenantContext, @Body() dto: CreateJobDto) { return this.jobs.createJob(t.vendorId, dto); }
  @Put(':id') @HttpCode(200) @ApiOperation({ summary: 'Change a job: details, assignment, schedule' })
  update(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: UpdateJobDto) { return this.jobs.updateJob(t.vendorId, id, dto); }
  @Post(':id/status') @HttpCode(200) @ApiOperation({ summary: 'Move a job one step along its path (paid is not a step you can set)' })
  move(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: MoveJobDto) { return this.jobs.moveJob(t.vendorId, id, dto.status, dto.reason); }
  @Post(':id/paid') @HttpCode(200) @ApiOperation({ summary: 'Mark a finished job paid from a payment request you have confirmed' })
  paid(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: PaidDto) { return this.jobs.markPaid(t.vendorId, id, dto.payRequestId); }
  @Post(':id/archive') @HttpCode(200) @ApiOperation({ summary: 'Archive a job (never deleted)' })
  archive(@Tenant() t: TenantContext, @Param('id') id: string) { return this.jobs.archiveJob(t.vendorId, id, true); }
  @Post(':id/restore') @HttpCode(200) @ApiOperation({ summary: 'Bring an archived job back' })
  restore(@Tenant() t: TenantContext, @Param('id') id: string) { return this.jobs.archiveJob(t.vendorId, id, false); }
}

/** Quotes with lines. Same gate as jobs. */
@ApiTags('v3-jobs-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@RequiresFeature('jobs.manage')
@Controller('v3/me/quotes')
export class MeQuotesController {
  constructor(private readonly jobs: JobsService) {}

  @Get() @ApiOperation({ summary: 'My quotes, newest first; filter by job or status (overdue ones are marked expired first)' })
  async list(@Tenant() t: TenantContext, @Query() q: QuoteListDto) { const { page, pageSize } = pageArgs(q); const r = await this.jobs.listQuotes(t.vendorId, q, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Get(':id') @ApiOperation({ summary: 'One quote with its lines' })
  one(@Tenant() t: TenantContext, @Param('id') id: string) { return this.jobs.getQuote(t.vendorId, id); }
  @Post() @HttpCode(200) @ApiOperation({ summary: 'Write a quote; a tax rate on a line must be one in the rate table' })
  create(@Tenant() t: TenantContext, @Body() dto: CreateQuoteDto) { return this.jobs.createQuote(t.vendorId, dto); }
  @Put(':id') @HttpCode(200) @ApiOperation({ summary: 'Change a draft quote' })
  update(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: UpdateQuoteDto) { return this.jobs.editQuote(t.vendorId, id, dto); }
  @Post(':id/send') @HttpCode(200) @ApiOperation({ summary: 'Mark a quote as given to the customer (nothing is sent by this build)' })
  send(@Tenant() t: TenantContext, @Param('id') id: string) { return this.jobs.sendQuote(t.vendorId, id); }
  @Post(':id/accept') @HttpCode(200) @ApiOperation({ summary: 'Record that the customer accepted: books the job (creating it once if there was none)' })
  accept(@Tenant() t: TenantContext, @Param('id') id: string) { return this.jobs.acceptQuote(t.vendorId, id); }
  @Post(':id/decline') @HttpCode(200) @ApiOperation({ summary: 'Record that the customer declined' })
  decline(@Tenant() t: TenantContext, @Param('id') id: string) { return this.jobs.declineQuote(t.vendorId, id); }
}
