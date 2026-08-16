import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IndustriesService, VendorConfigOverride } from './industries.service';
import { Public } from '../common/decorators/public.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UpdateVendorOverrideDto } from './dto/vendor-override.dto';

@ApiTags('industries')
@Controller('industries')
export class IndustriesController {
  constructor(private readonly industriesService: IndustriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List industry configs (full, or ?summary=true for key/label/icon only)' })
  findAll(@Query('summary') summary?: string) {
    if (summary === 'true') {
      return this.industriesService.findAllSummary();
    }
    return this.industriesService.findAll();
  }

  // NOTE: declared before ':key' so these static/segmented routes win over the param.
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: "The caller vendor's resolved config (industry skin + per-vendor override) — 3C" })
  resolveMine(@CurrentUser() user: AuthenticatedUser) {
    return this.industriesService.resolveForVendor(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Get('vendor/:vendorId/override')
  @ApiOperation({ summary: "Get a vendor's per-vendor config override (admin) — 3C" })
  getOverride(@Param('vendorId') vendorId: string): Promise<VendorConfigOverride> {
    return this.industriesService.getOverride(vendorId);
  }

  @ApiBearerAuth()
  @UseGuards(AdminGuard)
  @Put('vendor/:vendorId/override')
  @ApiOperation({ summary: "Set a vendor's per-vendor config override (admin, applied live) — 3C" })
  setOverride(@Param('vendorId') vendorId: string, @Body() dto: UpdateVendorOverrideDto): Promise<VendorConfigOverride> {
    return this.industriesService.setOverride(vendorId, dto);
  }

  @Public()
  @Get(':key')
  @ApiOperation({ summary: 'Get a single industry config (drives per-vendor dashboard rendering)' })
  findOne(@Param('key') key: string) {
    return this.industriesService.findOne(key);
  }
}
