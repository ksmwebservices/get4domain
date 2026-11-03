import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { LoginDto } from '../auth/dto/login.dto';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RATE } from '../common/throttling';
import { ChangePasswordDto, ForgotPasswordDto, RefreshTokenDto, ResetPasswordDto } from './dto/password.dto';
import { PasswordService } from './password.service';
import { SessionResult, SessionService, Tokens } from './session.service';

const FORGOT_REPLY = 'If an account exists for that email, a password reset link has been sent.';

/**
 * Sessions with rotating refresh tokens, and password reset / change (S13). Controller: HTTP only; the rules live in the two services.
 * `/auth/login` and `/auth/refresh` are unchanged and keep working for the current frontend; these routes are the safe replacements.
 */
@ApiTags('auth-security')
@Controller('auth')
export class AccountSecurityController {
  constructor(private readonly sessions: SessionService, private readonly passwords: PasswordService) {}

  @Public()
  @Throttle(RATE.login)
  @HttpCode(200)
  @Post('session/login')
  @ApiOperation({ summary: 'Sign in; returns an access token and a rotating refresh token. Every failure looks the same and takes the same time.' })
  login(@Body() dto: LoginDto, @Req() req: Request, @Headers('user-agent') userAgent?: string): Promise<SessionResult> {
    return this.sessions.login(dto, req.ip ?? 'unknown', userAgent);
  }

  @Public()
  @Throttle(RATE.sessionRefresh)
  @HttpCode(200)
  @Post('session/refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token and a new refresh token. The old one stops working; reusing it revokes the session.' })
  refresh(@Body() dto: RefreshTokenDto, @Headers('user-agent') userAgent?: string): Promise<Tokens> {
    return this.sessions.refresh(dto.refreshToken, userAgent);
  }

  @Public()
  @Throttle(RATE.sessionRefresh)
  @HttpCode(200)
  @Post('session/logout')
  @ApiOperation({ summary: 'End the session behind a refresh token. Safe to call twice.' })
  async logout(@Body() dto: RefreshTokenDto): Promise<{ ok: true }> {
    await this.sessions.logout(dto.refreshToken);
    return { ok: true };
  }

  @Public()
  @Throttle(RATE.passwordForgot)
  @HttpCode(200)
  @Post('password/forgot')
  @ApiOperation({ summary: 'Email a password reset link. The answer is the same whether or not the email has an account.' })
  forgot(@Body() dto: ForgotPasswordDto, @Req() req: Request): { message: string } {
    this.passwords.requestReset(dto.email, req.ip);
    return { message: FORGOT_REPLY };
  }

  @Public()
  @Throttle(RATE.passwordReset)
  @HttpCode(200)
  @Post('password/reset')
  @ApiOperation({ summary: 'Set a new password with the token from the reset email. The token works once. All sessions end.' })
  async reset(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    await this.passwords.reset(dto.token, dto.newPassword);
    return { ok: true };
  }

  @ApiBearerAuth()
  @Throttle(RATE.passwordChange)
  @HttpCode(200)
  @Post('password/change')
  @ApiOperation({ summary: 'Change your own password (needs the current one). Ends every other session and returns a fresh one.' })
  change(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto, @Headers('user-agent') userAgent?: string): Promise<Tokens> {
    return this.passwords.change(user, dto.currentPassword, dto.newPassword, userAgent);
  }
}
