import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RATE } from '../../common/throttling';
import { ClaimStartResult, ClaimStartService } from './claim-start.service';

export class ClaimStartDto {
  @IsString() @MinLength(1) @MaxLength(160) businessSlug!: string;
  /** where the code goes: EMAIL (the default, the owner's address on the record) or SMS (the phone on the record) */
  @IsOptional() @IsIn(['EMAIL', 'SMS']) channel?: 'EMAIL' | 'SMS';
}

/** Public: a visitor of a listing page starts a claim. Rate limited like the code request; uniform for every listing that cannot be claimed. */
@ApiTags('v3-claim')
@Controller('v3/claim')
export class ClaimStartController {
  constructor(private readonly start: ClaimStartService) {}

  @Public() @Throttle(RATE.otpRequest)
  @Post('start') @HttpCode(200)
  @ApiOperation({ summary: 'Start a claim from a listing: send the code to the address on the business record and answer the claim token that drives status, otp/request and otp/verify. 409 DIRECTORY_STATE_INVALID for anything that cannot be claimed; 503 MAIL_DISABLED while email is off.' })
  begin(@Body() dto: ClaimStartDto, @Req() req: Request): Promise<ClaimStartResult> { return this.start.start(dto.businessSlug, dto.channel ?? 'EMAIL', req.ip ?? null); }
}
