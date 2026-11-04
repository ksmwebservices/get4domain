import { Body, Controller, Get, HttpCode, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { DirectoryVisitService } from '../directory-visit.service';
import { MeDirectoryService } from '../me-directory.service';
import { MyProfileDto, VisitStatsDto } from './dto/directory.dto';

/** The signed-in owner's own directory profile. The vendor is the verified principal's vendor (@UseTenant): never in the URL, query or body. Owner only. */
@ApiTags('v3-directory-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/directory')
export class MeDirectoryController {
  constructor(private readonly me: MeDirectoryService, private readonly visits: DirectoryVisitService) {}

  @Get()
  @ApiOperation({ summary: 'My directory profile (or that I have none yet)' })
  get(@Tenant() t: TenantContext) { return this.me.get(t.vendorId); }

  @Get('stats')
  @ApiOperation({ summary: 'How many people clicked Visit site on my listing, per day (Free and Pro both; counts only)' })
  stats(@Tenant() t: TenantContext, @Query() q: VisitStatsDto) { return this.visits.stats(t.vendorId, q.days); }

  @Put() @HttpCode(200)
  @ApiOperation({ summary: 'Edit my directory profile fields; the first save also needs categorySlug and locationPath. Slug, status and indexing are not editable here.' })
  put(@Tenant() t: TenantContext, @Body() dto: MyProfileDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.me.put(t.vendorId, dto, { type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null });
  }
}
