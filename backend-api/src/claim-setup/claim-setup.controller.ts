import { Body, Controller, Headers, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { VendorOwnerGuard } from '../common/guards/vendor-owner.guard';
import { Tenant, UseTenant } from '../common/tenant/tenant.guard';
import { TenantContext } from '../common/tenant/tenant.types';
import { RATE } from '../common/throttling';
import { ApproveResult, ClaimSetupService, SetupResult } from './claim-setup.service';

export class ClaimSetupDto {
  @IsString() @MinLength(20) @MaxLength(200) setupToken!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsBoolean() acceptTerms!: boolean;
  /** needed only for a business made on its behalf that has no real email address yet */
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
}

/** After the claim code: the owner redeems the account-setup grant here (public: the grant is the credential, single use, short lived). */
@ApiTags('v3-claim')
@Controller('v3/claim')
export class ClaimSetupController {
  constructor(private readonly setup: ClaimSetupService) {}

  @Public() @Throttle(RATE.otpVerify) @Post('setup') @HttpCode(200)
  @ApiOperation({ summary: 'Redeem the account-setup grant returned by code verification: accept the current Terms and policies, choose a password (and a login email when the business has none). The grant is spent only when everything is valid.' })
  redeem(@Body() dto: ClaimSetupDto, @Req() req: Request, @Headers('user-agent') ua?: string): Promise<SetupResult> {
    return this.setup.setup(dto, { ip: req.ip ?? null, userAgent: ua ? String(ua).slice(0, 300) : null });
  }
}

/** The signed-in owner approves the claimed business: the site is built and published on its subdomain. */
@ApiTags('v3-claim-me')
@ApiBearerAuth()
@UseTenant()
@UseGuards(VendorOwnerGuard)
@Controller('v3/me/claim')
export class MeClaimController {
  constructor(private readonly setup: ClaimSetupService) {}

  @Post('approve') @HttpCode(200)
  @ApiOperation({ summary: 'Approve my claimed business: the site goes live on my subdomain (needs the current Terms and policies accepted; repeating it changes nothing)' })
  approve(@Tenant() t: TenantContext, @CurrentUser() u: AuthenticatedUser, @Req() req: Request): Promise<ApproveResult> {
    return this.setup.approve(t.vendorId, { type: 'VENDOR', id: u?.sub ?? null, ip: req.ip ?? null });
  }
}
