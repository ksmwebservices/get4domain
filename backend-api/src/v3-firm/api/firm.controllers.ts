import { Body, Controller, Get, HttpCode, Put, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional } from 'class-validator';
import type { Request, Response } from 'express';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { FirmService } from '../firm.service';

/** Every field is optional (a field not sent is left alone); a nullable one may be null or empty to clear it. The real checks (type, length, GSTIN layout and state code, PAN, email, phone) are in the pure core, so every refusal is FIRM_PROFILE_INVALID (a validator here would answer 400 with no code). */
export class FirmEditDto {
  @IsOptional() legalName?: unknown;
  @IsOptional() registeredAddress?: unknown;
  @IsOptional() gstin?: unknown;
  @IsOptional() pan?: unknown;
  @IsOptional() registeredEmail?: unknown;
  @IsOptional() registeredPhone?: unknown;
}

/** The footer data for everyone: the company name, its registered address and the GSTIN only when one is set. Cacheable for a few minutes. */
@ApiTags('v3-firm-public')
@Controller('v3/public/firm')
export class PublicFirmController {
  constructor(private readonly firm: FirmService) {}

  @Public() @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get()
  @ApiOperation({ summary: 'The company name, registered address and (only when set) the GSTIN, for a footer' })
  async view(@Res({ passthrough: true }) res: Response) { res.set('Cache-Control', 'public, max-age=300'); return this.firm.publicView(); }
}

/** Staff side. WHO may call each route is DATA in admin-role-matrix.ts: SUPER_ADMIN only, for reading and for editing (the profile holds the PAN, email and phone). Every edit is audited. */
@ApiTags('v3-firm-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('v3/admin/firm-profile')
export class AdminFirmController {
  constructor(private readonly firm: FirmService) {}

  @Get() @ApiOperation({ summary: 'The full firm profile (SUPER_ADMIN)' })
  get() { return this.firm.get(); }

  @Put() @HttpCode(200) @ApiOperation({ summary: 'SUPER_ADMIN, audited: change the company name, address, GSTIN, PAN, registered email or phone. A bad GSTIN is refused with FIRM_PROFILE_INVALID.' })
  edit(@Body() dto: FirmEditDto, @CurrentUser() u: AuthenticatedUser, @Req() req: Request) { return this.firm.update(dto, { id: u?.sub ?? null, ip: req?.ip ?? null }); }
}
