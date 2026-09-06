import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VendorPaymentsService, VendorPaymentPublic } from './vendor-payments.service';
import { UpdateVendorPaymentDto } from './dto/vendor-payment.dto';
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
}
