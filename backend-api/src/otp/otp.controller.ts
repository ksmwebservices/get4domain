import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('otp')
@Controller('otp')
export class OtpController {
  constructor(private readonly otp: OtpService) {}

  @Public()
  @Post('request')
  @ApiOperation({ summary: 'Send a one-time password to a mobile number (Fast2SMS)' })
  async request(@Body() dto: RequestOtpDto) {
    return this.otp.request(dto.phone);
  }

  @Public()
  @Post('verify')
  @ApiOperation({ summary: 'Verify a one-time password' })
  verify(@Body() dto: VerifyOtpDto): { verified: boolean } {
    return { verified: this.otp.verify(dto.phone, dto.code) };
  }
}
