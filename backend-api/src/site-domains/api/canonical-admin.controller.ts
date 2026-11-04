import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { actorOf } from '../../plans/admin/plans-admin.common';
import { CanonicalSwitchService } from '../canonical-switch.service';
import { EndAddonDto, GrantAddonDto } from './dto/canonical.dto';

/**
 * Staff API for the canonical host and the custom-domain promotion add-on (slice 5.6b, owner rule 4). OPERATIONS and SUPER_ADMIN only (MARKETING refused). The add-on is an
 * entitlement override with an end date: it goes through the existing override service, so it needs a reason and is audited there; the switch then records the canonical change.
 */
@ApiTags('v3-canonical-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/vendors')
export class CanonicalAdminController {
  constructor(private readonly canonical: CanonicalSwitchService) {}

  @Get(':id/canonical')
  @ApiOperation({ summary: 'The canonical host now, the host the published pages were built for, and whether the promotion add-on is on' })
  state(@Param('id') id: string) { return this.canonical.state(id); }

  @Post(':id/custom-domain-addon') @HttpCode(200)
  @ApiOperation({ summary: 'Start the custom-domain promotion add-on until an end date (reason required, audited). The custom domain becomes canonical and the subdomain redirects to it.' })
  grant(@Param('id') id: string, @Body() dto: GrantAddonDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.canonical.grantAddon(id, actorOf(user, req), dto.reason, dto.endsAt); }

  @Post(':id/custom-domain-addon/end') @HttpCode(200)
  @ApiOperation({ summary: 'End the add-on now: the canonical host returns to the subdomain through the controlled switch (reason required, audited)' })
  end(@Param('id') id: string, @Body() dto: EndAddonDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) { return this.canonical.endAddon(id, actorOf(user, req), dto.reason); }
}
