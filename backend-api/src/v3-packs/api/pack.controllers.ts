import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { PackActor, PackEngineService, PACK_SETTING_KEYS } from '../pack-engine.service';
import { EditCategoryDto, EditPackDto, MatrixCellDto, PackSettingDto, RegisterPackDto, SaveTabDto, SetCapabilityDto, VendorAddonDto } from './pack.dto';

const staff = (u: AuthenticatedUser, req: Request): PackActor => ({ type: 'STAFF', id: u?.sub ?? null, ip: req?.ip ?? null });
const owner = (t: TenantContext, req: Request): PackActor => ({ type: 'VENDOR', id: t.memberId ?? t.vendorId, ip: req?.ip ?? null });

/** The categories a business picks from on the registration form, and what the pick offers. Public: no vendor data and no money. */
@ApiTags('v3-packs-public')
@Controller('v3/public/pack-categories')
export class PublicPackController {
  constructor(private readonly packs: PackEngineService) {}

  @Public() @Get() @ApiOperation({ summary: 'Categories a business can register under, with the pack and the minimum tier' })
  list() { return this.packs.categories(); }

  @Public() @Get(':categoryKey') @ApiOperation({ summary: 'What picking this category offers: the pack, the tier, starter services, capabilities (with the tier that has each) and add-on packs' })
  offer(@Param('categoryKey') key: string) { return this.packs.offer(key); }
}

/** The signed-in business: its tab list (owner and team), its pack and capabilities (owner only for changes). */
@ApiTags('v3-packs-me')
@ApiBearerAuth()
@UseTenant()
@Controller('v3/me')
export class MePackController {
  constructor(private readonly packs: PackEngineService) {}

  @Get('navigation') @ApiOperation({ summary: 'The dashboard tab list: common, pack, capability and add-on tabs, each ACTIVE, LOCKED_PREVIEW or HIDDEN' })
  navigation(@Tenant() t: TenantContext) { return this.packs.navigation(t.vendorId); }

  @Get('pack/capabilities') @ApiOperation({ summary: 'Every capability, whether I hold it and whether my tier allows it' })
  capabilities(@Tenant() t: TenantContext) { return this.packs.myCapabilities(t.vendorId); }

  @UseGuards(VendorOwnerGuard) @Post('pack/register') @HttpCode(200) @ApiOperation({ summary: 'Pick the category: sets the one primary pack, the starter services and the capabilities the tier allows' })
  register(@Tenant() t: TenantContext, @Body() dto: RegisterPackDto, @Req() req: Request) { return this.packs.register(t.vendorId, dto, owner(t, req)); }

  @UseGuards(VendorOwnerGuard) @Put('pack/capabilities/:key') @HttpCode(200) @ApiOperation({ summary: 'Switch a capability on (needs the tier) or off (hides it, keeps the records)' })
  setCapability(@Tenant() t: TenantContext, @Param('key') key: string, @Body() dto: SetCapabilityDto, @Req() req: Request) { return this.packs.setCapability(t.vendorId, key, dto.enabled, owner(t, req)); }
}

/**
 * Staff side of the pack engine. Reading: OPERATIONS and SUPER_ADMIN. Every change is SUPER_ADMIN only for now (the staff ADMIN role does not exist yet; Part B adds it), and the tier matrix and the
 * two switches stay SUPER_ADMIN only afterwards. See the entries in auth/guards/admin-role-matrix.ts.
 */
@ApiTags('v3-packs-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/pack-engine')
export class AdminPackController {
  constructor(private readonly packs: PackEngineService) {}

  @Get('packs') @ApiOperation({ summary: 'The 16 packs' })
  listPacks() { return this.packs.adminPacks(); }
  @Get('packs/:key') @ApiOperation({ summary: 'One pack with its tabs' })
  getPack(@Param('key') key: string) { return this.packs.adminPack(key); }
  @Put('packs/:key') @HttpCode(200) @ApiOperation({ summary: 'SUPER_ADMIN: edit a pack (name, switch, review status, stages, sections)' })
  editPack(@Param('key') key: string, @Body() dto: EditPackDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.packs.editPack(key, dto, staff(u, req)); }

  @Get('tabs') @ApiOperation({ summary: 'Every tab definition' })
  listTabs() { return this.packs.adminTabs(); }
  @Put('tabs') @HttpCode(200) @ApiOperation({ summary: 'SUPER_ADMIN: add or change a tab definition' })
  saveTab(@Body() dto: SaveTabDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.packs.saveTab(dto, staff(u, req)); }

  @Get('categories') @ApiOperation({ summary: 'The category to pack map with minimum tier, capabilities and starter services' })
  listCategories() { return this.packs.adminCategories(); }
  @Put('categories/:categoryKey') @HttpCode(200) @ApiOperation({ summary: 'SUPER_ADMIN: change a category (pack, minimum tier, capabilities, starter services)' })
  editCategory(@Param('categoryKey') key: string, @Body() dto: EditCategoryDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.packs.editCategory(key, dto, staff(u, req)); }

  @Get('tier-matrix') @ApiOperation({ summary: 'The tier to capability matrix' })
  matrix() { return this.packs.adminMatrix(); }
  @Put('tier-matrix/:tier/:capabilityKey') @HttpCode(200) @ApiOperation({ summary: 'SUPER_ADMIN only: allow or refuse a capability for a tier' })
  setCell(@Param('tier') tier: string, @Param('capabilityKey') cap: string, @Body() dto: MatrixCellDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.packs.setMatrixCell(tier, cap, dto.allowed, staff(u, req)); }

  @Get('addons') @ApiOperation({ summary: 'The add-on packs (prices PENDING)' })
  addons() { return this.packs.adminAddons(); }
  @Put('vendors/:vendorId/addons/:addonKey') @HttpCode(200) @ApiOperation({ summary: 'SUPER_ADMIN: switch an add-on pack on or off for one vendor (prices are pending, so it cannot be bought yet)' })
  setVendorAddon(@Param('vendorId') vendorId: string, @Param('addonKey') addon: string, @Body() dto: VendorAddonDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.packs.setVendorAddon(vendorId, addon, dto.status, staff(u, req)); }
  @Get('vendors/:vendorId/navigation') @ApiOperation({ summary: 'The tab list one vendor sees (for support)' })
  vendorNav(@Param('vendorId') vendorId: string) { return this.packs.navigation(vendorId); }

  @Get('settings') @ApiOperation({ summary: 'The two pack switches (both default OFF)' })
  settings() { return this.packs.adminSettings(); }
  @Put('settings/:name') @HttpCode(200) @ApiOperation({ summary: 'SUPER_ADMIN only: switch gatedPacksOpen or onlineMedicineCheckout' })
  async setSetting(@Param('name') name: string, @Body() dto: PackSettingDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) {
    if (!Object.prototype.hasOwnProperty.call(PACK_SETTING_KEYS, name)) throw new NotFoundException();
    await this.packs.setSetting(name as keyof typeof PACK_SETTING_KEYS, dto.value, staff(u, req));
    return this.packs.adminSettings();
  }
}
