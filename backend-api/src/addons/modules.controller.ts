import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddonsService } from './addons.service';
import { VendorTargetDto } from './dto/vendor-target.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { staffMayUse } from '../auth/guards/staff-access';
import { RouteKey } from '../common/decorators/route-key.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

function resolveVendorId(user: AuthenticatedUser, vendorId: string | undefined, route: string): string {
  return staffMayUse(user, route) && vendorId ? vendorId : user.sub;
}

@ApiTags('modules')
@ApiBearerAuth()
@Controller('modules')
export class ModulesController {
  constructor(private readonly addonsService: AddonsService) {}

  @Get()
  @ApiOperation({ summary: 'List all available module definitions' })
  listModules() {
    return this.addonsService.listModules();
  }

  @Get('vendor')
  @ApiOperation({ summary: "Get module states for the current vendor (admin may pass ?vendorId=)" })
  getVendorModules(@CurrentUser() user: AuthenticatedUser, @RouteKey() route: string, @Query('vendorId') vendorId?: string) {
    return this.addonsService.getVendorModules(resolveVendorId(user, vendorId, route));
  }

  @UseGuards(AdminGuard)
  @Post('vendor/:key/enable')
  @ApiOperation({ summary: 'Enable a module for a vendor (admin only)' })
  enable(@Param('key') key: string, @Body() dto: VendorTargetDto) {
    return this.addonsService.setModule(dto.vendorId, key, true);
  }

  @UseGuards(AdminGuard)
  @Post('vendor/:key/disable')
  @ApiOperation({ summary: 'Disable a module for a vendor (admin only)' })
  disable(@Param('key') key: string, @Body() dto: VendorTargetDto) {
    return this.addonsService.setModule(dto.vendorId, key, false);
  }
}
