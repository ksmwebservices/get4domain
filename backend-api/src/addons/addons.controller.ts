import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddonsService } from './addons.service';
import { VendorTargetDto } from './dto/vendor-target.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

function resolveVendorId(user: AuthenticatedUser, vendorId?: string): string {
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  return isAdmin && vendorId ? vendorId : user.sub;
}

@ApiTags('addons')
@ApiBearerAuth()
@Controller('addons')
export class AddonsController {
  constructor(private readonly addonsService: AddonsService) {}

  @Get()
  @ApiOperation({ summary: 'List all available addon definitions' })
  listAddons() {
    return this.addonsService.listAddons();
  }

  @Get('vendor')
  @ApiOperation({ summary: "Get addon states for the current vendor (admin may pass ?vendorId=)" })
  getVendorAddons(@CurrentUser() user: AuthenticatedUser, @Query('vendorId') vendorId?: string) {
    return this.addonsService.getVendorAddons(resolveVendorId(user, vendorId));
  }

  @UseGuards(AdminGuard)
  @Post('vendor/:key/enable')
  @ApiOperation({ summary: 'Enable an addon for a vendor (admin only)' })
  enable(@Param('key') key: string, @Body() dto: VendorTargetDto) {
    return this.addonsService.setAddon(dto.vendorId, key, true);
  }

  @UseGuards(AdminGuard)
  @Post('vendor/:key/disable')
  @ApiOperation({ summary: 'Disable an addon for a vendor (admin only)' })
  disable(@Param('key') key: string, @Body() dto: VendorTargetDto) {
    return this.addonsService.setAddon(dto.vendorId, key, false);
  }
}
