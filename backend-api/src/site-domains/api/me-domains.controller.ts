import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { RATE } from '../../common/throttling';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { Actor } from '../../plans/admin/audit.service';
import { SiteDomainsService } from '../site-domains.service';
import { CustomDomainDto, SubdomainDto } from './dto/domain.dto';

/**
 * The signed-in vendor's own addresses. The vendor is ALWAYS the verified principal's vendor (@UseTenant): no vendor id in the URL, query or body.
 * Everything here changes what the public sees or what the business owns, so it is OWNER ONLY (team members are refused).
 * Another vendor's domain id answers exactly like an id that does not exist.
 */
@ApiTags('v3-domains')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/domains')
export class MeDomainsController {
  constructor(private readonly domains: SiteDomainsService) {}

  private actor(user: AuthenticatedUser, req: Request): Actor { return { type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null }; }

  @Get()
  @ApiOperation({ summary: 'My addresses: the free subdomain, custom domains, the main address, and whether my plan allows my own domain' })
  overview(@Tenant() t: TenantContext) { return this.domains.overview(t.vendorId); }

  @Put('subdomain') @HttpCode(200)
  @ApiOperation({ summary: 'Reserve or change my free subdomain (rules, reserved names and a change limit apply)' })
  subdomain(@Tenant() t: TenantContext, @Body() dto: SubdomainDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.domains.setSubdomain(t.vendorId, dto.slug, this.actor(user, req)); }

  @Post('custom') @HttpCode(200)
  @ApiOperation({ summary: 'Add my own domain (needs a plan with custom domains); returns the DNS TXT record to create' })
  custom(@Tenant() t: TenantContext, @Body() dto: CustomDomainDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.domains.requestCustom(t.vendorId, dto.hostname, this.actor(user, req)); }

  @Get(':id')
  @ApiOperation({ summary: 'One of my domains, with the TXT instructions and the last check' })
  one(@Tenant() t: TenantContext, @Param('id') id: string) { return this.domains.get(t.vendorId, id); }

  @Throttle(RATE.domainVerify)
  @Post(':id/verify') @HttpCode(200)
  @ApiOperation({ summary: 'Check my domain now (reads the DNS TXT record; rate limited)' })
  verify(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.domains.verify(t.vendorId, id, this.actor(user, req)); }

  @Post(':id/primary') @HttpCode(200)
  @ApiOperation({ summary: 'Make this active address my main address' })
  primary(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.domains.makePrimary(t.vendorId, id, this.actor(user, req)); }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove one of my custom domains (the free subdomain cannot be removed; change it instead)' })
  remove(@Tenant() t: TenantContext, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.domains.remove(t.vendorId, id, this.actor(user, req)); }
}
