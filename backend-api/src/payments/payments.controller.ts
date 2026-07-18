import { BadRequestException, Body, Controller, Headers, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth()
  @Post('create-order')
  @ApiOperation({ summary: 'Create a Razorpay order' })
  createOrder(@Body() dto: CreateOrderDto) {
    return this.paymentsService.createOrder(dto);
  }

  @ApiBearerAuth()
  @Post('verify')
  @ApiOperation({ summary: 'Verify a Razorpay checkout payment signature and mark the invoice paid' })
  verifyPayment(@Body() dto: VerifyPaymentDto) {
    return this.paymentsService.verifyPayment(dto);
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Razorpay webhook receiver (payment_link.paid, payment.captured)' })
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature: string) {
    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    const isValid = this.paymentsService.verifyWebhookSignature(req.rawBody.toString('utf8'), signature);
    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    await this.paymentsService.handleWebhookEvent(req.body);
    return { received: true };
  }
}
