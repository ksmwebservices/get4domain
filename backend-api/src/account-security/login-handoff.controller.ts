import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional } from 'class-validator';
import type { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RATE } from '../common/throttling';
import { HandoffCode, LoginHandoffService } from './login-handoff.service';
import { Tokens } from './session.service';

/** No format validator on purpose: a malformed, missing or oversize code must be the same 401 HANDOFF_INVALID as an unknown one, so the answer says nothing about the format (the service checks it). */
export class RedeemHandoffDto { @IsOptional() code?: unknown }

/** The sign-in handoff from the public site to the vendor app (Wave 2, gap G2). HTTP only; the rules are in LoginHandoffService. */
@ApiTags('auth-handoff')
@Controller('v3/auth/handoff')
export class LoginHandoffController {
  constructor(private readonly handoff: LoginHandoffService) {}

  @ApiBearerAuth() @Throttle(RATE.sessionRefresh) @Post() @HttpCode(200)
  @ApiOperation({ summary: 'A signed-in business owner asks for a one-time code that signs them in on the vendor app. It lives for seconds and works once. Put it in the URL fragment, never the query.' })
  issue(@CurrentUser() user: AuthenticatedUser, @Req() req: Request): Promise<HandoffCode> { return this.handoff.issue(user, req.ip ?? null); }

  @Public() @Throttle(RATE.login) @Post('redeem') @HttpCode(200)
  @ApiOperation({ summary: 'Swap a handoff code for a session (access and refresh token). Every failure is the same 401 HANDOFF_INVALID.' })
  redeem(@Body() dto: RedeemHandoffDto, @Headers('user-agent') userAgent?: string): Promise<Tokens> { return this.handoff.redeem(dto.code as string, userAgent); }
}
