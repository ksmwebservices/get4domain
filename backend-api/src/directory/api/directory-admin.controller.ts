import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf, pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { DirectoryAdminService } from '../directory-admin.service';
import { DirectoryRemovalService } from '../directory-removal.service';
import { DirectoryVisitService } from '../directory-visit.service';
import {
  CategoryCreateDto, CategoryUpdateDto, VisitReportDto, ClaimOverrideDto, LocationCreateDto, LocationUpdateDto, ModerateDto, PlacementDto, RejectDto, RemovalListDto, StaffBusinessDto, StaffBusinessListDto, StaffBusinessUpdateDto,
} from './dto/directory.dto';

/** MARKETING sees businesses without the personal fields (phone, address, hours, map position, masked email). Everything that writes, and everything with a contact detail, is OPERATIONS and SUPER_ADMIN. */
const redact = (u: AuthenticatedUser): boolean => u?.adminRole === 'MARKETING';

@ApiTags('v3-directory-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/directory')
export class DirectoryAdminController {
  constructor(private readonly admin: DirectoryAdminService, private readonly removal: DirectoryRemovalService, private readonly visits: DirectoryVisitService) {}

  @Get('visits') @ApiOperation({ summary: 'Visit-site counts per business over a date range, busiest first (counts only; OPERATIONS and SUPER_ADMIN)' })
  async visitReport(@Query() q: VisitReportDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const r = await this.visits.report({ from: q.from, to: q.to, vendorId: q.vendorId, skip, take });
    return { ...paged(r.items, r.total, page, pageSize), from: r.from, to: r.to };
  }

  // tree
  @Get('locations') @ApiOperation({ summary: 'All places (active)' }) locations() { return this.admin.listLocations(); }
  @Post('locations') @HttpCode(200) @ApiOperation({ summary: 'Add a place (state, district or city)' })
  createLocation(@Body() dto: LocationCreateDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.createLocation(dto, actorOf(u, req)); }
  @Put('locations/:id') @HttpCode(200) @ApiOperation({ summary: 'Rename, re-slug, re-order or deactivate a place (nothing is deleted)' })
  updateLocation(@Param('id') id: string, @Body() dto: LocationUpdateDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.updateLocation(id, dto, actorOf(u, req)); }

  @Get('categories') @ApiOperation({ summary: 'All categories (active)' }) categories() { return this.admin.listCategories(); }
  @Post('categories') @HttpCode(200) @ApiOperation({ summary: 'Add a category or a family' })
  createCategory(@Body() dto: CategoryCreateDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.createCategory(dto, actorOf(u, req)); }
  @Put('categories/:id') @HttpCode(200) @ApiOperation({ summary: 'Rename, re-slug, re-order, re-map or deactivate a category (nothing is deleted)' })
  updateCategory(@Param('id') id: string, @Body() dto: CategoryUpdateDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.updateCategory(id, dto, actorOf(u, req)); }

  // businesses
  @Get('businesses') @ApiOperation({ summary: 'Businesses with filters; personal fields are left out for MARKETING' })
  async businesses(@Query() q: StaffBusinessListDto, @CurrentUser() u: AuthenticatedUser) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const r = await this.admin.listBusinesses({ status: q.status, categoryId: q.categoryId, locationId: q.locationId, q: q.q, skip, take }, redact(u));
    return paged(r.items, r.total, page, pageSize);
  }
  @Get('businesses/:id') @ApiOperation({ summary: 'One business; personal fields are left out for MARKETING' })
  business(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) { return this.admin.getBusiness(id, redact(u)); }
  @Post('businesses') @HttpCode(200) @ApiOperation({ summary: 'Add a business (unclaimed unless a draft is asked for)' })
  createBusiness(@Body() dto: StaffBusinessDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.createBusiness(dto as never, actorOf(u, req)); }
  @Put('businesses/:id') @HttpCode(200) @ApiOperation({ summary: 'Edit a business (the short name in the web address never changes)' })
  updateBusiness(@Param('id') id: string, @Body() dto: StaffBusinessUpdateDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.updateBusiness(id, dto as never, actorOf(u, req)); }
  @Post('businesses/:id/moderate') @HttpCode(200) @ApiOperation({ summary: 'Suspend, restore or remove a business (reason required, audited; removal hides the profile and keeps the record)' })
  moderate(@Param('id') id: string, @Body() dto: ModerateDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.moderate(id, dto.action, dto.reason, actorOf(u, req)); }

  // placements
  @Get('businesses/:id/placements') @ApiOperation({ summary: 'Sponsored placements of a business' }) placements(@Param('id') id: string) { return this.admin.listPlacements(id); }
  @Post('businesses/:id/placements') @HttpCode(200) @ApiOperation({ summary: 'Add a sponsored placement (a label is required and is always shown)' })
  createPlacement(@Param('id') id: string, @Body() dto: PlacementDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.createPlacement(id, dto, actorOf(u, req)); }
  @Post('placements/:id/revoke') @HttpCode(200) @ApiOperation({ summary: 'End a sponsored placement now' })
  revokePlacement(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.revokePlacement(id, actorOf(u, req)); }

  // claim phone override
  @Post('businesses/:id/claim-phone-override') @HttpCode(200) @ApiOperation({ summary: 'Allow the claim code to go to a different phone number than the one on file (reason required, audited)' })
  override(@Param('id') id: string, @Body() dto: ClaimOverrideDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.admin.claimPhoneOverride(id, dto, actorOf(u, req)); }

  // removal requests
  @Get('removal-requests') @ApiOperation({ summary: 'Removal requests (the contact is shown masked)' })
  async removals(@Query() q: RemovalListDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const r = await this.removal.list({ status: q.status, skip, take });
    return paged(r.items.map((x) => ({ id: x.id, businessId: x.businessId, status: x.status, reason: x.reason, contact: x.requesterContactMasked, confirmed: !!x.confirmedAt, createdAt: x.createdAt, expiresAt: x.expiresAt, handledAt: x.handledAt, executedAt: x.executedAt })), r.total, page, pageSize);
  }
  @Post('removal-requests/:id/approve') @HttpCode(200) @ApiOperation({ summary: 'Approve a confirmed removal request' })
  approve(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.removal.approve(id, actorOf(u, req)); }
  @Post('removal-requests/:id/reject') @HttpCode(200) @ApiOperation({ summary: 'Reject a removal request (reason required)' })
  reject(@Param('id') id: string, @Body() dto: RejectDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.removal.reject(id, dto.reason, actorOf(u, req)); }
  @Post('removal-requests/:id/execute') @HttpCode(200) @ApiOperation({ summary: 'Hide the profile for an approved request (the record and audit trail are kept)' })
  execute(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.removal.execute(id, actorOf(u, req)); }
}
