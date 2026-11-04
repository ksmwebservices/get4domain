import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RATE } from '../../common/throttling';
import { actorOf, pageArgs, paged } from '../../plans/admin/plans-admin.common';
import { SiteDomainsService } from '../site-domains.service';
import { DomainListDto, ForceStateDto, RemoveDomainDto, StaffSubdomainDto } from './dto/domain.dto';

/**
 * Staff API for vendors' addresses. Role matrix: OPERATIONS and SUPER_ADMIN only, reads included (a host name can identify a business), MARKETING is refused on every route.
 * Every write is audited with the staff member, and a reason is required where staff override the owner.
 */
@ApiTags('v3-domains-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin')
export class DomainsAdminController {
  constructor(private readonly domains: SiteDomainsService) {}

  @Get('domains')
  @ApiOperation({ summary: 'All domains, newest first, filtered by vendor, status, kind or host text' })
  async list(@Query() q: DomainListDto) {
    const { skip, take, page, pageSize } = pageArgs(q);
    const { items, total } = await this.domains.listAll({ vendorId: q.vendorId, status: q.status, kind: q.kind, q: q.q, skip, take });
    return paged(items, total, page, pageSize);
  }

  @Get('domains/:id')
  @ApiOperation({ summary: 'One domain with its verification state' })
  one(@Param('id') id: string) { return this.domains.get(null, id); }

  @Throttle(RATE.domainVerify)
  @Post('domains/:id/verify') @HttpCode(200)
  @ApiOperation({ summary: 'Check a domain now (reads the DNS TXT record; rate limited)' })
  verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.domains.verify(null, id, actorOf(user, req)); }

  @Put('domains/:id/state') @HttpCode(200)
  @ApiOperation({ summary: 'Force a domain state and/or record its SSL status (reason required, audited). Nothing issues a certificate.' })
  state(@Param('id') id: string, @Body() dto: ForceStateDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.domains.forceState(id, dto, actorOf(user, req)); }

  @Post('domains/:id/primary') @HttpCode(200)
  @ApiOperation({ summary: 'Make an active domain its vendor main address' })
  primary(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.domains.makePrimary(null, id, actorOf(user, req)); }

  @Post('domains/:id/remove') @HttpCode(200)
  @ApiOperation({ summary: 'Remove a custom domain on behalf of the owner (audited)' })
  remove(@Param('id') id: string, @Body() dto: RemoveDomainDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.domains.remove(null, id, actorOf(user, req), dto.reason); }

  @Put('vendors/:id/domains/subdomain') @HttpCode(200)
  @ApiOperation({ summary: 'Set a vendor free subdomain on their behalf (the change limit does not apply; reason required, audited)' })
  subdomain(@Param('id') vendorId: string, @Body() dto: StaffSubdomainDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.domains.staffSetSubdomain(vendorId, dto.slug, dto.reason, actorOf(user, req)); }
}
