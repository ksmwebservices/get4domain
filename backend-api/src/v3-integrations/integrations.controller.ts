import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { IntegrationSettingsService } from './integration-settings.service';

/**
 * Every field is optional HERE on purpose: the real checks are in the pure core (integrations-core.ts), so every refusal carries the registered code INTEGRATION_INVALID and names the FIELD, never a value.
 * A property outside this list is refused by the validation pipe, which names the property and never echoes a value.
 */
export class IntegrationSetDto {
  @IsOptional() resellerId?: unknown;
  @IsOptional() apiKey?: unknown;
  @IsOptional() mode?: unknown;
  @IsOptional() sender?: unknown;
  @IsOptional() monthlyCapRupees?: unknown;
}

const actorOf = (u: AuthenticatedUser, req: Request) => ({ id: u?.sub ?? null, ip: req?.ip ?? null });

/**
 * The platform integration settings (R1.1): SUPER_ADMIN only, in every method (the role matrix; ADMIN is refused). WRITE-ONLY: no route returns a secret. A secret field reads "set" or "not set"; the
 * answer adds who saved the provider and when. Saving, clearing and testing are audited. The TEST route makes one harmless read at the provider (no e-mail, no purchase, no model run).
 */
@ApiTags('v3-integrations')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/integrations')
export class IntegrationsController {
  constructor(private readonly settings: IntegrationSettingsService) {}

  @Get() @ApiOperation({ summary: 'SUPER_ADMIN: every provider (ResellerClub, e-mail, WhatsApp, SMS, Claude) with its state, who saved it and when, and each field as set or not set. Never a secret.' })
  list() { return this.settings.status(); }

  @Get(':provider') @ApiOperation({ summary: 'SUPER_ADMIN: one provider as set or not set, with the date it was saved. Never a secret.' })
  one(@Param('provider') provider: string) { return this.settings.statusOf(provider); }

  @Put(':provider') @HttpCode(200)
  @ApiOperation({ summary: 'SUPER_ADMIN, audited, write-only: save the full set of one provider, encrypted at rest (resellerclub: resellerId, apiKey, mode demo or live; email: apiKey, sender; claude: apiKey, monthlyCapRupees). Replaces the set. WhatsApp and SMS are not available. The answer is the status, never a value.' })
  set(@Param('provider') provider: string, @Body() dto: IntegrationSetDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.settings.set(provider, dto, actorOf(u, req)); }

  @Delete(':provider') @HttpCode(200)
  @ApiOperation({ summary: 'SUPER_ADMIN, audited: remove the saved set of one provider. Clearing what is not there changes nothing.' })
  clear(@Param('provider') provider: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.settings.clear(provider, actorOf(u, req)); }

  @Post(':provider/test') @HttpCode(200)
  @ApiOperation({ summary: 'SUPER_ADMIN, audited: ask the provider whether it accepts the SAVED details, with one harmless read. A state (OK, NOT_CONFIGURED, ACCESS_DENIED, REJECTED, TIMEOUT, UNREACHABLE, REGISTRAR_OFF) and a plain sentence.' })
  test(@Param('provider') provider: string, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.settings.test(provider, actorOf(u, req)); }
}
