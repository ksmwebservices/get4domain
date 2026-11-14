import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { ClaimOtpService } from './claim-otp.service';

export class OtpRequestDto {
  /** Part B (B7): where the code goes. SMS (the default) goes to the phone on the business record; EMAIL goes to the owner's login email on the record. Never an address or number the caller types. */
  @IsOptional() @IsIn(['SMS', 'EMAIL']) channel?: 'SMS' | 'EMAIL';
}

export class OtpVerifyDto {
  @IsString() @Matches(/^\d{6}$/, { message: 'code must be the 6 digits we sent' }) code!: string;
}

/**
 * Claim by phone OTP: public, rate limited, uniform. Request has no body (the code goes to the phone on the business record, never to a number the caller chooses).
 * The token in the path is the slice 5.3 claim link token; it is never logged or returned.
 */
@ApiTags('v3-claim')
@Controller('v3/claim')
export class ClaimOtpController {
  constructor(private readonly otp: ClaimOtpService) {}

  @Public() @Throttle(RATE.otpRequest)
  @Post(':token/otp/request') @HttpCode(200)
  @ApiOperation({ summary: 'Send a one-time code to the phone number on the business record. The answer is the same whether or not the link is valid.' })
  request(@Param('token') token: string, @Body() dto: OtpRequestDto, @Req() req: Request) { return this.otp.request(String(token).slice(0, 200), req.ip ?? null, dto?.channel ?? 'SMS'); }

  @Public() @Throttle(RATE.otpVerify)
  @Post(':token/otp/verify') @HttpCode(200)
  @ApiOperation({ summary: 'Check the code. On success the claim link is used up, the business is marked claimed and a short-lived single-use account-setup grant is returned. No password is set here.' })
  verify(@Param('token') token: string, @Body() dto: OtpVerifyDto, @Req() req: Request) { return this.otp.verify(String(token).slice(0, 200), dto.code, req.ip ?? null); }
}
