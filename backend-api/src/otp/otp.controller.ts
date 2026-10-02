import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { Public } from '../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { RATE } from '../common/throttling';

@ApiTags('otp')
@Controller('otp')
export class OtpController {
  constructor(private readonly otp: OtpService) {}

  @Public()
  @Throttle(RATE.otpRequest)
  @Post('request')
  @ApiOperation({ summary: 'Send a one-time password to a mobile number (Fast2SMS)' })
  async request(@Body() dto: RequestOtpDto) {
    return this.otp.request(dto.phone);
  }

  @Public()
  @Throttle(RATE.otpVerify)
  @Post('verify')
  @ApiOperation({ summary: 'Verify a one-time password' })
  async verify(@Body() dto: VerifyOtpDto): Promise<{ verified: boolean }> {
    return { verified: await this.otp.verify(dto.phone, dto.code) };
  }
}
