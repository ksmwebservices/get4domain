import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { CustomerService } from './customer.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

class RequestOtpDto {
  @IsString() phone!: string;
}
class VerifyOtpDto {
  @IsString() phone!: string;
  @IsString() otp!: string;
}
class InviteDto {
  @IsString() contactId!: string;
}

@ApiTags('customer-portal')
@Controller('customer')
export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  @Public()
  @Post('request-otp')
  @ApiOperation({ summary: 'Request a login OTP (mock: returned as devOtp outside production)' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.service.requestOtp(dto.phone);
  }

  @Public()
  @Post('verify')
  @ApiOperation({ summary: 'Verify OTP and start a customer portal session' })
  verify(@Body() dto: VerifyOtpDto) {
    return this.service.verify(dto.phone, dto.otp);
  }

  @Public()
  @Get('me')
  @ApiOperation({ summary: 'Current customer session profile' })
  me(@Headers('authorization') auth?: string) {
    return this.service.me(auth);
  }

  @Public()
  @Get('records')
  @ApiOperation({ summary: "Customer's own records (industry-labelled)" })
  records(@Headers('authorization') auth?: string) {
    return this.service.records(auth);
  }

  @Public()
  @Get('catalog')
  @ApiOperation({ summary: "Browse the vendor's active catalogue (read-only)" })
  catalog(@Headers('authorization') auth?: string) {
    return this.service.catalog(auth);
  }

  @Public()
  @Get('contact')
  @ApiOperation({ summary: "Vendor's contact details for the portal contact modal" })
  contactDetails(@Headers('authorization') auth?: string) {
    return this.service.contactDetails(auth);
  }

  @Public()
  @Get('invoices')
  @ApiOperation({ summary: "Customer's own invoices" })
  invoices(@Headers('authorization') auth?: string) {
    return this.service.invoices(auth);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Vendor sends a portal invite to a contact (mock)' })
  invite(@CurrentUser() user: AuthenticatedUser, @Body() dto: InviteDto) {
    return this.service.invite(user.sub, dto.contactId);
  }
}
