import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { VendorCommsService, VendorCommsView } from './vendor-comms.service';
import { AdminUpdateVendorCommsDto } from './dto/update-vendor-comms.dto';

/**
 * Admin-assist: view and override any vendor's communication settings from the
 * admin side — same service, same validation as the vendor's own route, plus the
 * `waStatus` verification flag. Mirrors AdminDomainsController (dispatch
 * 27-Aug-2026): self-service for the vendor, admin-assist for anyone who needs help.
 */
@ApiTags('admin-vendor-comms')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/vendor-comms')
export class AdminVendorCommsController {
  constructor(private readonly service: VendorCommsService) {}

  @Get()
  @ApiOperation({ summary: "Read a vendor's communication settings" })
  get(@Query('vendorId') vendorId: string): Promise<VendorCommsView> {
    return this.service.get(vendorId);
  }

  @Patch()
  @ApiOperation({ summary: "Override a vendor's communication settings (incl. WhatsApp verification status)" })
  update(@Query('vendorId') vendorId: string, @Body() dto: AdminUpdateVendorCommsDto): Promise<VendorCommsView> {
    return this.service.updateAsAdmin(vendorId, dto);
  }
}
