import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { RATE } from '../../common/throttling';
import { actorOf, pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { TICKET_CATEGORIES, TICKET_STATUSES } from '../core/support-core';
import { SupportService } from '../support.service';

export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
export class CreateTicketDto {
  @IsString() @MaxLength(200) subject!: string;
  @IsOptional() @IsIn([...TICKET_CATEGORIES]) category?: string;
  @IsString() @MaxLength(6000) body!: string;
  @IsOptional() @IsString() @MaxLength(64) attachmentPictureId?: string;
}
export class ReplyDto {
  @IsString() @MaxLength(6000) body!: string;
  @IsOptional() @IsString() @MaxLength(64) attachmentPictureId?: string;
}
export class PublicTicketDto {
  @IsOptional() @IsString() @MaxLength(80) subdomain?: string;
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MaxLength(200) subject!: string;
  @IsOptional() @IsIn([...TICKET_CATEGORIES]) category?: string;
  @IsString() @MaxLength(6000) body!: string;
}
export class AdminTicketListDto extends PageDto {
  @IsOptional() @IsIn([...TICKET_STATUSES]) status?: string;
  @IsOptional() @IsString() @MaxLength(64) vendorId?: string;
  @IsOptional() @IsString() @MaxLength(64) assignedTo?: string;
  @IsOptional() @IsIn(['VENDOR', 'CUSTOMER']) requesterType?: string;
}
export class AssignDto { @IsOptional() @IsString() @MaxLength(64) staffId?: string | null }
export class StatusDto { @IsIn([...TICKET_STATUSES]) status!: string; @IsOptional() @IsIn([...TICKET_STATUSES]) expectedStatus?: string }

/** A business's own support tickets. Owner only (tickets can carry account details). Available to every business on every plan: support is not a plan feature. */
@ApiTags('v3-support-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/tickets')
export class MeTicketsController {
  constructor(private readonly support: SupportService) {}

  @Post() @HttpCode(200) @Throttle(RATE.publicAction) @ApiOperation({ summary: 'Open a support request' })
  create(@Tenant() t: TenantContext, @CurrentUser() u: AuthenticatedUser, @Req() req: Request, @Body() b: CreateTicketDto) { return this.support.create(t.vendorId, { type: 'VENDOR', id: u?.sub ?? null, ip: req?.ip ?? null }, b); }
  @Get() @ApiOperation({ summary: 'My support requests, most recently active first' })
  async list(@Tenant() t: TenantContext, @Query() q: PageDto) { const { page, pageSize } = pageArgs(q); const r = await this.support.list(t.vendorId, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Get(':id') @ApiOperation({ summary: 'One support request with its messages' })
  get(@Tenant() t: TenantContext, @Param('id') id: string) { return this.support.get(t.vendorId, id); }
  @Post(':id/messages') @HttpCode(200) @ApiOperation({ summary: 'Reply on my support request' })
  reply(@Tenant() t: TenantContext, @CurrentUser() u: AuthenticatedUser, @Req() req: Request, @Param('id') id: string, @Body() b: ReplyDto) { return this.support.reply(t.vendorId, { type: 'VENDOR', id: u?.sub ?? null, ip: req?.ip ?? null }, id, b); }
}

/** The public form of a business's site: a visitor writes to Get4Domain support. Off until staff set the per-address limit. Throttled per client address as well. */
@ApiTags('v3-support-public')
@Public()
@Controller('v3/public/support-tickets')
export class PublicTicketsController {
  constructor(private readonly support: SupportService) {}

  @Post() @HttpCode(200) @Throttle(RATE.publicAction) @ApiOperation({ summary: 'A visitor sends a support request (no account needed)' })
  create(@Body() b: PublicTicketDto) { return this.support.createPublic(b); }
}

/** Staff support desk. OPERATIONS and SUPER_ADMIN (MARKETING refused). Staff reply, assign and set the status; the business is told by a notice that points to the signed-in area. */
@ApiTags('v3-support-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/tickets')
export class AdminTicketsController {
  constructor(private readonly support: SupportService) {}

  @Get() @ApiOperation({ summary: 'Every support ticket, filtered by status, business, assignee or who raised it' })
  async list(@Query() q: AdminTicketListDto) { const { page, pageSize } = pageArgs(q); const r = await this.support.adminList({ status: q.status, vendorId: q.vendorId, assignedToStaffId: q.assignedTo, requesterType: q.requesterType }, page, pageSize); return paged(r.items, r.total, page, pageSize); }
  @Get(':id') @ApiOperation({ summary: 'One ticket with its messages' })
  get(@Param('id') id: string) { return this.support.adminGet(id); }
  @Put(':id/assignee') @HttpCode(200) @ApiOperation({ summary: 'Assign a ticket to a staff member, or clear the assignment' })
  assign(@Param('id') id: string, @Body() b: AssignDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.support.adminAssign(actorOf(u, req), id, b.staffId ?? null); }
  @Put(':id/status') @HttpCode(200) @ApiOperation({ summary: 'Set a ticket status (refused if the status changed since it was read, when the caller says what it saw)' })
  status(@Param('id') id: string, @Body() b: StatusDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.support.adminSetStatus(actorOf(u, req), id, b.status, b.expectedStatus); }
  @Post(':id/messages') @HttpCode(200) @ApiOperation({ summary: 'Staff reply on a ticket' })
  reply(@Param('id') id: string, @Body() b: ReplyDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.support.adminReply(actorOf(u, req), id, b); }
}
