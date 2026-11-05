import { Body, Controller, Get, HttpCode, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { RATE } from '../../common/throttling';
import { actorOf } from '../../plans/admin/plans-admin.common';
import { Actor } from '../../plans/admin/audit.service';
import { ServicesCatalogService } from '../services.service';
import { ApprovePriceDto, CreatePackDto, CreateServiceDto, EditPriceDto, ProposePriceDto, PurchasePackDto, UpdatePackDto, UpdateServiceDto } from './dto/services.dto';

/** The marketing pages' catalogue. Public and cacheable; only APPROVED prices in force; no internal field and no vendor data. */
@ApiTags('v3-services-public')
@Controller('v3/public/services')
export class PublicServicesController {
  constructor(private readonly services: ServicesCatalogService) {}

  @Public() @Throttle(RATE.directoryRead) @Get()
  @ApiOperation({ summary: 'The services our team offers, with their approved prices (nothing is listed without one)' })
  async list(@Res({ passthrough: true }) res: Response) { res.set('Cache-Control', 'public, max-age=300'); return this.services.publicCatalogue(); }
}

/** The signed-in OWNER. The vendor is ALWAYS the verified principal's vendor. Owner only: the lists show the wallet and prices, and buying a pack spends money. */
@ApiTags('v3-services-vendor')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me')
export class MeServicesController {
  constructor(private readonly services: ServicesCatalogService) {}
  private actor(user: AuthenticatedUser, req: Request): Actor { return { type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null }; }

  @Get('services') @ApiOperation({ summary: 'Every service with what it includes, who does it, how approval works, its price and tax, what my plan and packs still cover, and how it would be paid' })
  list(@Tenant() t: TenantContext) { return this.services.vendorServices(t.vendorId); }

  @Get('packs') @ApiOperation({ summary: 'Add-on packs I can buy, with their approved prices, and the packs I have bought' })
  packs(@Tenant() t: TenantContext) { return this.services.vendorPacks(t.vendorId); }

  @Throttle(RATE.payment) @Post('packs/:key/purchase') @HttpCode(200)
  @ApiOperation({ summary: 'Buy a pack with wallet credit (idempotent by key). The charge and the purchase are recorded together.' })
  purchase(@Tenant() t: TenantContext, @Param('key') key: string, @Body() dto: PurchasePackDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.services.purchasePack(t.vendorId, key, dto.idempotencyKey, this.actor(user, req)); }
}

const noPrices = (u: AuthenticatedUser): boolean => u?.adminRole === 'MARKETING';

/**
 * Staff side of the catalogue and the price book. Reading the catalogue: all staff (MARKETING sees no money field). Changing services and packs, proposing and editing prices: OPERATIONS and
 * SUPER_ADMIN. APPROVING or RETIRING a price: SUPER_ADMIN only. Every change is audited. The seed proposes one price only (never approves it); no price is ever set by code.
 */
@ApiTags('v3-services-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/services')
export class AdminServicesController {
  constructor(private readonly services: ServicesCatalogService) {}

  @Get() @ApiOperation({ summary: 'All services (MARKETING sees no prices)' })
  list(@CurrentUser() u: AuthenticatedUser) { return this.services.adminServices(!noPrices(u)); }

  @Post() @HttpCode(200) @ApiOperation({ summary: 'Add a service (a DRAFT unless told otherwise)' })
  create(@Body() dto: CreateServiceDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.services.createService(dto, actorOf(u, req)); }

  @Put('prices/:id') @ApiOperation({ summary: 'Change a PROPOSED price' })
  editPrice(@Param('id') id: string, @Body() dto: EditPriceDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.services.editProposedPrice('service', id, dto, actorOf(u, req)); }

  @Post('prices/:id/approve') @HttpCode(200) @ApiOperation({ summary: 'SUPER_ADMIN: approve a proposed price from a date (required, not in the past, later than the price in force)' })
  approvePrice(@Param('id') id: string, @Body() dto: ApprovePriceDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.services.approvePrice('service', id, dto, actorOf(u, req)); }

  @Post('prices/:id/retire') @HttpCode(200) @ApiOperation({ summary: 'SUPER_ADMIN: retire a price' })
  retirePrice(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.services.retirePrice('service', id, actorOf(u, req)); }

  @Get(':key') @ApiOperation({ summary: 'One service (with its prices, except for MARKETING)' })
  get(@Param('key') key: string, @CurrentUser() u: AuthenticatedUser) { return this.services.adminService(key, !noPrices(u)); }

  @Put(':key') @ApiOperation({ summary: 'Change a service (the key never changes)' })
  update(@Param('key') key: string, @Body() dto: UpdateServiceDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.services.updateService(key, dto, actorOf(u, req)); }

  @Post(':key/prices') @HttpCode(200) @ApiOperation({ summary: 'Propose a price for a service (a proposal is never in force until a SUPER_ADMIN approves it)' })
  propose(@Param('key') key: string, @Body() dto: ProposePriceDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.services.proposePrice('service', key, dto, actorOf(u, req)); }
}

@ApiTags('v3-services-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/packs')
export class AdminPacksController {
  constructor(private readonly services: ServicesCatalogService) {}

  @Get() @ApiOperation({ summary: 'All add-on packs (MARKETING sees no prices)' })
  list(@CurrentUser() u: AuthenticatedUser) { return this.services.adminPacks(!noPrices(u)); }

  @Post() @HttpCode(200) @ApiOperation({ summary: 'Add a pack (a DRAFT unless told otherwise)' })
  create(@Body() dto: CreatePackDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.services.createPack(dto, actorOf(u, req)); }

  @Put('prices/:id') @ApiOperation({ summary: 'Change a PROPOSED pack price' })
  editPrice(@Param('id') id: string, @Body() dto: EditPriceDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.services.editProposedPrice('pack', id, dto, actorOf(u, req)); }

  @Post('prices/:id/approve') @HttpCode(200) @ApiOperation({ summary: 'SUPER_ADMIN: approve a proposed pack price from a date' })
  approvePrice(@Param('id') id: string, @Body() dto: ApprovePriceDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.services.approvePrice('pack', id, dto, actorOf(u, req)); }

  @Post('prices/:id/retire') @HttpCode(200) @ApiOperation({ summary: 'SUPER_ADMIN: retire a pack price' })
  retirePrice(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.services.retirePrice('pack', id, actorOf(u, req)); }

  @Get(':key') @ApiOperation({ summary: 'One pack (with its prices, except for MARKETING)' })
  get(@Param('key') key: string, @CurrentUser() u: AuthenticatedUser) { return this.services.adminPack(key, !noPrices(u)); }

  @Put(':key') @ApiOperation({ summary: 'Change a pack (the key never changes)' })
  update(@Param('key') key: string, @Body() dto: UpdatePackDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.services.updatePack(key, dto, actorOf(u, req)); }

  @Post(':key/prices') @HttpCode(200) @ApiOperation({ summary: 'Propose a price for a pack' })
  propose(@Param('key') key: string, @Body() dto: ProposePriceDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.services.proposePrice('pack', key, dto, actorOf(u, req)); }
}
