import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf } from '../../plans/admin/plans-admin.common';
import { ClaimsService } from '../claims/claims.service';
import { CreateProvisioningJobDto, ListInvitesQueryDto, ListJobsQueryDto } from './dto/provisioning.dto';
import { ProvisioningAdminService } from './provisioning-admin.service';

/**
 * Staff API for provisioning (slice 5.3). Role matrix: OPERATIONS and SUPER_ADMIN read and write; MARKETING is refused on every route.
 * HTTP only: the rules are in ProvisioningAdminService and ClaimsService. No response ever contains a claim token.
 */
@ApiTags('v3-provisioning-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class ProvisioningAdminController {
  constructor(private readonly jobs: ProvisioningAdminService, private readonly claims: ClaimsService) {}

  @Post('provisioning/jobs')
  @ApiOperation({ summary: 'Create a provisioning job for one business (Idempotency-Key header required; the same key returns the same job)' })
  async create(@Body() dto: CreateProvisioningJobDto, @Headers('idempotency-key') key: string | undefined, @CurrentUser() user: AuthenticatedUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { created, job } = await this.jobs.createJob(dto, key, actorOf(user, req));
    res.status(created ? 201 : 200);
    return job;
  }

  @Get('provisioning/jobs')
  @ApiOperation({ summary: 'List provisioning jobs (paginated; filter by status and date)' })
  list(@Query() q: ListJobsQueryDto) { return this.jobs.list(q); }

  @Get('provisioning/jobs/:id')
  @ApiOperation({ summary: 'One job with its steps and its sanitised error (never a token)' })
  detail(@Param('id') id: string) { return this.jobs.detail(id); }

  @Post('provisioning/jobs/:id/retry') @HttpCode(200)
  @ApiOperation({ summary: 'Put a FAILED job back in the queue (completed steps are kept)' })
  retry(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.jobs.retry(id, actorOf(user, req)); }

  @Post('provisioning/jobs/:id/cancel') @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a job: remaining steps are skipped, completed steps are not rolled back' })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.jobs.cancel(id, actorOf(user, req)); }

  @Post('provisioning/jobs/:id/run') @HttpCode(200)
  @ApiOperation({ summary: 'Run one job now, in this request (staging and tests; in production only while the runner is switched on)' })
  run(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.jobs.run(id, actorOf(user, req)); }

  @Post('vendors/:id/claim-link/reissue') @HttpCode(200)
  @ApiOperation({ summary: 'Revoke the current claim link and send the owner a new one' })
  reissue(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.claims.reissue(id, actorOf(user, req)); }

  @Post('vendors/:id/claim-link/revoke') @HttpCode(200)
  @ApiOperation({ summary: 'Revoke the current claim link' })
  revoke(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.claims.revoke(id, actorOf(user, req)); }

  @Get('invites')
  @ApiOperation({ summary: 'Invites sent to business owners (addresses masked; the sandbox message is shown outside production only)' })
  invites(@Query() q: ListInvitesQueryDto) { return this.jobs.listInvites(q); }
}
