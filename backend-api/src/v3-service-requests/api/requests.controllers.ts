import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { RATE } from '../../common/throttling';
import { Actor } from '../../plans/admin/audit.service';
import { actorOf } from '../../plans/admin/plans-admin.common';
import { ServiceRequestsService } from '../service-requests.service';
import { AdminRequestsDto, AssignRequestDto, CreateServiceRequestDto, DeliverableDto, RaiseOnBehalfDto, RejectRequestDto, RequestPageDto, RequestStatusDto, RevisionDto } from './dto/requests.dto';

const page = (q: RequestPageDto): { page: number; pageSize: number } => ({ page: q.page ?? 1, pageSize: q.pageSize ?? 25 });

/**
 * The signed-in OWNER's requests to our team. The vendor is ALWAYS the verified principal's vendor (@UseTenant). OWNER ONLY: a request carries the vendor's money (a hold, then a charge on
 * approval) and the work product. Another vendor's request answers exactly like one that does not exist.
 */
@ApiTags('v3-service-requests')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/service-requests')
export class MeServiceRequestsController {
  constructor(private readonly requests: ServiceRequestsService) {}
  private actor(user: AuthenticatedUser, req: Request): Actor { return { type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null }; }

  @Throttle(RATE.payment) @Post() @HttpCode(200)
  @ApiOperation({ summary: 'Ask our team to do a service (idempotent by key). A wallet-funded request holds the price plus tax; nothing is charged until you approve the work.' })
  create(@Tenant() t: TenantContext, @Body() dto: CreateServiceRequestDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.requests.create(t.vendorId, dto, { type: 'VENDOR', actor: this.actor(user, req) }); }

  @Get() @ApiOperation({ summary: 'My requests, newest first' })
  list(@Tenant() t: TenantContext, @Query() q: RequestPageDto) { const p = page(q); return this.requests.list(t.vendorId, p.page, p.pageSize); }

  @Get('invoices') @ApiOperation({ summary: 'The tax invoices for the work I approved, newest first' })
  invoices(@Tenant() t: TenantContext, @Query() q: RequestPageDto) { const p = page(q); return this.requests.invoices(t.vendorId, p.page, p.pageSize); }

  @Get(':id') @ApiOperation({ summary: 'One request with its history, the finished work (once it is ready) and the invoice' })
  get(@Tenant() t: TenantContext, @Param('id') id: string) { return this.requests.get(t.vendorId, id); }

  @Post(':id/cancel') @HttpCode(200) @ApiOperation({ summary: 'Cancel a request before work starts: the held amount is released and nothing is charged' })
  cancel(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.requests.cancel(t.vendorId, id, this.actor(user, req)); }

  @Throttle(RATE.payment) @Post(':id/approve') @HttpCode(200)
  @ApiOperation({ summary: 'Approve the finished work: the held amount is charged once and a tax invoice is issued (or a pack unit is used)' })
  approve(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.requests.approve(t.vendorId, id, this.actor(user, req)); }

  @Post(':id/revision') @HttpCode(200) @ApiOperation({ summary: 'Ask for changes to the finished work (up to the limit staff set)' })
  revision(@Tenant() t: TenantContext, @Param('id') id: string, @Body() dto: RevisionDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.requests.requestRevision(t.vendorId, id, dto, this.actor(user, req)); }
}

/** Staff queue and work. OPERATIONS and SUPER_ADMIN (MARKETING is refused everywhere: a request holds a brief, a business and money). Every change is audited and recorded in the request's history. */
@ApiTags('v3-service-requests-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/service-requests')
export class AdminServiceRequestsController {
  constructor(private readonly requests: ServiceRequestsService) {}

  @Get() @ApiOperation({ summary: 'The queue, filtered by service, status, funding kind, vendor or SLA breach' })
  list(@Query() q: AdminRequestsDto) { const p = page(q); return this.requests.adminList({ serviceKey: q.serviceKey, status: q.status, fundingKind: q.fundingKind, vendorId: q.vendorId, slaBreached: q.slaBreached, ...p }); }

  @Post('sla-sweep') @HttpCode(200) @ApiOperation({ summary: 'Mark every open request whose due time has passed (once each)' })
  sla() { return this.requests.slaSweep(); }

  @Post('auto-approve-run') @HttpCode(200) @ApiOperation({ summary: 'Run the auto-approval now (does nothing unless staff switched it on and set the days)' })
  auto() { return this.requests.autoApproveTick(); }

  @Get(':id') @ApiOperation({ summary: 'One request with its full history and deliverables' })
  get(@Param('id') id: string) { return this.requests.adminGet(id); }

  @Post(':id/assign') @HttpCode(200) @ApiOperation({ summary: 'Assign a request, set its due time and (for the custom domain promotion) the date the add-on ends' })
  assign(@Param('id') id: string, @Body() dto: AssignRequestDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.requests.assign(id, dto, actorOf(u, req)); }

  @Post(':id/status') @HttpCode(200) @ApiOperation({ summary: 'Move a request to ACCEPTED, IN_PRODUCTION or READY_FOR_REVIEW' })
  status(@Param('id') id: string, @Body() dto: RequestStatusDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.requests.setStatus(id, dto, actorOf(u, req)); }

  @Post(':id/deliverables') @HttpCode(200) @ApiOperation({ summary: 'Add finished work (text, a file reference or an https link)' })
  deliverable(@Param('id') id: string, @Body() dto: DeliverableDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.requests.addDeliverable(id, dto, actorOf(u, req)); }

  @Post(':id/reject') @HttpCode(200) @ApiOperation({ summary: 'Reject a request with a reason: a held amount is released and nothing is charged' })
  reject(@Param('id') id: string, @Body() dto: RejectRequestDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.requests.reject(id, dto, actorOf(u, req)); }

  @Post(':id/retry-grant') @HttpCode(200) @ApiOperation({ summary: 'Retry switching on the custom domain add-on for an approved promotion whose first try failed' })
  retry(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.requests.retryGrant(id, actorOf(u, req)); }
}

/** Staff raise a request FOR a vendor (a reason is required; the same funding rules; never a silent charge: the vendor sees the request, its history and the hold in their ledger). */
@ApiTags('v3-service-requests-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/vendors/:vendorId/service-requests')
export class AdminVendorServiceRequestsController {
  constructor(private readonly requests: ServiceRequestsService) {}

  @Post() @HttpCode(200) @ApiOperation({ summary: 'Raise a request on behalf of a vendor (audited; funding follows the same rules as the vendor\'s own request)' })
  raise(@Param('vendorId') vendorId: string, @Body() dto: RaiseOnBehalfDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.requests.raiseOnBehalf(String(vendorId).slice(0, 64), dto, actorOf(u, req)); }
}
