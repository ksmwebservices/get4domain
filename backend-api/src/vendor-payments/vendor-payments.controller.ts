import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VendorPaymentsService, VendorPaymentPublic, ConnectionTest } from './vendor-payments.service';
import { TestConnectionDto, UpdateVendorPaymentDto } from './dto/vendor-payment.dto';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('vendor-payments')
@Controller('vendor-payments')
export class VendorPaymentsController {
  constructor(private readonly service: VendorPaymentsService) {}

  @Get()
  @ApiOperation({ summary: "Get the current vendor's payment config (Razorpay key id + enabled; secret never returned)" })
  get(@CurrentUser() user: AuthenticatedUser): Promise<VendorPaymentPublic> {
    return this.service.getPublic(user.sub);
  }

  @Put()
  @ApiOperation({ summary: "Set the current vendor's own Razorpay keys (secret stored encrypted) and enable/disable payments" })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateVendorPaymentDto): Promise<VendorPaymentPublic> {
    return this.service.upsert(user.sub, dto);
  }

  @Post('test')
  @ApiOperation({ summary: "Test the vendor's Razorpay keys with a read-only call (typed keys, or the saved ones when none are sent)" })
  test(@CurrentUser() user: AuthenticatedUser, @Body() dto: TestConnectionDto): Promise<ConnectionTest> {
    return this.service.testConnection(user.sub, dto);
  }
}
