import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { VendorOwnerGuard } from '../../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../../common/tenant/tenant.guard';
import { TenantContext } from '../../common/tenant/tenant.types';
import { AccountDeletionService } from '../account-deletion.service';
import { DeletionRequestDto } from './dto/lifecycle.dto';

/**
 * The signed-in owner asks for their account to be deleted for good. OWNER ONLY (a team member is refused). The vendor is ALWAYS the verified principal's vendor.
 * Step 1 (no code) sends a fresh code and returns the warning; step 2 (code without confirm) asks for confirmation; step 3 (code and confirm=true) joins the staff queue.
 */
@ApiTags('v3-account')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/account')
export class MeAccountController {
  constructor(private readonly deletion: AccountDeletionService) {}

  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @Post('deletion-request') @HttpCode(200)
  @ApiOperation({ summary: 'Ask for my account, site and directory listing to be removed permanently (fresh one-time code and a confirmation step)' })
  request(@Tenant() t: TenantContext, @Body() dto: DeletionRequestDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.deletion.request(t.vendorId, user?.sub ?? null, { type: 'VENDOR', id: user?.sub ?? null, ip: req?.ip ?? null }, dto);
  }
}
