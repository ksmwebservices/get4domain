import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf, pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { RequestKind, RequestStatus } from '../core/requests-core';
import { StaffRequestsService } from '../staff-requests.service';
import { BlockDto, HandleReportDto, OutboxQueryDto, PageDto, ReportsQueryDto, StaffRequestsQueryDto } from './dto/requests.dto';

/** Staff API for the bridge (slice 5.14). OPERATIONS and SUPER_ADMIN only; MARKETING is refused on every route (requests, the outbox and reports identify customers and businesses). */
@ApiTags('v3-requests-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class AdminRequestsController {
  constructor(private readonly staff: StaffRequestsService) {}

  @Get('requests') @ApiOperation({ summary: 'Requests across vendors (no customer e-mail or phone)' })
  async requests(@Query() q: StaffRequestsQueryDto) { const { skip, take, page, pageSize } = pageArgs(q); const r = await this.staff.requests({ vendorId: q.vendorId, status: q.status as RequestStatus, kind: q.kind as RequestKind, skip, take }); return paged(r.items, r.total, page, pageSize); }
  @Get('vendors/:vendorId/payment-methods') @ApiOperation({ summary: 'The payment methods of one business, read only: the UPI id is masked, no bank details or secrets' }) vendorMethods(@Param('vendorId') vendorId: string) { return this.staff.vendorMethods(vendorId); }
  @Get('requests/:id') @ApiOperation({ summary: 'One request with its events' }) request(@Param('id') id: string) { return this.staff.request(id); }
  @Get('message-outbox') @ApiOperation({ summary: 'The sandbox message outbox (recipients masked)' })
  async outbox(@Query() q: OutboxQueryDto) { const { skip, take, page, pageSize } = pageArgs(q); const r = await this.staff.outbox({ vendorId: q.vendorId, requestId: q.requestId, skip, take }); return paged(r.items, r.total, page, pageSize); }

  @Get('reports') @ApiOperation({ summary: 'Reports about business sites' })
  async reports(@Query() q: ReportsQueryDto) { const { skip, take, page, pageSize } = pageArgs(q); const r = await this.staff.reports({ status: q.status, skip, take }); return paged(r.items, r.total, page, pageSize); }
  @Post('reports/:id/handle') @HttpCode(200) @ApiOperation({ summary: 'Handle a report; ACTIONED with a vendor id suspends that vendor and stops their public forms and checkout at once' })
  handle(@Param('id') id: string, @Body() dto: HandleReportDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.staff.handleReport(id, dto.status, actorOf(u, req), dto.suspendVendorId, dto.reason); }

  @Get('blocklist') @ApiOperation({ summary: 'The blocklist (hash prefixes only)' })
  async blocks(@Query() q: PageDto) { const { skip, take, page, pageSize } = pageArgs(q); const r = await this.staff.blocks(skip, take); return paged(r.items, r.total, page, pageSize); }
  @Post('blocklist') @HttpCode(200) @ApiOperation({ summary: 'Block a phone, an e-mail address or a network (stored as a keyed hash; reason required)' })
  add(@Body() dto: BlockDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.staff.addBlock(dto.kind, dto.value, dto.reason, actorOf(u, req)); }
  @Delete('blocklist/:id') @HttpCode(200) @ApiOperation({ summary: 'Remove a blocklist entry' })
  remove(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.staff.removeBlock(id, actorOf(u, req)); }
}
