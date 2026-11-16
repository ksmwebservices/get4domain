import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { RATE } from '../common/throttling';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto';
import { PublicPasswordResetService } from './public-password-reset.service';

/** Password reset for the public site (Wave 2, gap G14). HTTP only; the rules are in the two services. */
@ApiTags('auth-security')
@Controller('v3/account/password/reset')
export class PublicPasswordResetController {
  constructor(private readonly reset: PublicPasswordResetService) {}

  @Public() @Throttle(RATE.passwordForgot) @Post('request') @HttpCode(200)
  @ApiOperation({ summary: 'Email a reset link to the public site. The answer is the same whether or not the email has an account; 503 MAIL_DISABLED while email is off.' })
  request(@Body() dto: ForgotPasswordDto, @Req() req: Request): { message: string } { return this.reset.request(dto.email, req.ip ?? null); }

  @Public() @Throttle(RATE.passwordReset) @Post('confirm') @HttpCode(200)
  @ApiOperation({ summary: 'Set a new password with the token from the reset email. The token works once and every session ends.' })
  confirm(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> { return this.reset.confirm(dto.token, dto.newPassword); }
}
