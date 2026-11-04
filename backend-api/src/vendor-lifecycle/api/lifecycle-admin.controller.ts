import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf, pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { VendorLifecycleService } from '../vendor-lifecycle.service';
import { DeletionListDto, ExtendGraceDto, ReasonDto, RestoreProDto } from './dto/lifecycle.dto';

/**
 * Staff lifecycle API (slice 5.1d). Role matrix: OPERATIONS and SUPER_ADMIN only; MARKETING is refused on every route. Every action needs a reason and is audited.
 * Nothing the vendor stored is deleted by any route except the two permanent-removal paths (a vendor's own request, or an empty listing).
 */
@ApiTags('v3-lifecycle-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class LifecycleAdminController {
  constructor(private readonly lifecycle: VendorLifecycleService) {}

  @Get('vendors/:id/lifecycle')
  @ApiOperation({ summary: 'Where a vendor stands: status, plan, grace, removed' })
  state(@Param('id') id: string) { return this.lifecycle.state(id); }

  @Post('vendors/:id/lifecycle/convert-to-free') @HttpCode(200)
  @ApiOperation({ summary: 'Formally convert a vendor to the Free plan of their track (reason required, audited; nothing is deleted)' })
  convert(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.lifecycle.convertToFree(id, actorOf(user, req), dto.reason); }

  @Post('vendors/:id/lifecycle/restore-pro') @HttpCode(200)
  @ApiOperation({ summary: 'Restore Pro through the subscription path (defaults to the last Pro plan and term of the vendor); kept Pro data returns' })
  restore(@Param('id') id: string, @Body() dto: RestoreProDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.lifecycle.restorePro(id, actorOf(user, req), dto.reason, { planKey: dto.planKey, termMonths: dto.termMonths });
  }

  @Post('vendors/:id/lifecycle/extend-grace') @HttpCode(200)
  @ApiOperation({ summary: 'Add days to the grace period of a Pro subscription (bounded by the graceExtendMaxDays setting)' })
  extend(@Param('id') id: string, @Body() dto: ExtendGraceDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.lifecycle.extendGrace(id, actorOf(user, req), dto.reason, dto.days); }

  @Post('vendors/:id/lifecycle/suspend') @HttpCode(200)
  @ApiOperation({ summary: 'Suspend a vendor: the site and listing stay live as a Free listing-only page; Pro features stop' })
  suspend(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.lifecycle.suspend(id, actorOf(user, req), dto.reason); }

  @Post('vendors/:id/lifecycle/reinstate') @HttpCode(200)
  @ApiOperation({ summary: 'Reinstate a suspended vendor' })
  reinstate(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.lifecycle.reinstate(id, actorOf(user, req), dto.reason); }

  @Post('vendors/:id/lifecycle/delete-empty-listing') @HttpCode(200)
  @ApiOperation({ summary: 'Delete an EMPTY listing (no phone, address, description, services or media). Refused with the list of what exists otherwise.' })
  deleteEmpty(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.lifecycle.deleteEmptyListing(id, actorOf(user, req), dto.reason); }

  @Get('account-deletions')
  @ApiOperation({ summary: 'The queue of owner deletion requests (oldest first)' })
  async deletions(@Query() q: DeletionListDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const { items, total } = await this.lifecycle.listDeletions({ status: q.status, skip, take });
    return paged(items, total, page, pageSize);
  }

  @Get('account-deletions/:id')
  @ApiOperation({ summary: 'One deletion request' })
  deletion(@Param('id') id: string) { return this.lifecycle.getDeletion(id); }

  @Post('account-deletions/:id/execute') @HttpCode(200)
  @ApiOperation({ summary: 'Execute an owner deletion request: permanent removal from every listing, never listed again (reason required, audited)' })
  execute(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.lifecycle.executeDeletion(id, actorOf(user, req), dto.reason); }
}
