import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { VendorCommsService, VendorCommsView } from './vendor-comms.service';
import { UpdateVendorCommsDto } from './dto/update-vendor-comms.dto';

/**
 * Vendor-facing self-service for the three communication channels.
 * Scoped to the caller's own vendor id — there is no vendorId parameter here,
 * so one vendor can never read or write another's settings. Admin does that
 * through AdminVendorCommsController.
 */
@ApiTags('vendor-comms')
@ApiBearerAuth()
@RequireModule('communication')
@Controller('vendor-comms')
export class VendorCommsController {
  constructor(private readonly service: VendorCommsService) {}

  @Get()
  @ApiOperation({ summary: "The current vendor's WhatsApp / SMS / Email settings" })
  get(@CurrentUser() user: AuthenticatedUser): Promise<VendorCommsView> {
    return this.service.get(user.sub);
  }

  @Patch()
  @ApiOperation({ summary: 'Update your own communication settings (WhatsApp number + SMS/Email branding)' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateVendorCommsDto): Promise<VendorCommsView> {
    return this.service.updateSelf(user.sub, dto);
  }
}
